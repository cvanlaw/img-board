describe('preprocessor-metrics module', () => {
  let metrics;

  beforeEach(() => {
    const { register } = require('prom-client');
    register.clear();
    jest.resetModules();
    metrics = require('../../lib/preprocessor-metrics');
  });

  it('exports a Prometheus registry', () => {
    expect(metrics.register).toBeDefined();
    expect(typeof metrics.register.metrics).toBe('function');
  });

  it('exports client (prom-client module)', () => {
    expect(metrics.client).toBeDefined();
    expect(metrics.client.Counter).toBeDefined();
  });

  it('exports imagesProcessedTotal counter', () => {
    expect(metrics.imagesProcessedTotal).toBeDefined();
    expect(metrics.imagesProcessedTotal.name).toBe(
      'imgboard_images_processed_total'
    );
  });

  it('exports imagesFailedTotal counter', () => {
    expect(metrics.imagesFailedTotal).toBeDefined();
    expect(metrics.imagesFailedTotal.name).toBe('imgboard_images_failed_total');
  });

  it('exports processingDuration histogram', () => {
    expect(metrics.processingDuration).toBeDefined();
    expect(metrics.processingDuration.name).toBe(
      'imgboard_processing_duration_seconds'
    );
  });

  it('exports processingQueueDepth gauge', () => {
    expect(metrics.processingQueueDepth).toBeDefined();
    expect(metrics.processingQueueDepth.name).toBe(
      'imgboard_processing_queue_depth'
    );
  });

  it('exports imageSizeBytes histogram', () => {
    expect(metrics.imageSizeBytes).toBeDefined();
    expect(metrics.imageSizeBytes.name).toBe('imgboard_image_size_bytes');
  });

  it('exports compressionRatio histogram', () => {
    expect(metrics.compressionRatio).toBeDefined();
    expect(metrics.compressionRatio.name).toBe('imgboard_compression_ratio');
  });
});
