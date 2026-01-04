const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const chokidar = require('chokidar');
const multer = require('multer');
const { shuffleArray, deepMerge, ipMatches } = require('./lib/utils');

let config = require('./config.json');
const app = express();

const EXCLUDED_FILE = './.excluded-images.json';

async function loadExcludedImages() {
  try {
    const data = await fs.readFile(EXCLUDED_FILE, 'utf8');
    return JSON.parse(data).excluded || [];
  } catch {
    return [];
  }
}

async function saveExcludedImages(excluded) {
  const data = JSON.stringify({ excluded, lastModified: Date.now() }, null, 2);
  await fs.writeFile(EXCLUDED_FILE + '.tmp', data);
  await fs.rename(EXCLUDED_FILE + '.tmp', EXCLUDED_FILE);
}

let imageList = [];
let sseClients = [];
let pendingChanges = { added: [], removed: [] };

const log = (level, message, data = {}) => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data,
    })
  );
};

function adminIPFilter(req, res, next) {
  const config = require('./config.json');
  const clientIP = req.ip || req.connection.remoteAddress;
  const allowedPatterns = config.admin?.allowedIPs || [];

  if (allowedPatterns.length === 0) {
    return next();
  }

  const isAllowed = allowedPatterns.some((pattern) =>
    ipMatches(clientIP, pattern)
  );
  if (!isAllowed) {
    log('warn', 'Admin access denied', { ip: clientIP });
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

// Multer configuration for file uploads
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const config = require('./config.json');
    cb(null, config.preprocessing.rawImagePath);
  },
  filename: (req, file, cb) => {
    // Sanitize: remove path components, replace unsafe characters
    const safeName = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}-${safeName}`;
    cb(null, uniqueName);
  },
});

const uploadFilter = (req, file, cb) => {
  const config = require('./config.json');
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimes = ['image/jpeg', 'image/png'];

  if (!config.preprocessing.inputExtensions.includes(ext)) {
    return cb(new Error(`Invalid extension: ${ext}`), false);
  }
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error(`Invalid MIME type: ${file.mimetype}`), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: uploadStorage,
  fileFilter: uploadFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
});

app.use(express.static('public'));
app.use(express.json());

app.use('/admin', adminIPFilter);
app.use('/api/admin', adminIPFilter);

// Redirect /admin to /admin.html for user convenience
app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});

function broadcast(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => client.write(message));
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
    sseClients = sseClients.filter((client) => client !== res);
    log('info', 'SSE client disconnected', { remaining: sseClients.length });
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
  });
});

app.get('/api/admin/config', (req, res) => {
  const config = JSON.parse(fsSync.readFileSync('./config.json', 'utf8'));
  res.json(config);
});

app.post('/api/admin/config', async (req, res) => {
  try {
    const currentConfig = JSON.parse(
      await fs.readFile('./config.json', 'utf8')
    );
    const newConfig = deepMerge(currentConfig, req.body);

    if (newConfig.slideshowInterval < 1000) {
      return res
        .status(400)
        .json({ error: 'slideshowInterval must be >= 1000ms' });
    }
    if (
      newConfig.preprocessing?.quality < 1 ||
      newConfig.preprocessing?.quality > 100
    ) {
      return res.status(400).json({ error: 'quality must be 1-100' });
    }

    await fs.writeFile('./config.json', JSON.stringify(newConfig, null, 2));

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
    res
      .status(500)
      .json({ error: 'Failed to update configuration', details: err.message });
  }
});

// POST /api/admin/upload - Upload images to raw directory
app.post('/api/admin/upload', upload.array('images', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const uploaded = req.files.map((f) => ({
    original: f.originalname,
    saved: f.filename,
    size: f.size,
  }));

  log('info', 'Images uploaded', {
    count: uploaded.length,
    files: uploaded.map((f) => f.saved),
  });
  res.json({
    success: true,
    uploaded,
    message: `${uploaded.length} file(s) uploaded. Processing will begin shortly.`,
  });
});

// Multer error handler
app.use('/api/admin/upload', (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large (max 50MB)' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files (max 10)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    log('error', 'Upload error', { error: err.message });
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.get('/api/admin/stats', async (req, res) => {
  const config = require('./config.json');

  let rawCount = 0;
  let processedCount = 0;

  try {
    const rawFiles = await fs.readdir(config.preprocessing.rawImagePath);
    rawCount = rawFiles.filter((f) =>
      config.preprocessing.inputExtensions.includes(
        path.extname(f).toLowerCase()
      )
    ).length;
  } catch (e) {}

  try {
    const processedFiles = await fs.readdir(config.imagePath);
    processedCount = processedFiles.filter((f) =>
      config.imageExtensions.includes(path.extname(f).toLowerCase())
    ).length;
  } catch (e) {}

  res.json({
    raw: rawCount,
    processed: processedCount,
    timestamp: Date.now(),
  });
});

app.post('/api/admin/reprocess', async (req, res) => {
  if (
    fsSync.existsSync('./.reprocess-trigger') ||
    fsSync.existsSync('./.reprocess-progress.json')
  ) {
    return res.status(409).json({ error: 'Reprocessing already in progress' });
  }

  await fs.writeFile('./.reprocess-trigger', Date.now().toString());
  log('info', 'Reprocessing triggered');
  res.json({
    status: 'triggered',
    message:
      'Reprocessing started. Use /api/admin/reprocess-status to monitor.',
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

// Helper function to get list of files in trash
async function getTrashFiles() {
  try {
    const trashPath = config.admin?.trashPath;
    if (!trashPath) return [];

    const files = await fs.readdir(trashPath);
    return files.filter((f) =>
      config.imageExtensions.includes(path.extname(f).toLowerCase())
    );
  } catch {
    return [];
  }
}

// Helper function to ensure trash directory exists
async function ensureTrashDir() {
  const trashPath = config.admin?.trashPath;
  if (trashPath) {
    await fs.mkdir(trashPath, { recursive: true });
  }
}

// Helper functions for bulk operations
async function performExclude(filename, excluded) {
  const filePath = path.join(config.imagePath, filename);
  await fs.access(filePath); // Throws if not found

  const currentExcluded = await loadExcludedImages();
  let newExcluded;

  if (excluded) {
    if (!currentExcluded.includes(filename)) {
      newExcluded = [...currentExcluded, filename];
    } else {
      newExcluded = currentExcluded;
    }
  } else {
    newExcluded = currentExcluded.filter((f) => f !== filename);
  }

  await saveExcludedImages(newExcluded);
  broadcast(excluded ? 'remove' : 'add', { filename });
}

async function performSoftDelete(filename) {
  const trashPath = config.admin?.trashPath;
  if (!trashPath) {
    throw new Error('Trash path not configured');
  }

  const sourcePath = path.join(config.imagePath, filename);
  const destPath = path.join(trashPath, filename);
  const metaPath = path.join(trashPath, `${filename}.meta.json`);

  await fs.access(sourcePath); // Throws if not found
  await ensureTrashDir();
  await fs.rename(sourcePath, destPath);

  const meta = {
    deletedAt: Date.now(),
    originalPath: 'processed',
  };
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

  const excluded = await loadExcludedImages();
  if (excluded.includes(filename)) {
    await saveExcludedImages(excluded.filter((f) => f !== filename));
  }

  broadcast('remove', { filename });
}

async function performRestore(filename) {
  const trashPath = config.admin?.trashPath;
  if (!trashPath) {
    throw new Error('Trash path not configured');
  }

  const sourcePath = path.join(trashPath, filename);
  const destPath = path.join(config.imagePath, filename);
  const metaPath = path.join(trashPath, `${filename}.meta.json`);

  await fs.access(sourcePath); // Throws if not found
  await fs.rename(sourcePath, destPath);

  try {
    await fs.unlink(metaPath);
  } catch {
    // Ignore if meta file doesn't exist
  }

  broadcast('add', { filename });
}

async function performPermanentDelete(filename) {
  const trashPath = config.admin?.trashPath;
  if (!trashPath) {
    throw new Error('Trash path not configured');
  }

  const filePath = path.join(trashPath, filename);
  const metaPath = path.join(trashPath, `${filename}.meta.json`);

  await fs.access(filePath); // Throws if not found
  await fs.unlink(filePath);

  try {
    await fs.unlink(metaPath);
  } catch {
    // Ignore if meta file doesn't exist
  }
}

// GET /api/admin/images - List all images with metadata
app.get('/api/admin/images', async (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const processedFiles = await fs.readdir(config.imagePath);
    const excluded = await loadExcludedImages();
    const trashFiles = await getTrashFiles();

    let images = [];

    // Build image list with metadata
    for (const filename of processedFiles) {
      const ext = path.extname(filename).toLowerCase();
      if (!config.imageExtensions.includes(ext)) continue;

      const filePath = path.join(config.imagePath, filename);
      const stats = await fs.stat(filePath);

      images.push({
        filename,
        excluded: excluded.includes(filename),
        deleted: false,
        size: stats.size,
        modified: stats.mtimeMs,
      });
    }

    // Add trash files if filter is 'all' or 'trash'
    if (filter === 'all' || filter === 'trash') {
      const trashPath = config.admin?.trashPath;
      if (trashPath) {
        for (const filename of trashFiles) {
          try {
            const filePath = path.join(trashPath, filename);
            const stats = await fs.stat(filePath);

            images.push({
              filename,
              excluded: false,
              deleted: true,
              size: stats.size,
              modified: stats.mtimeMs,
            });
          } catch {
            // Skip files that can't be stat'd
          }
        }
      }
    }

    // Calculate counts before filtering
    const visibleCount = images.filter((i) => !i.excluded && !i.deleted).length;
    const excludedCount = excluded.length;
    const trashCount = trashFiles.length;

    // Apply filter
    if (filter === 'visible') {
      images = images.filter((i) => !i.excluded && !i.deleted);
    } else if (filter === 'excluded') {
      images = images.filter((i) => i.excluded && !i.deleted);
    } else if (filter === 'trash') {
      images = images.filter((i) => i.deleted);
    }

    // Pagination
    const total = images.length;
    const start = (page - 1) * limit;
    const paginatedImages = images.slice(start, start + limit);

    res.json({
      images: paginatedImages,
      total,
      visible: visibleCount,
      excluded: excludedCount,
      trash: trashCount,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    log('error', 'Failed to list images', { error: err.message });
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// POST /api/admin/images/:filename/exclude - Toggle image exclusion
app.post('/api/admin/images/:filename/exclude', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // Prevent traversal
    const { excluded } = req.body;

    if (typeof excluded !== 'boolean') {
      return res.status(400).json({ error: 'excluded must be a boolean' });
    }

    // Verify file exists
    const filePath = path.join(config.imagePath, filename);
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Update exclusion list
    const currentExcluded = await loadExcludedImages();
    let newExcluded;

    if (excluded) {
      if (!currentExcluded.includes(filename)) {
        newExcluded = [...currentExcluded, filename];
      } else {
        newExcluded = currentExcluded;
      }
    } else {
      newExcluded = currentExcluded.filter((f) => f !== filename);
    }

    await saveExcludedImages(newExcluded);

    // Broadcast SSE event
    if (excluded) {
      broadcast('remove', { filename });
    } else {
      broadcast('add', { filename });
    }

    log('info', 'Image exclusion toggled', { filename, excluded });
    res.json({ success: true, filename, excluded });
  } catch (err) {
    log('error', 'Failed to toggle exclusion', { error: err.message });
    res.status(500).json({ error: 'Failed to toggle exclusion' });
  }
});

// DELETE /api/admin/images/:filename - Soft delete (move to trash)
app.delete('/api/admin/images/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const trashPath = config.admin?.trashPath;

    if (!trashPath) {
      return res.status(400).json({ error: 'Trash path not configured' });
    }

    const sourcePath = path.join(config.imagePath, filename);
    const destPath = path.join(trashPath, filename);
    const metaPath = path.join(trashPath, `${filename}.meta.json`);

    // Verify source exists
    try {
      await fs.access(sourcePath);
    } catch {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Ensure trash directory exists
    await ensureTrashDir();

    // Move to trash
    await fs.rename(sourcePath, destPath);

    // Create metadata file
    const meta = {
      deletedAt: Date.now(),
      originalPath: 'processed',
    };
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

    // Remove from exclusion list if present
    const excluded = await loadExcludedImages();
    if (excluded.includes(filename)) {
      await saveExcludedImages(excluded.filter((f) => f !== filename));
    }

    // Broadcast removal
    broadcast('remove', { filename });

    log('info', 'Image soft deleted', { filename });
    res.json({ success: true, filename });
  } catch (err) {
    log('error', 'Failed to delete image', { error: err.message });
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// POST /api/admin/images/:filename/restore - Restore from trash
app.post('/api/admin/images/:filename/restore', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const trashPath = config.admin?.trashPath;

    if (!trashPath) {
      return res.status(400).json({ error: 'Trash path not configured' });
    }

    const sourcePath = path.join(trashPath, filename);
    const destPath = path.join(config.imagePath, filename);
    const metaPath = path.join(trashPath, `${filename}.meta.json`);

    // Verify source exists in trash
    try {
      await fs.access(sourcePath);
    } catch {
      return res.status(404).json({ error: 'Image not found in trash' });
    }

    // Move back to processed
    await fs.rename(sourcePath, destPath);

    // Delete metadata file
    try {
      await fs.unlink(metaPath);
    } catch {
      // Ignore if meta file doesn't exist
    }

    // Broadcast addition
    broadcast('add', { filename });

    log('info', 'Image restored', { filename });
    res.json({ success: true, filename });
  } catch (err) {
    log('error', 'Failed to restore image', { error: err.message });
    res.status(500).json({ error: 'Failed to restore image' });
  }
});

// DELETE /api/admin/images/:filename/permanent - Permanently delete from trash
app.delete('/api/admin/images/:filename/permanent', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const trashPath = config.admin?.trashPath;

    if (!trashPath) {
      return res.status(400).json({ error: 'Trash path not configured' });
    }

    const filePath = path.join(trashPath, filename);
    const metaPath = path.join(trashPath, `${filename}.meta.json`);

    // Verify file exists in trash
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Image not found in trash' });
    }

    // Delete image file
    await fs.unlink(filePath);

    // Delete metadata file if exists
    try {
      await fs.unlink(metaPath);
    } catch {
      // Ignore if meta file doesn't exist
    }

    log('info', 'Image permanently deleted', { filename });
    res.json({ success: true, filename });
  } catch (err) {
    log('error', 'Failed to permanently delete image', { error: err.message });
    res.status(500).json({ error: 'Failed to permanently delete image' });
  }
});

// POST /api/admin/images/bulk - Bulk operations on multiple images
app.post('/api/admin/images/bulk', async (req, res) => {
  try {
    const { action, filenames } = req.body;

    if (!action || !Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({
        error: 'action and filenames array required',
      });
    }

    const validActions = [
      'exclude',
      'include',
      'delete',
      'restore',
      'permanent-delete',
    ];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      });
    }

    const results = [];

    for (const filename of filenames) {
      const safeFilename = path.basename(filename);

      try {
        switch (action) {
          case 'exclude':
            await performExclude(safeFilename, true);
            break;
          case 'include':
            await performExclude(safeFilename, false);
            break;
          case 'delete':
            await performSoftDelete(safeFilename);
            break;
          case 'restore':
            await performRestore(safeFilename);
            break;
          case 'permanent-delete':
            await performPermanentDelete(safeFilename);
            break;
        }
        results.push({ filename: safeFilename, success: true });
      } catch (err) {
        results.push({
          filename: safeFilename,
          success: false,
          error: err.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    log('info', 'Bulk operation completed', {
      action,
      total: filenames.length,
      success: successCount,
    });

    res.json({
      success: successCount === filenames.length,
      results,
    });
  } catch (err) {
    log('error', 'Bulk operation failed', { error: err.message });
    res.status(500).json({ error: 'Bulk operation failed' });
  }
});

app.get('/api/images', async (req, res) => {
  try {
    const files = await fs.readdir(config.imagePath);
    const excluded = await loadExcludedImages();

    let images = files.filter(
      (f) =>
        config.imageExtensions.includes(path.extname(f).toLowerCase()) &&
        !excluded.includes(f)
    );

    if (config.randomOrder) {
      images = shuffleArray(images);
    }

    log('info', 'Image list requested', {
      count: images.length,
      excluded: excluded.length,
    });
    res.json(images);
  } catch (err) {
    log('error', 'Failed to read image directory', {
      path: config.imagePath,
      error: err.message,
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
      ip: req.ip,
    });
    return res.status(403).send('Forbidden');
  }

  const safeName = path.basename(filename);
  if (safeName !== filename) {
    log('warn', 'Blocked directory traversal attempt', {
      requested: filename,
      sanitized: safeName,
      ip: req.ip,
    });
    return res.status(403).send('Forbidden');
  }

  const imagePath = path.join(config.imagePath, safeName);

  res.sendFile(imagePath, (err) => {
    if (err) {
      log('error', 'Failed to serve image', {
        filename: safeName,
        error: err.message,
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
  interval: 1000,
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
    imageList = imageList.filter((f) => f !== filename);
    broadcast('remove', { filename });
  }
  log('info', 'Image removed', { filename });
});

if (config.reshuffleInterval > 0) {
  setInterval(() => {
    pendingChanges.added.forEach((f) => imageList.push(f));
    pendingChanges.removed.forEach((f) => {
      imageList = imageList.filter((img) => img !== f);
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
    pollInterval: 100,
  },
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
      slideshowInterval: newConfig.slideshowInterval,
    });
    log('info', 'Slideshow interval updated', {
      from: oldInterval,
      to: newConfig.slideshowInterval,
    });
  }
}

function startServer() {
  let server;

  if (config.https?.enabled) {
    try {
      const options = {
        cert: fsSync.readFileSync(config.https.cert),
        key: fsSync.readFileSync(config.https.key),
      };

      server = https.createServer(options, app).listen(config.port, () => {
        log('info', 'HTTPS server started', {
          port: config.port,
          imagePath: config.imagePath,
          staticPath: 'public',
        });
      });
    } catch (err) {
      log('error', 'Failed to start HTTPS server', {
        error: err.message,
        cert: config.https.cert,
        key: config.https.key,
      });
      process.exit(1);
    }
  } else {
    server = http.createServer(app).listen(config.port, () => {
      log('info', 'HTTP server started', {
        port: config.port,
        imagePath: config.imagePath,
        staticPath: 'public',
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
