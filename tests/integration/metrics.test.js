const {
  BASE_URL,
  setupTestDirectories,
  cleanupTestDirectories,
  startContainer,
  stopContainer,
  waitForHealth,
} = require('./helpers');

describe('Metrics Endpoint', () => {
  beforeAll(async () => {
    await setupTestDirectories();
    startContainer();
    await waitForHealth();
  }, 90000);

  afterAll(async () => {
    stopContainer();
    await cleanupTestDirectories();
  });

  test('GET /metrics returns Prometheus format', async () => {
    const res = await fetch(`${BASE_URL}/metrics`);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    expect(text).toContain('imgboard_http_request_duration_seconds');
    expect(text).toContain('imgboard_sse_clients_connected');
    expect(text).toContain('imgboard_errors_total');
  });

  test('GET /metrics includes Node.js default metrics', async () => {
    const res = await fetch(`${BASE_URL}/metrics`);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain('process_cpu_seconds_total');
    expect(text).toContain('process_resident_memory_bytes');
    expect(text).toContain('nodejs_heap_size_total_bytes');
  });
});
