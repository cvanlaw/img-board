describe('metrics module', () => {
  let metrics;

  beforeEach(() => {
    // Clear registry between tests
    const { register } = require('prom-client');
    register.clear();
    jest.resetModules();
    metrics = require('../../lib/metrics');
  });

  it('exports a Prometheus registry', () => {
    // Check it has registry methods rather than instanceof (which fails across module reloads)
    expect(metrics.register).toBeDefined();
    expect(typeof metrics.register.metrics).toBe('function');
    expect(typeof metrics.register.getSingleMetric).toBe('function');
  });

  it('exports httpRequestDuration histogram', () => {
    expect(metrics.httpRequestDuration).toBeDefined();
    expect(metrics.httpRequestDuration.name).toBe(
      'imgboard_http_request_duration_seconds'
    );
  });

  it('exports sseClientsConnected gauge', () => {
    expect(metrics.sseClientsConnected).toBeDefined();
    expect(metrics.sseClientsConnected.name).toBe(
      'imgboard_sse_clients_connected'
    );
  });

  it('exports errorsTotal counter', () => {
    expect(metrics.errorsTotal).toBeDefined();
    expect(metrics.errorsTotal.name).toBe('imgboard_errors_total');
  });

  it('can increment error counter with labels', async () => {
    metrics.errorsTotal.inc({ source: 'api' });
    const result = await metrics.errorsTotal.get();
    expect(result.values.length).toBeGreaterThan(0);
  });

  it('exports client (prom-client module)', () => {
    expect(metrics.client).toBeDefined();
    expect(metrics.client.Counter).toBeDefined();
    expect(metrics.client.Gauge).toBeDefined();
  });

  it('exports sseBroadcastsTotal counter', () => {
    expect(metrics.sseBroadcastsTotal).toBeDefined();
    expect(metrics.sseBroadcastsTotal.name).toBe(
      'imgboard_sse_broadcasts_total'
    );
  });

  it('exports imagesServedTotal counter', () => {
    expect(metrics.imagesServedTotal).toBeDefined();
    expect(metrics.imagesServedTotal.name).toBe('imgboard_images_served_total');
  });
});
