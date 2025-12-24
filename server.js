const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const chokidar = require('chokidar');

let config = require('./config.json');
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

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function ipMatches(clientIP, pattern) {
  const ip = clientIP.replace(/^::ffff:/, '');

  if (ip === '127.0.0.1' || ip === '::1' || clientIP === '::1') {
    return true;
  }
  if (ip === pattern) {
    return true;
  }
  if (pattern.endsWith('/24')) {
    const subnet = pattern.replace('/24', '').split('.').slice(0, 3).join('.');
    const ipPrefix = ip.split('.').slice(0, 3).join('.');
    return subnet === ipPrefix;
  }
  return false;
}

function adminIPFilter(req, res, next) {
  const config = require('./config.json');
  const clientIP = req.ip || req.connection.remoteAddress;
  const allowedPatterns = config.admin?.allowedIPs || [];

  if (allowedPatterns.length === 0) {
    return next();
  }

  const isAllowed = allowedPatterns.some(pattern => ipMatches(clientIP, pattern));
  if (!isAllowed) {
    log('warn', 'Admin access denied', { ip: clientIP });
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

app.use(express.static('public'));
app.use(express.json());

app.use('/admin', adminIPFilter);
app.use('/api/admin', adminIPFilter);

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

app.get('/api/admin/config', (req, res) => {
  const config = JSON.parse(fsSync.readFileSync('./config.json', 'utf8'));
  res.json(config);
});

app.post('/api/admin/config', async (req, res) => {
  try {
    const currentConfig = JSON.parse(await fs.readFile('./config.json', 'utf8'));
    const newConfig = deepMerge(currentConfig, req.body);

    if (newConfig.slideshowInterval < 1000) {
      return res.status(400).json({ error: 'slideshowInterval must be >= 1000ms' });
    }
    if (newConfig.preprocessing?.quality < 1 || newConfig.preprocessing?.quality > 100) {
      return res.status(400).json({ error: 'quality must be 1-100' });
    }

    const tempFile = './config.json.tmp';
    await fs.writeFile(tempFile, JSON.stringify(newConfig, null, 2));
    await fs.rename(tempFile, './config.json');

    const aspectChanged =
      req.body.preprocessing?.targetWidth !== undefined ||
      req.body.preprocessing?.targetHeight !== undefined;

    if (aspectChanged) {
      await fs.writeFile('./.reprocess-trigger', Date.now().toString());
    }

    log('info', 'Config updated', { aspectChanged });
    res.json({ success: true, reprocessing: aspectChanged });
  } catch (err) {
    log('error', 'Config update failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  const config = require('./config.json');

  let rawCount = 0;
  let processedCount = 0;

  try {
    const rawFiles = await fs.readdir(config.preprocessing.rawImagePath);
    rawCount = rawFiles.filter(f =>
      config.preprocessing.inputExtensions.includes(path.extname(f).toLowerCase())
    ).length;
  } catch (e) {
  }

  try {
    const processedFiles = await fs.readdir(config.imagePath);
    processedCount = processedFiles.filter(f =>
      config.imageExtensions.includes(path.extname(f).toLowerCase())
    ).length;
  } catch (e) {
  }

  res.json({
    raw: rawCount,
    processed: processedCount,
    timestamp: Date.now()
  });
});

app.post('/api/admin/reprocess', async (req, res) => {
  if (fsSync.existsSync('./.reprocess-trigger') || fsSync.existsSync('./.reprocess-progress.json')) {
    return res.status(409).json({ error: 'Reprocessing already in progress' });
  }

  await fs.writeFile('./.reprocess-trigger', Date.now().toString());
  log('info', 'Reprocessing triggered');
  res.json({
    status: 'triggered',
    message: 'Reprocessing started. Use /api/admin/reprocess-status to monitor.'
  });
});

app.get('/api/admin/reprocess-status', async (req, res) => {
  try {
    const progress = JSON.parse(
      await fs.readFile('./.reprocess-progress.json', 'utf8')
    );
    res.json({ active: true, ...progress });
  } catch (e) {
    res.json({ active: false });
  }
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

const configWatcher = chokidar.watch('./config.json', {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100
  }
});

configWatcher.on('change', () => {
  try {
    log('info', 'Config file changed, reloading...');
    delete require.cache[require.resolve('./config.json')];
    const newConfig = require('./config.json');
    updateSettings(newConfig);
  } catch (err) {
    log('error', 'Failed to reload config', { error: err.message });
  }
});

function updateSettings(newConfig) {
  const oldInterval = config.slideshowInterval;
  config = newConfig;

  if (oldInterval !== newConfig.slideshowInterval) {
    broadcast('config-update', {
      slideshowInterval: newConfig.slideshowInterval
    });
    log('info', 'Slideshow interval updated', {
      from: oldInterval,
      to: newConfig.slideshowInterval
    });
  }
}

function startServer() {
  let server;

  if (config.https?.enabled) {
    try {
      const options = {
        cert: fsSync.readFileSync(config.https.cert),
        key: fsSync.readFileSync(config.https.key)
      };

      server = https.createServer(options, app).listen(config.port, () => {
        log('info', 'HTTPS server started', {
          port: config.port,
          imagePath: config.imagePath,
          staticPath: 'public'
        });
      });
    } catch (err) {
      log('error', 'Failed to start HTTPS server', {
        error: err.message,
        cert: config.https.cert,
        key: config.https.key
      });
      process.exit(1);
    }
  } else {
    server = http.createServer(app).listen(config.port, () => {
      log('info', 'HTTP server started', {
        port: config.port,
        imagePath: config.imagePath,
        staticPath: 'public'
      });
    });
  }

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
}

startServer();
