# Testing Guide

This document describes how to implement unit and integration tests for the image slideshow application.

## Test Framework

Use **Jest** as the test runner with **supertest** for HTTP assertions.

```bash
npm install --save-dev jest supertest @types/jest
```

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration --runInBand"
  },
  "jest": {
    "testEnvironment": "node",
    "testTimeout": 30000,
    "setupFilesAfterEnv": ["./tests/setup.js"]
  }
}
```

## Directory Structure

```
tests/
├── setup.js              # Global test setup
├── fixtures/
│   ├── test-image.jpg    # Sample 100x100 JPEG
│   └── test-config.json  # Test configuration
├── unit/
│   ├── shuffle.test.js
│   ├── deepMerge.test.js
│   └── ipMatches.test.js
└── integration/
    ├── docker-compose.test.yml
    ├── api.test.js
    ├── slideshow.test.js
    └── admin.test.js
```

## Test Setup

### tests/setup.js

```javascript
const path = require('path');
const fs = require('fs').promises;

// Test directories (created fresh for each test run)
const TEST_DIR = path.join(__dirname, '.test-data');
const RAW_DIR = path.join(TEST_DIR, 'raw');
const PROCESSED_DIR = path.join(TEST_DIR, 'processed');
const ARCHIVE_DIR = path.join(TEST_DIR, 'archive');

beforeAll(async () => {
  // Create clean test directories
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(PROCESSED_DIR, { recursive: true });
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
});

afterAll(async () => {
  // Cleanup test directories
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});

module.exports = { TEST_DIR, RAW_DIR, PROCESSED_DIR, ARCHIVE_DIR };
```

---

## Unit Tests

Unit tests validate isolated functions without external dependencies. Extract testable functions into a `lib/` directory or test them via module exports.

### tests/unit/shuffle.test.js

```javascript
// Extract shuffleArray from server.js or import from lib/utils.js
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

describe('shuffleArray', () => {
  test('returns array with same elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffleArray(input);

    expect(result).toHaveLength(input.length);
    expect(result.sort()).toEqual(input.sort());
  });

  test('does not modify original array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffleArray(input);

    expect(input).toEqual(copy);
  });

  test('handles empty array', () => {
    expect(shuffleArray([])).toEqual([]);
  });

  test('handles single element', () => {
    expect(shuffleArray([1])).toEqual([1]);
  });
});
```

### tests/unit/deepMerge.test.js

```javascript
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] instanceof Object &&
      !Array.isArray(source[key]) &&
      key in target
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

describe('deepMerge', () => {
  test('merges top-level properties', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };

    expect(deepMerge(target, source)).toEqual({ a: 1, b: 3, c: 4 });
  });

  test('merges nested objects', () => {
    const target = { nested: { a: 1, b: 2 } };
    const source = { nested: { b: 3 } };

    expect(deepMerge(target, source)).toEqual({ nested: { a: 1, b: 3 } });
  });

  test('replaces arrays instead of merging', () => {
    const target = { arr: [1, 2, 3] };
    const source = { arr: [4, 5] };

    expect(deepMerge(target, source)).toEqual({ arr: [4, 5] });
  });

  test('does not modify original objects', () => {
    const target = { nested: { a: 1 } };
    const source = { nested: { b: 2 } };

    deepMerge(target, source);

    expect(target).toEqual({ nested: { a: 1 } });
    expect(source).toEqual({ nested: { b: 2 } });
  });
});
```

### tests/unit/ipMatches.test.js

```javascript
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

describe('ipMatches', () => {
  test('allows localhost IPv4', () => {
    expect(ipMatches('127.0.0.1', '192.168.1.0/24')).toBe(true);
  });

  test('allows localhost IPv6', () => {
    expect(ipMatches('::1', '192.168.1.0/24')).toBe(true);
  });

  test('strips IPv6-mapped IPv4 prefix', () => {
    expect(ipMatches('::ffff:192.168.1.50', '192.168.1.50')).toBe(true);
  });

  test('matches exact IP', () => {
    expect(ipMatches('192.168.1.100', '192.168.1.100')).toBe(true);
    expect(ipMatches('192.168.1.100', '192.168.1.101')).toBe(false);
  });

  test('matches /24 subnet', () => {
    expect(ipMatches('192.168.1.50', '192.168.1.0/24')).toBe(true);
    expect(ipMatches('192.168.1.255', '192.168.1.0/24')).toBe(true);
    expect(ipMatches('192.168.2.50', '192.168.1.0/24')).toBe(false);
  });

  test('rejects non-matching IP', () => {
    expect(ipMatches('10.0.0.5', '192.168.1.100')).toBe(false);
  });
});
```

---

## Integration Tests

Integration tests run against a containerized application instance.

### tests/integration/docker-compose.test.yml

```yaml
services:
  slideshow-test:
    build: ../..
    container_name: slideshow-test
    ports:
      - '3001:3000'
    volumes:
      - ./test-data/raw:/mnt/photos/raw
      - ./test-data/processed:/mnt/photos/processed
      - ./test-data/archive:/mnt/photos/archive
      - ./test-config.json:/app/config.json
    environment:
      - NODE_ENV=test
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:3000/health']
      interval: 2s
      timeout: 5s
      retries: 10
      start_period: 5s
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

