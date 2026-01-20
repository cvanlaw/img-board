const {
  BASE_URL,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth,
  addProcessedImage,
} = require('./helpers');

describe('Image Rotation', () => {
  beforeAll(async () => {
    await setupTestDirectories();
    startContainer();
    await waitForHealth();
  }, 90000);

  afterAll(async () => {
    stopContainer();
    await cleanupTestDirectories();
  });

  describe('POST /api/admin/images/:filename/rotate', () => {
    test('rotates image clockwise', async () => {
      await addProcessedImage('rotate-test-cw.webp');

      // Wait for file watcher to pick up the image
      await new Promise((r) => setTimeout(r, 2000));

      const res = await fetch(
        `${BASE_URL}/api/admin/images/rotate-test-cw.webp/rotate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction: 'cw' }),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.filename).toBe('rotate-test-cw.webp');
    });

    test('rotates image counter-clockwise', async () => {
      await addProcessedImage('rotate-test-ccw.webp');

      // Wait for file watcher to pick up the image
      await new Promise((r) => setTimeout(r, 2000));

      const res = await fetch(
        `${BASE_URL}/api/admin/images/rotate-test-ccw.webp/rotate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction: 'ccw' }),
        }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test('returns 400 for invalid direction', async () => {
      await addProcessedImage('rotate-test-invalid.webp');
      await new Promise((r) => setTimeout(r, 2000));

      const res = await fetch(
        `${BASE_URL}/api/admin/images/rotate-test-invalid.webp/rotate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction: 'up' }),
        }
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('direction');
    });

    test('returns 404 for non-existent image', async () => {
      const res = await fetch(
        `${BASE_URL}/api/admin/images/nonexistent.webp/rotate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction: 'cw' }),
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/images/bulk with rotation', () => {
    test('bulk rotates multiple images clockwise', async () => {
      await addProcessedImage('bulk-rotate-1.webp');
      await addProcessedImage('bulk-rotate-2.webp');
      await new Promise((r) => setTimeout(r, 2000));

      const res = await fetch(`${BASE_URL}/api/admin/images/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rotate-cw',
          filenames: ['bulk-rotate-1.webp', 'bulk-rotate-2.webp'],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.results).toHaveLength(2);
      expect(data.results.every((r) => r.success)).toBe(true);
    });

    test('bulk rotates multiple images counter-clockwise', async () => {
      await addProcessedImage('bulk-rotate-ccw-1.webp');
      await addProcessedImage('bulk-rotate-ccw-2.webp');
      await new Promise((r) => setTimeout(r, 2000));

      const res = await fetch(`${BASE_URL}/api/admin/images/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rotate-ccw',
          filenames: ['bulk-rotate-ccw-1.webp', 'bulk-rotate-ccw-2.webp'],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    test('handles mixed success/failure in bulk rotation', async () => {
      await addProcessedImage('bulk-rotate-exists.webp');
      await new Promise((r) => setTimeout(r, 2000));

      const res = await fetch(`${BASE_URL}/api/admin/images/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rotate-cw',
          filenames: ['bulk-rotate-exists.webp', 'does-not-exist.webp'],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(false); // Not all succeeded
      expect(data.results).toHaveLength(2);

      const successResult = data.results.find(
        (r) => r.filename === 'bulk-rotate-exists.webp'
      );
      const failResult = data.results.find(
        (r) => r.filename === 'does-not-exist.webp'
      );

      expect(successResult.success).toBe(true);
      expect(failResult.success).toBe(false);
    });
  });
});
