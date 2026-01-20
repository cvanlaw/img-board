const chokidar = require('chokidar');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const {
  register,
  imagesProcessedTotal,
  imagesFailedTotal,
  processingDuration,
  processingQueueDepth,
  imageSizeBytes,
  compressionRatio,
} = require('./lib/preprocessor-metrics');

let config = require('./config.json');

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

async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    log('error', 'Failed to create directory', {
      path: dirPath,
      error: err.message,
    });
  }
}

async function processImage(inputPath) {
  const filename = path.basename(inputPath);
  const nameWithoutExt = path.parse(filename).name;
  const outputFilename = `${nameWithoutExt}.webp`;
  const outputPath = path.join(
    config.preprocessing.processedImagePath,
    outputFilename
  );

  const endTimer = processingDuration.startTimer();
  let inputSize = 0;

  try {
    log('info', 'Processing image', { input: inputPath, output: outputPath });

    // Get input file size for compression ratio
    const inputStats = await fs.stat(inputPath);
    inputSize = inputStats.size;

    await sharp(inputPath)
      .webp({ quality: config.preprocessing.quality })
      .resize(
        config.preprocessing.targetWidth,
        config.preprocessing.targetHeight,
        {
          fit: 'inside',
          withoutEnlargement: true,
        }
      )
      .toFile(outputPath);

    // Get output file size
    const outputStats = await fs.stat(outputPath);
    const outputSize = outputStats.size;

    // Record metrics
    endTimer();
    imagesProcessedTotal.inc();
    imageSizeBytes.observe(outputSize);
    if (inputSize > 0) {
      compressionRatio.observe(inputSize / outputSize);
    }

    log('info', 'Image processed successfully', {
      input: inputPath,
      output: outputPath,
      inputSize,
      outputSize,
      ratio: inputSize > 0 ? (inputSize / outputSize).toFixed(2) : 'N/A',
    });

    await handleOriginalFile(inputPath);
  } catch (err) {
    endTimer();
    imagesFailedTotal.inc({ reason: err.code || 'unknown' });
    log('error', 'Failed to process image', {
      input: inputPath,
      error: err.message,
    });
  }
}

async function handleOriginalFile(inputPath) {
  try {
    if (!config.preprocessing.keepOriginals) {
      await fs.unlink(inputPath);
      log('info', 'Deleted original file', { path: inputPath });
    } else if (config.preprocessing.archivePath) {
      await ensureDirectory(config.preprocessing.archivePath);
      const filename = path.basename(inputPath);
      const archivePath = path.join(config.preprocessing.archivePath, filename);
      await fs.rename(inputPath, archivePath);
      log('info', 'Archived original file', {
        from: inputPath,
        to: archivePath,
      });
    } else {
      log('info', 'Kept original file', { path: inputPath });
    }
  } catch (err) {
    log('error', 'Failed to handle original file', {
      path: inputPath,
      error: err.message,
    });
  }
}

function isValidImageExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return config.preprocessing.inputExtensions.includes(ext);
}

