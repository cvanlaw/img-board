const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const chokidar = require('chokidar');

const config = require('./config.json');
const app = express();

let imageList = [];
let sseClients = [];
let pendingChanges = { added: [], removed: [] };

const log = (level, message, data = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  }));
};

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

app.use(express.static('public'));

function broadcast(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => client.write(message));
  log('debug', 'SSE broadcast', { event, clientCount: sseClients.length });
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write('event: connected\ndata: {}\n\n');

  sseClients.push(res);
  log('info', 'SSE client connected', { total: sseClients.length });

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
    log('info', 'SSE client disconnected', { remaining: sseClients.length });
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime()
  });
});

app.get('/api/images', async (req, res) => {
  try {
    const files = await fs.readdir(config.imagePath);
    let images = files.filter(f =>
      config.imageExtensions.includes(path.extname(f).toLowerCase())
    );

    if (config.randomOrder) {
      images = shuffleArray(images);
    }

    log('info', 'Image list requested', { count: images.length });
    res.json(images);
  } catch (err) {
    log('error', 'Failed to read image directory', {
      path: config.imagePath,
      error: err.message
    });
    res.status(500).json({ error: 'Failed to read images' });
  }
});

app.get('/images/:filename', (req, res) => {
  const filename = req.params.filename;

  const ext = path.extname(filename).toLowerCase();
  if (!config.imageExtensions.includes(ext)) {
    log('warn', 'Blocked file with invalid extension', {
      filename,
      ext,
      ip: req.ip
    });
    return res.status(403).send('Forbidden');
  }

  const safeName = path.basename(filename);
  if (safeName !== filename) {
    log('warn', 'Blocked directory traversal attempt', {
      requested: filename,
      sanitized: safeName,
      ip: req.ip
    });
    return res.status(403).send('Forbidden');
  }

  const imagePath = path.join(config.imagePath, safeName);

  res.sendFile(imagePath, (err) => {
    if (err) {
      log('error', 'Failed to serve image', {
        filename: safeName,
        error: err.message
      });
      res.status(404).send('Not found');
    } else {
      log('info', 'Image served', { filename: safeName });
    }
  });
});

const watcher = chokidar.watch(config.imagePath, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: true,
  usePolling: true,
  interval: 1000
});

watcher.on('add', (filePath) => {
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();
  if (config.imageExtensions.includes(ext)) {
    if (config.reshuffleInterval > 0) {
      pendingChanges.added.push(filename);
    } else {
      imageList.push(filename);
      broadcast('add', { filename });
    }
    log('info', 'Image added', { filename });
  }
});

watcher.on('unlink', (filePath) => {
  const filename = path.basename(filePath);
  if (config.reshuffleInterval > 0) {
    pendingChanges.removed.push(filename);
  } else {
    imageList = imageList.filter(f => f !== filename);
    broadcast('remove', { filename });
  }
  log('info', 'Image removed', { filename });
});

if (config.reshuffleInterval > 0) {
  setInterval(() => {
    pendingChanges.added.forEach(f => imageList.push(f));
    pendingChanges.removed.forEach(f => {
      imageList = imageList.filter(img => img !== f);
    });
    pendingChanges = { added: [], removed: [] };

    if (config.randomOrder) {
      imageList = shuffleArray(imageList);
    }

    broadcast('reshuffle', { images: imageList });
    log('info', 'Reshuffle broadcast', { count: imageList.length });
  }, config.reshuffleInterval);
}

const server = app.listen(config.port, () => {
  log('info', 'Server started', {
    port: config.port,
    imagePath: config.imagePath,
    staticPath: 'public'
  });
});

process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('info', 'Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('info', 'SIGINT received, shutting down gracefully');
  server.close(() => {
    log('info', 'Server closed');
    process.exit(0);
  });
});