### Integration Test Utilities

#### tests/integration/helpers.js

```javascript
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');

const TEST_PORT = 3001;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const COMPOSE_FILE = path.join(__dirname, 'docker-compose.test.yml');
const TEST_DATA_DIR = path.join(__dirname, 'test-data');

async function setupTestDirectories() {
  await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  await fs.mkdir(path.join(TEST_DATA_DIR, 'raw'), { recursive: true });
  await fs.mkdir(path.join(TEST_DATA_DIR, 'processed'), { recursive: true });
  await fs.mkdir(path.join(TEST_DATA_DIR, 'archive'), { recursive: true });

  // Copy test config
  await fs.copyFile(
    path.join(__dirname, '../fixtures/test-config.json'),
    path.join(__dirname, 'test-config.json')
  );
}

async function cleanupTestDirectories() {
  await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  try {
    await fs.unlink(path.join(__dirname, 'test-config.json'));
  } catch {}
}

function startContainer() {
  execSync(`docker compose -f ${COMPOSE_FILE} up -d --build --wait`, {
    stdio: 'pipe',
    timeout: 120000,
  });
}

function stopContainer() {
  execSync(`docker compose -f ${COMPOSE_FILE} down -v --remove-orphans`, {
    stdio: 'pipe',
  });
}

async function waitForHealth(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Container did not become healthy');
}

async function copyTestImage(filename = 'test-image.jpg') {
  const src = path.join(__dirname, '../fixtures', filename);
  const dest = path.join(TEST_DATA_DIR, 'raw', filename);
  await fs.copyFile(src, dest);
  return dest;
}

async function addProcessedImage(filename) {
  // Create a minimal valid WebP file or copy a fixture
  const dest = path.join(TEST_DATA_DIR, 'processed', filename);
  const src = path.join(__dirname, '../fixtures/test-image.webp');
  await fs.copyFile(src, dest);
  return dest;
}

async function listProcessedImages() {
  try {
    const files = await fs.readdir(path.join(TEST_DATA_DIR, 'processed'));
    return files.filter((f) => f.endsWith('.webp'));
  } catch {
    return [];
  }
}

async function clearProcessedImages() {
  const dir = path.join(TEST_DATA_DIR, 'processed');
  const files = await fs.readdir(dir);
  for (const file of files) {
    await fs.unlink(path.join(dir, file));
  }
}

module.exports = {
  BASE_URL,
  TEST_DATA_DIR,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth,
  copyTestImage,
  addProcessedImage,
  listProcessedImages,
  clearProcessedImages,
};
```

---

## Critical User Journey Tests

### Journey 1: Slideshow Displays Images

**Path:** User opens slideshow → sees images → images rotate

```javascript
// tests/integration/slideshow.test.js
const {
  BASE_URL,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth,
  addProcessedImage,
  clearProcessedImages,
} = require('./helpers');

describe('Slideshow Display', () => {
  beforeAll(async () => {
    await setupTestDirectories();
    startContainer();
    await waitForHealth();
  });

  afterAll(async () => {
    stopContainer();
    await cleanupTestDirectories();
  });

  beforeEach(async () => {
    await clearProcessedImages();
  });

  test('GET /api/images returns empty array when no images', async () => {
    const res = await fetch(`${BASE_URL}/api/images`);
    const images = await res.json();

    expect(res.status).toBe(200);
    expect(images).toEqual([]);
  });

  test('GET /api/images returns image filenames', async () => {
    await addProcessedImage('photo1.webp');
    await addProcessedImage('photo2.webp');

    // Wait for file watcher to detect changes
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(`${BASE_URL}/api/images`);
    const images = await res.json();

    expect(res.status).toBe(200);
    expect(images).toContain('photo1.webp');
    expect(images).toContain('photo2.webp');
  });

  test('GET /images/:filename serves image file', async () => {
    await addProcessedImage('serve-test.webp');
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(`${BASE_URL}/images/serve-test.webp`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image');
  });

  test('GET /images/:filename returns 404 for missing image', async () => {
    const res = await fetch(`${BASE_URL}/images/nonexistent.webp`);

    expect(res.status).toBe(404);
  });

  test('GET /images/:filename blocks path traversal', async () => {
    const res = await fetch(`${BASE_URL}/images/../config.json`);

    expect(res.status).toBe(403);
  });

  test('GET /images/:filename blocks non-image extensions', async () => {
    const res = await fetch(`${BASE_URL}/images/malicious.js`);

    expect(res.status).toBe(403);
  });
});
```

