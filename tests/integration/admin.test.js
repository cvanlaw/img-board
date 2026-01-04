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
  });

  test('POST /api/admin/config updates slideshowInterval', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideshowInterval: 8000 }),
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
      body: JSON.stringify({ slideshowInterval: 500 }),
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
