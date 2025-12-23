# Task 09: Reprocessing Workflow

## Description
Implement the trigger-based reprocessing workflow that allows batch reprocessing of all images when preprocessing settings (dimensions, quality) change.

## Dependencies
- Task 02: Image Preprocessor
- Task 06: Admin API (creates trigger file)
- Task 08: Config Hot Reload

## Deliverables
- Updated `preprocessor.js` with reprocess trigger handling
- File-based IPC using `.reprocess-trigger` and `.reprocess-progress.json`

## Acceptance Criteria
- [ ] Preprocessor watches `.reprocess-trigger` file
- [ ] Trigger file creation starts reprocessing all raw images
- [ ] Progress written to `.reprocess-progress.json` after each image
- [ ] Progress includes completed count, failed count, and total
- [ ] Failed images logged but don't stop processing
- [ ] Trigger and progress files cleaned up on completion
- [ ] Concurrent reprocess requests prevented (409 from API)
- [ ] Reprocessing uses current config values (reloaded before start)

## Implementation Details

### Trigger File Watcher
```javascript
// In preprocessor.js
const reprocessWatcher = chokidar.watch('./.reprocess-trigger', {
  persistent: true,
  ignoreInitial: true  // Don't trigger on startup if file exists
});

reprocessWatcher.on('add', handleReprocessTrigger);
reprocessWatcher.on('change', handleReprocessTrigger);
```

### Reprocess Handler
```javascript
async function handleReprocessTrigger() {
  log('info', 'Reprocess triggered, scanning raw directory...');

  // Reload config to get latest settings
  delete require.cache[require.resolve('./config.json')];
  const config = require('./config.json');

  try {
    // Scan raw directory for all images
    const files = await scanDirectory(config.preprocessing.rawImagePath);
    log('info', 'Found images to reprocess', { count: files.length });

    let completed = 0;
    let failed = 0;
    const errors = [];

    for (const file of files) {
      try {
        await processImage(file);
        completed++;
      } catch (err) {
        failed++;
        errors.push({ file: path.basename(file), error: err.message });
        log('error', 'Failed to process image', {
          file: path.basename(file),
          error: err.message
        });
      }

      // Write progress
      await fs.promises.writeFile('./.reprocess-progress.json',
        JSON.stringify({
          completed,
          failed,
          total: files.length,
          timestamp: Date.now()
        })
      );
    }

    // Log summary
    log('info', 'Reprocessing complete', { completed, failed, total: files.length });
    if (errors.length > 0) {
      log('warn', 'Failed files', { files: errors.map(e => e.file) });
    }

  } catch (err) {
    log('error', 'Reprocessing failed', { error: err.message });
  } finally {
    // Always clean up trigger/progress files
    await cleanup();
  }
}

async function cleanup() {
  try { await fs.promises.unlink('./.reprocess-trigger'); } catch {}
  // Small delay before removing progress so admin UI can see completion
  setTimeout(async () => {
    try { await fs.promises.unlink('./.reprocess-progress.json'); } catch {}
  }, 5000);
}
```

### Directory Scanner
```javascript
async function scanDirectory(dirPath) {
  const config = require('./config.json');
  const files = await fs.promises.readdir(dirPath);

  return files
    .filter(f => {
      const ext = path.extname(f).toLowerCase();
      return config.preprocessing.inputExtensions.includes(ext);
    })
    .map(f => path.join(dirPath, f));
}
```

### Process Image Function (from Task 02)
```javascript
async function processImage(inputPath) {
  const config = require('./config.json');
  const filename = path.basename(inputPath);
  const outputFilename = filename.replace(/\.[^.]+$/, '.webp');
  const outputPath = path.join(config.preprocessing.processedImagePath, outputFilename);

  await sharp(inputPath)
    .webp({ quality: config.preprocessing.quality })
    .resize(config.preprocessing.targetWidth, config.preprocessing.targetHeight, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .toFile(outputPath);

  log('info', 'Image processed', {
    input: filename,
    output: outputFilename,
    width: config.preprocessing.targetWidth,
    height: config.preprocessing.targetHeight
  });

  // Handle original per config
  if (!config.preprocessing.keepOriginals) {
    await fs.promises.unlink(inputPath);
  } else if (config.preprocessing.archivePath) {
    const archiveDest = path.join(config.preprocessing.archivePath, filename);
    await fs.promises.rename(inputPath, archiveDest);
  }
}
```

### File-Based IPC Summary

| File | Purpose | Created By | Read By | Deleted By |
|------|---------|------------|---------|------------|
| `.reprocess-trigger` | Signal to start reprocessing | Admin API | Preprocessor | Preprocessor |
| `.reprocess-progress.json` | Track progress | Preprocessor | Admin API | Preprocessor |

### Edge Cases

1. **Preprocessor not running**: Trigger file waits until preprocessor starts
2. **Admin UI disconnects**: Progress file persists, can be polled later
3. **Process crash during reprocessing**: Trigger file remains, manual cleanup needed
4. **Empty raw directory**: Completes immediately with 0/0 progress

## Testing Checklist
- [ ] Create `.reprocess-trigger` manually - reprocessing starts
- [ ] Trigger via admin API - reprocessing starts
- [ ] `.reprocess-progress.json` updated after each image
- [ ] Progress shows correct completed/total counts
- [ ] Failed images logged but processing continues
- [ ] Progress includes failed count
- [ ] Files cleaned up after completion
- [ ] Second trigger during active reprocess - API returns 409
- [ ] Reprocessing uses latest config values (not cached)
- [ ] Large batch (100+ images) processes successfully
