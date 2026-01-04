---
id: 22
title: Integration Tests
depends_on: [21]
status: pending
---

# Task 22: Integration Tests

## Description

Create integration tests covering the 5 critical user journeys: slideshow display, real-time SSE updates, admin configuration, image upload/processing, and health checks. Tests run against a containerized application instance.

## Deliverables

- `tests/integration/slideshow.test.js` - Slideshow display journey tests
- `tests/integration/sse.test.js` - Server-Sent Events tests
- `tests/integration/admin.test.js` - Admin configuration tests
- `tests/integration/upload.test.js` - Image upload and processing tests
- `tests/integration/health.test.js` - Health check endpoint tests

## Acceptance Criteria

- [ ] slideshow.test.js tests image listing, serving, 404s, and security (path traversal, extension blocking)
- [ ] sse.test.js tests connection establishment and add event broadcasting
- [ ] admin.test.js tests config read, update, validation, and stats
- [ ] upload.test.js tests valid upload, invalid file rejection, and WebP processing
- [ ] health.test.js tests health endpoint returns ok status with uptime
- [ ] `npm run test:integration` passes all tests (runs sequentially with --runInBand)

## Implementation Details

### tests/integration/slideshow.test.js

```javascript
const {
  BASE_URL,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth,
  addProcessedImage,
  clearProcessedImages
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
    await new Promise(r => setTimeout(r, 2000));

    const res = await fetch(`${BASE_URL}/api/images`);
    const images = await res.json();

    expect(res.status).toBe(200);
    expect(images).toContain('photo1.webp');
    expect(images).toContain('photo2.webp');
  });

  test('GET /images/:filename serves image file', async () => {
    await addProcessedImage('serve-test.webp');
    await new Promise(r => setTimeout(r, 2000));

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

### tests/integration/sse.test.js

```javascript
const EventSource = require('eventsource');
const {
  BASE_URL,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth,
  addProcessedImage
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
    eventSource.addEventListener('connected', () => done());
    eventSource.onerror = () => done(new Error('SSE connection failed'));
  });

  test('SSE receives add event when image added', (done) => {
    eventSource = new EventSource(`${BASE_URL}/api/events`);

    eventSource.addEventListener('connected', async () => {
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

### tests/integration/admin.test.js

```javascript
const {
  BASE_URL,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth
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
  });

  test('POST /api/admin/config updates slideshowInterval', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideshowInterval: 8000 })
    });

    expect(res.status).toBe(200);

    const configRes = await fetch(`${BASE_URL}/api/admin/config`);
    const config = await configRes.json();
    expect(config.slideshowInterval).toBe(8000);
  });

  test('POST /api/admin/config rejects invalid slideshowInterval', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideshowInterval: 500 })
    });

    expect(res.status).toBe(400);
  });

  test('GET /api/admin/stats returns image counts', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/stats`);
    const stats = await res.json();

    expect(res.status).toBe(200);
    expect(typeof stats.raw).toBe('number');
    expect(typeof stats.processed).toBe('number');
  });
});
```

### tests/integration/upload.test.js

```javascript
const fs = require('fs').promises;
const path = require('path');
const {
  BASE_URL,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth,
  listProcessedImages
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
    formData.append('images', new Blob([imageBuffer], { type: 'image/jpeg' }), 'upload-test.jpg');

    const res = await fetch(`${BASE_URL}/api/admin/upload`, {
      method: 'POST',
      body: formData
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.success).toBe(true);
  });

  test('POST /api/admin/upload rejects invalid file type', async () => {
    const formData = new FormData();
    formData.append('images', new Blob(['not an image'], { type: 'text/plain' }), 'test.txt');

    const res = await fetch(`${BASE_URL}/api/admin/upload`, {
      method: 'POST',
      body: formData
    });

    expect(res.status).toBe(400);
  });

  test('uploaded image is processed to WebP', async () => {
    const imagePath = path.join(__dirname, '../fixtures/test-image.jpg');
    const imageBuffer = await fs.readFile(imagePath);

    const formData = new FormData();
    formData.append('images', new Blob([imageBuffer], { type: 'image/jpeg' }), 'process-test.jpg');

    await fetch(`${BASE_URL}/api/admin/upload`, { method: 'POST', body: formData });

    await new Promise(r => setTimeout(r, 5000));

    const processed = await listProcessedImages();
    const hasProcessed = processed.some(f => f.includes('process-test') && f.endsWith('.webp'));
    expect(hasProcessed).toBe(true);
  }, 15000);
});
```

### tests/integration/health.test.js

```javascript
const {
  BASE_URL,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth
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

## Testing Checklist

- [ ] `npm run test:integration` passes all tests
- [ ] Each test file can run independently
- [ ] No orphaned Docker containers after test run
- [ ] No leftover test-data directories after test run
- [ ] Tests complete within 5 minutes total
