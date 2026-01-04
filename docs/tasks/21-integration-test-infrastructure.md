---
id: 21
title: Integration Test Infrastructure
depends_on: [18, 19]
status: pending
---

# Task 21: Integration Test Infrastructure

## Description

Create the Docker Compose configuration and helper utilities for running integration tests against a containerized application instance. Tests run on port 3001 to avoid conflicts with development.

## Deliverables

- `tests/integration/docker-compose.test.yml` - Test container configuration
- `tests/integration/helpers.js` - Container lifecycle and test utilities

## Acceptance Criteria

- [ ] docker-compose.test.yml builds and runs container on port 3001
- [ ] helpers.js provides setupTestDirectories() and cleanupTestDirectories()
- [ ] helpers.js provides startContainer() and stopContainer()
- [ ] helpers.js provides waitForHealth() with configurable timeout
- [ ] helpers.js provides image manipulation utilities (addProcessedImage, copyTestImage, etc.)

## Implementation Details

### tests/integration/docker-compose.test.yml

```yaml
services:
  slideshow-test:
    build: ../..
    container_name: slideshow-test
    ports:
      - "3001:3000"
    volumes:
      - ./test-data/raw:/mnt/photos/raw
      - ./test-data/processed:/mnt/photos/processed
      - ./test-data/archive:/mnt/photos/archive
      - ./test-config.json:/app/config.json
    environment:
      - NODE_ENV=test
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 2s
      timeout: 5s
      retries: 10
      start_period: 5s
```

### tests/integration/helpers.js

```javascript
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

const TEST_PORT = 3001;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const COMPOSE_FILE = path.join(__dirname, 'docker-compose.test.yml');
const TEST_DATA_DIR = path.join(__dirname, 'test-data');

async function setupTestDirectories() {
  await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  await fs.mkdir(path.join(TEST_DATA_DIR, 'raw'), { recursive: true });
  await fs.mkdir(path.join(TEST_DATA_DIR, 'processed'), { recursive: true });
  await fs.mkdir(path.join(TEST_DATA_DIR, 'archive'), { recursive: true });

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
    timeout: 120000
  });
}

function stopContainer() {
  execSync(`docker compose -f ${COMPOSE_FILE} down -v --remove-orphans`, {
    stdio: 'pipe'
  });
}

async function waitForHealth(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
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
  const dest = path.join(TEST_DATA_DIR, 'processed', filename);
  const src = path.join(__dirname, '../fixtures/test-image.webp');
  await fs.copyFile(src, dest);
  return dest;
}

async function listProcessedImages() {
  try {
    const files = await fs.readdir(path.join(TEST_DATA_DIR, 'processed'));
    return files.filter(f => f.endsWith('.webp'));
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
  clearProcessedImages
};
```

## Testing Checklist

- [ ] `docker compose -f tests/integration/docker-compose.test.yml up -d --build` succeeds
- [ ] Container responds on http://localhost:3001/health
- [ ] `docker compose -f tests/integration/docker-compose.test.yml down -v` cleans up
- [ ] helpers.js exports all required functions
- [ ] Test data directories created and cleaned up correctly
