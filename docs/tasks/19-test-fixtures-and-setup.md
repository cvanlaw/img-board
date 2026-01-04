---
id: 19
title: Test Fixtures and Setup
depends_on: [18]
status: pending
---

# Task 19: Test Fixtures and Setup

## Description

Create test fixtures including sample images and test configuration, plus the global test setup file that manages test directory lifecycle for idempotent test runs.

## Deliverables

- `tests/setup.js` - Global test setup with directory management
- `tests/fixtures/test-image.jpg` - Sample 100x100 JPEG image
- `tests/fixtures/test-image.webp` - Sample 100x100 WebP image
- `tests/fixtures/test-config.json` - Test configuration file

## Acceptance Criteria

- [ ] tests/setup.js creates fresh test directories in beforeAll
- [ ] tests/setup.js cleans up test directories in afterAll
- [ ] Test images are valid image files (100x100 pixels minimum)
- [ ] test-config.json contains valid configuration with randomOrder: false
- [ ] Setup exports TEST_DIR, RAW_DIR, PROCESSED_DIR, ARCHIVE_DIR constants

## Implementation Details

### tests/setup.js

```javascript
const path = require('path');
const fs = require('fs').promises;

const TEST_DIR = path.join(__dirname, '.test-data');
const RAW_DIR = path.join(TEST_DIR, 'raw');
const PROCESSED_DIR = path.join(TEST_DIR, 'processed');
const ARCHIVE_DIR = path.join(TEST_DIR, 'archive');

beforeAll(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(PROCESSED_DIR, { recursive: true });
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});

module.exports = { TEST_DIR, RAW_DIR, PROCESSED_DIR, ARCHIVE_DIR };
```

### tests/fixtures/test-config.json

```json
{
  "preprocessing": {
    "enabled": true,
    "rawImagePath": "/mnt/photos/raw",
    "processedImagePath": "/mnt/photos/processed",
    "inputExtensions": [".jpg", ".jpeg", ".png"],
    "outputFormat": "webp",
    "quality": 85,
    "targetWidth": 1920,
    "targetHeight": 1080,
    "keepOriginals": true,
    "archivePath": "/mnt/photos/archive"
  },
  "imagePath": "/mnt/photos/processed",
  "imageExtensions": [".webp"],
  "slideshowInterval": 5000,
  "randomOrder": false,
  "reshuffleInterval": 0,
  "port": 3000,
  "admin": {
    "enabled": true,
    "allowedIPs": []
  }
}
```

### Creating Test Images

```bash
# Using ImageMagick
convert -size 100x100 xc:blue tests/fixtures/test-image.jpg
convert -size 100x100 xc:red tests/fixtures/test-image.webp

# Or using Sharp in Node.js
const sharp = require('sharp');
await sharp({ create: { width: 100, height: 100, channels: 3, background: 'blue' } })
  .jpeg().toFile('tests/fixtures/test-image.jpg');
await sharp({ create: { width: 100, height: 100, channels: 3, background: 'red' } })
  .webp().toFile('tests/fixtures/test-image.webp');
```

## Testing Checklist

- [ ] Run `npm test` - setup.js executes without errors
- [ ] Verify test-image.jpg opens in image viewer
- [ ] Verify test-image.webp opens in image viewer
- [ ] Verify .test-data directory is cleaned up after test run
