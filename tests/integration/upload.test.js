const fs = require('fs').promises;
const path = require('path');
const {
  BASE_URL,
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

    await new Promise((r) => setTimeout(r, 5000));

    const processed = await listProcessedImages();
    const hasProcessed = processed.some(
      (f) => f.includes('process-test') && f.endsWith('.webp')
    );
    expect(hasProcessed).toBe(true);
  }, 15000);
});