### Journey 2: Real-time Updates via SSE

**Path:** Client connects to SSE → image added → client receives event

```javascript
// tests/integration/sse.test.js
const EventSource = require('eventsource');
const {
  BASE_URL,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth,
  addProcessedImage,
} = require('./helpers');

describe('Server-Sent Events', () => {
  let eventSource;

  beforeAll(async () => {
    await setupTestDirectories();
    startContainer();
    await waitForHealth();
  });

  afterAll(async () => {
    stopContainer();
    await cleanupTestDirectories();
  });

  afterEach(() => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  });

  test('SSE connection receives connected event', (done) => {
    eventSource = new EventSource(`${BASE_URL}/api/events`);

    eventSource.addEventListener('connected', () => {
      done();
    });

    eventSource.onerror = (err) => {
      done(new Error('SSE connection failed'));
    };
  });

  test('SSE receives add event when image added', (done) => {
    eventSource = new EventSource(`${BASE_URL}/api/events`);

    eventSource.addEventListener('connected', async () => {
      // Add image after connection established
      await addProcessedImage('sse-test.webp');
    });

    eventSource.addEventListener('add', (event) => {
      const data = JSON.parse(event.data);
      expect(data.filename).toBe('sse-test.webp');
      done();
    });
  }, 15000);
});
```

### Journey 3: Admin Configuration

**Path:** Admin loads config → changes settings → saves → changes take effect

