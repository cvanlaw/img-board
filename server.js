const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const config = require('./config.json');
const app = express();

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