async function init() {
  // Start metrics server
  const metricsServer = http.createServer(async (req, res) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      try {
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch {
        res.statusCode = 500;
        res.end('Error generating metrics');
      }
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  metricsServer.on('error', (err) => {
    log('error', 'Metrics server error', { error: err.message });
    if (err.code === 'EADDRINUSE') {
      log('error', 'Metrics port 9092 already in use');
    }
  });

  metricsServer.listen(9092, () => {
    log('info', 'Preprocessor metrics server started', { port: 9092 });
  });

  if (!config.preprocessing.enabled) {
    log('warn', 'Preprocessing disabled in config');
    process.exit(0);
  }

  await ensureDirectory(config.preprocessing.processedImagePath);

  log('info', 'Starting image preprocessor', {
    rawPath: config.preprocessing.rawImagePath,
    processedPath: config.preprocessing.processedImagePath,
  });

  const watcher = chokidar.watch(config.preprocessing.rawImagePath, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
    usePolling: true,
    interval: 1000,
  });

  watcher
    .on('add', async (filePath) => {
      if (isValidImageExtension(filePath)) {
        processingQueueDepth.inc();
        try {
          await processImage(filePath);
        } finally {
          processingQueueDepth.dec();
        }
      } else {
        log('warn', 'Skipping unsupported file format', {
          path: filePath,
          ext: path.extname(filePath),
        });
      }
    })
    .on('error', (error) => {
      log('error', 'Watcher error', { error: error.message });
    })
    .on('ready', () => {
      log('info', 'Watching for new images', {
        path: config.preprocessing.rawImagePath,
      });
    });

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

  const reprocessWatcher = chokidar.watch('./.reprocess-trigger', {
    persistent: true,
    ignoreInitial: true,
  });

  reprocessWatcher.on('add', handleReprocessTrigger);
  reprocessWatcher.on('change', handleReprocessTrigger);
}

async function scanDirectory(dirPath) {
  const files = await fs.readdir(dirPath);

  return files
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return config.preprocessing.inputExtensions.includes(ext);
    })
    .map((f) => path.join(dirPath, f));
}

async function handleReprocessTrigger() {
  log('info', 'Reprocess triggered, scanning raw directory...');

  delete require.cache[require.resolve('./config.json')];
  config = require('./config.json');

  try {
    const files = await scanDirectory(config.preprocessing.rawImagePath);
    log('info', 'Found images to reprocess', { count: files.length });

    let completed = 0;
    let failed = 0;
    const errors = [];

    for (const file of files) {
      processingQueueDepth.inc();
      try {
        await processImage(file);
        completed++;
      } catch (err) {
        failed++;
        errors.push({ file: path.basename(file), error: err.message });
        log('error', 'Failed to process image', {
          file: path.basename(file),
          error: err.message,
        });
      } finally {
        processingQueueDepth.dec();
      }

      await fs.writeFile(
        './.reprocess-progress.json',
        JSON.stringify({
          completed,
          failed,
          total: files.length,
          timestamp: Date.now(),
        })
      );
    }

    log('info', 'Reprocessing complete', {
      completed,
      failed,
      total: files.length,
    });
    if (errors.length > 0) {
      log('warn', 'Failed files', { files: errors.map((e) => e.file) });
    }
  } catch (err) {
    log('error', 'Reprocessing failed', { error: err.message });
  } finally {
    await cleanup();
  }
}

async function cleanup() {
  try {
    await fs.unlink('./.reprocess-trigger');
  } catch {
    // File may not exist, ignore
  }
  setTimeout(async () => {
    try {
      await fs.unlink('./.reprocess-progress.json');
    } catch {
      // File may not exist, ignore
    }
  }, 5000);
}

function updateSettings(newConfig) {
  const oldWidth = config.preprocessing.targetWidth;
  const oldHeight = config.preprocessing.targetHeight;
  const oldQuality = config.preprocessing.quality;

  config = newConfig;

  log('info', 'Preprocessor config reloaded', {
    targetWidth: config.preprocessing.targetWidth,
    targetHeight: config.preprocessing.targetHeight,
    quality: config.preprocessing.quality,
  });

  if (
    oldWidth !== newConfig.preprocessing.targetWidth ||
    oldHeight !== newConfig.preprocessing.targetHeight ||
    oldQuality !== newConfig.preprocessing.quality
  ) {
    log('info', 'Processing settings changed', {
      from: { width: oldWidth, height: oldHeight, quality: oldQuality },
      to: {
        width: newConfig.preprocessing.targetWidth,
        height: newConfig.preprocessing.targetHeight,
        quality: newConfig.preprocessing.quality,
      },
    });
  }
}

init().catch((err) => {
  log('error', 'Failed to initialize preprocessor', { error: err.message });
  process.exit(1);
});