```javascript
// tests/integration/admin.test.js
const {
  BASE_URL,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth,
} = require('./helpers');

describe('Admin Configuration', () => {
  beforeAll(async () => {
    await setupTestDirectories();
    startContainer();
    await waitForHealth();
  });

  afterAll(async () => {
    stopContainer();
    await cleanupTestDirectories();
  });

  test('GET /api/admin/config returns current config', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/config`);
    const config = await res.json();

    expect(res.status).toBe(200);
    expect(config).toHaveProperty('slideshowInterval');
    expect(config).toHaveProperty('preprocessing');
    expect(config.preprocessing).toHaveProperty('quality');
  });

  test('POST /api/admin/config updates slideshowInterval', async () => {
    const newInterval = 8000;

    const res = await fetch(`${BASE_URL}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideshowInterval: newInterval }),
    });

    expect(res.status).toBe(200);

    // Verify change persisted
    const configRes = await fetch(`${BASE_URL}/api/admin/config`);
    const config = await configRes.json();
    expect(config.slideshowInterval).toBe(newInterval);
  });

  test('POST /api/admin/config rejects invalid slideshowInterval', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideshowInterval: 500 }),
    });

    expect(res.status).toBe(400);
  });

  test('POST /api/admin/config preserves nested properties on partial update', async () => {
    // Get current config
    const currentRes = await fetch(`${BASE_URL}/api/admin/config`);
    const currentConfig = await currentRes.json();
    const originalQuality = currentConfig.preprocessing.quality;

    // Update only targetWidth
    await fetch(`${BASE_URL}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preprocessing: { targetWidth: 1280 } }),
    });

    // Verify quality unchanged
    const updatedRes = await fetch(`${BASE_URL}/api/admin/config`);
    const updatedConfig = await updatedRes.json();

    expect(updatedConfig.preprocessing.quality).toBe(originalQuality);
    expect(updatedConfig.preprocessing.targetWidth).toBe(1280);
  });

  test('GET /api/admin/stats returns image counts', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/stats`);
    const stats = await res.json();

    expect(res.status).toBe(200);
    expect(stats).toHaveProperty('raw');
    expect(stats).toHaveProperty('processed');
    expect(typeof stats.raw).toBe('number');
    expect(typeof stats.processed).toBe('number');
  });
});
```

### Journey 4: Image Upload and Processing

**Path:** Admin uploads image → preprocessor converts → image appears in slideshow

```javascript
// tests/integration/upload.test.js
const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const {
  BASE_URL,
  TEST_DATA_DIR,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth,
  listProcessedImages,
} = require('./helpers');

describe('Image Upload and Processing', () => {
  beforeAll(async () => {
    await setupTestDirectories();
    startContainer();
    await waitForHealth();
  });

  afterAll(async () => {
    stopContainer();
    await cleanupTestDirectories();
  });

  test('POST /api/admin/upload accepts valid image', async () => {
    const imagePath = path.join(__dirname, '../fixtures/test-image.jpg');
    const imageBuffer = await fs.readFile(imagePath);

    const formData = new FormData();
    formData.append(
      'images',
      new Blob([imageBuffer], { type: 'image/jpeg' }),
      'upload-test.jpg'
    );

    const res = await fetch(`${BASE_URL}/api/admin/upload`, {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.success).toBe(true);
    expect(result.uploaded).toHaveLength(1);
  });

  test('POST /api/admin/upload rejects invalid file type', async () => {
    const formData = new FormData();
    formData.append(
      'images',
      new Blob(['not an image'], { type: 'text/plain' }),
      'test.txt'
    );

    const res = await fetch(`${BASE_URL}/api/admin/upload`, {
      method: 'POST',
      body: formData,
    });

    expect(res.status).toBe(400);
  });

  test('uploaded image is processed to WebP', async () => {
    const imagePath = path.join(__dirname, '../fixtures/test-image.jpg');
    const imageBuffer = await fs.readFile(imagePath);

    const formData = new FormData();
    formData.append(
      'images',
      new Blob([imageBuffer], { type: 'image/jpeg' }),
      'process-test.jpg'
    );

    await fetch(`${BASE_URL}/api/admin/upload`, {
      method: 'POST',
      body: formData,
    });

    // Wait for preprocessing (file watcher + Sharp processing)
    await new Promise((r) => setTimeout(r, 5000));

    const processed = await listProcessedImages();
    const hasProcessed = processed.some(
      (f) => f.includes('process-test') && f.endsWith('.webp')
    );

    expect(hasProcessed).toBe(true);
  }, 15000);
});
```

### Journey 5: Health Check

**Path:** Monitoring system checks health endpoint → receives OK status

```javascript
// tests/integration/health.test.js
const {
  BASE_URL,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth,
} = require('./helpers');

describe('Health Check', () => {
  beforeAll(async () => {
    await setupTestDirectories();
    startContainer();
    await waitForHealth();
  });

  afterAll(async () => {
    stopContainer();
    await cleanupTestDirectories();
  });

  test('GET /health returns ok status', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const health = await res.json();

    expect(res.status).toBe(200);
    expect(health.status).toBe('ok');
    expect(typeof health.uptime).toBe('number');
    expect(health.uptime).toBeGreaterThan(0);
  });
});
```

---

## Running Tests

### Prerequisites

1. Docker and Docker Compose installed
2. Node.js 20+
3. Test fixtures in `tests/fixtures/`

### Create Test Fixtures

```bash
# Create a small test JPEG (requires ImageMagick)
convert -size 100x100 xc:blue tests/fixtures/test-image.jpg

# Create a small test WebP
convert -size 100x100 xc:red tests/fixtures/test-image.webp
```

### Run Tests

```bash
# All tests
npm test

# Unit tests only (fast, no Docker)
npm run test:unit

# Integration tests only (requires Docker)
npm run test:integration

# Watch mode for unit tests
npm run test:unit -- --watch
```

### CI Pipeline

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:integration
```

---

## Test Principles

### Idempotency

Every test must produce the same result regardless of:

- Previous test runs
- Order of execution
- Parallel execution (for unit tests)

Achieved by:

- Creating fresh directories in `beforeAll`
- Cleaning up in `afterAll`
- Resetting state in `beforeEach` when needed

### Cleanup

Tests clean up after themselves:

- Docker containers stopped via `docker compose down`
- Test data directories removed
- Temporary files deleted
- No orphaned processes

### Critical Journeys Focus

Tests cover paths users actually take:

1. **Viewing slideshow** - Core functionality
2. **Real-time updates** - SSE reliability
3. **Admin configuration** - Settings management
4. **Image upload** - Content management
5. **Health monitoring** - Operational visibility

Avoid testing:

- Implementation details
- Edge cases unlikely to occur
- Framework behavior (Express routing, etc.)
