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
  }, 90000); // 90s timeout for Docker build + container startup

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
    expect(res.status).toBe(404);
  });

  test('GET /images/:filename blocks non-image extensions', async () => {
    const res = await fetch(`${BASE_URL}/images/malicious.js`);
    expect(res.status).toBe(403);
  });
});
