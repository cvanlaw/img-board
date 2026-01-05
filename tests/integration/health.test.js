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
  }, 90000); // 90s timeout for Docker build + container startup

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
