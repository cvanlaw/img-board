# Task 02: Image Preprocessor

## Description
Create the image preprocessing worker that watches a raw image directory, converts images to WebP format using Sharp, resizes them to target resolution, and moves them to the processed directory.

## Dependencies
- Task 01: Project Initialization (package.json with sharp, chokidar)

## Deliverables
- `preprocessor.js` - Image preprocessing worker

## Acceptance Criteria
- [ ] Watches raw image directory using Chokidar with `usePolling: true`
- [ ] Converts JPEG/PNG to WebP format
- [ ] Resizes images to configured target resolution (preserving aspect ratio)
- [ ] Moves processed images to configured output directory
- [ ] Handles original files per config (keep/delete/archive)
- [ ] Logs all processing operations (JSON format)
- [ ] Skips and logs corrupt/invalid images without crashing
- [ ] Runs as standalone process via `npm run preprocess`

## Implementation Details

### Chokidar Configuration
```javascript
const watcher = chokidar.watch(config.preprocessing.rawImagePath, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: true,
  usePolling: true,  // ESSENTIAL for NFS/CIFS
  interval: 1000
});
```

### Sharp Processing Pipeline
```javascript
async function processImage(inputPath, outputPath) {
  await sharp(inputPath)
    .webp({ quality: config.preprocessing.quality })
    .resize(config.preprocessing.targetWidth, config.preprocessing.targetHeight, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .toFile(outputPath);
}
```

### Logging Format
```javascript
const log = (level, message, data = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  }));
};
```

### File Handling
- Output filename: Keep original name with `.webp` extension
- Original file handling based on `keepOriginals` config:
  - If true and archivePath set: move to archive
  - If true and no archivePath: leave in place
  - If false: delete original after successful processing

### Error Handling
- Wrap Sharp operations in try/catch
- Log errors with file path and error message
- Continue processing remaining files on error
- Never crash the process on single file failure

## Testing Checklist
- [ ] Add JPEG to raw directory - converts to WebP
- [ ] Add PNG to raw directory - converts to WebP
- [ ] Verify output dimensions match config
- [ ] Verify aspect ratio preserved
- [ ] Verify original handled per config (kept/archived/deleted)
- [ ] Add corrupt image - logged and skipped
- [ ] Add unsupported format - logged and skipped
- [ ] Process runs continuously (doesn't exit)
- [ ] Multiple rapid file additions handled correctly
