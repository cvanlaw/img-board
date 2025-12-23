const chokidar = require('chokidar');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const config = require('./config.json');

const log = (level, message, data = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  }));
};

async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    log('error', 'Failed to create directory', { path: dirPath, error: err.message });
  }
}

async function processImage(inputPath) {
  const filename = path.basename(inputPath);
  const nameWithoutExt = path.parse(filename).name;
  const outputFilename = `${nameWithoutExt}.webp`;
  const outputPath = path.join(config.preprocessing.processedImagePath, outputFilename);

  try {
    log('info', 'Processing image', { input: inputPath, output: outputPath });

    await sharp(inputPath)
      .webp({ quality: config.preprocessing.quality })
      .resize(config.preprocessing.targetWidth, config.preprocessing.targetHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFile(outputPath);

    log('info', 'Image processed successfully', {
      input: inputPath,
      output: outputPath
    });

    await handleOriginalFile(inputPath);

  } catch (err) {
    log('error', 'Failed to process image', {
      input: inputPath,
      error: err.message
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
      log('info', 'Archived original file', { from: inputPath, to: archivePath });
    } else {
      log('info', 'Kept original file', { path: inputPath });
    }
  } catch (err) {
    log('error', 'Failed to handle original file', {
      path: inputPath,
      error: err.message
    });
  }
}

function isValidImageExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return config.preprocessing.inputExtensions.includes(ext);
}

async function init() {
  if (!config.preprocessing.enabled) {
    log('warn', 'Preprocessing disabled in config');
    process.exit(0);
  }

  await ensureDirectory(config.preprocessing.processedImagePath);

  log('info', 'Starting image preprocessor', {
    rawPath: config.preprocessing.rawImagePath,
    processedPath: config.preprocessing.processedImagePath
  });

  const watcher = chokidar.watch(config.preprocessing.rawImagePath, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    },
    usePolling: true,
    interval: 1000
  });

  watcher
    .on('add', async (filePath) => {
      if (isValidImageExtension(filePath)) {
        await processImage(filePath);
      } else {
        log('warn', 'Skipping unsupported file format', {
          path: filePath,
          ext: path.extname(filePath)
        });
      }
    })
    .on('error', (error) => {
      log('error', 'Watcher error', { error: error.message });
    })
    .on('ready', () => {
      log('info', 'Watching for new images', {
        path: config.preprocessing.rawImagePath
      });
    });
}

init().catch(err => {
  log('error', 'Failed to initialize preprocessor', { error: err.message });
  process.exit(1);
});
