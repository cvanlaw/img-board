const client = require('prom-client');

// Create a custom registry for preprocessor
const register = new client.Registry();

// Add default Node.js metrics with preprocessor prefix
client.collectDefaultMetrics({ register, prefix: 'imgboard_preprocessor_' });

// Images processed counter
const imagesProcessedTotal = new client.Counter({
  name: 'imgboard_images_processed_total',
  help: 'Total images successfully processed',
  registers: [register],
});

// Images failed counter
const imagesFailedTotal = new client.Counter({
  name: 'imgboard_images_failed_total',
  help: 'Total image processing failures',
  labelNames: ['reason'],
  registers: [register],
});

// Processing duration histogram
const processingDuration = new client.Histogram({
  name: 'imgboard_processing_duration_seconds',
  help: 'Image processing duration in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// Processing queue depth gauge
const processingQueueDepth = new client.Gauge({
  name: 'imgboard_processing_queue_depth',
  help: 'Number of images waiting to be processed',
  registers: [register],
});

// Image size histogram (output)
const imageSizeBytes = new client.Histogram({
  name: 'imgboard_image_size_bytes',
  help: 'Processed image file size in bytes',
  buckets: [10000, 50000, 100000, 250000, 500000, 1000000, 2500000],
  registers: [register],
});

// Compression ratio histogram
const compressionRatio = new client.Histogram({
  name: 'imgboard_compression_ratio',
  help: 'Ratio of original size to processed size',
  buckets: [1, 1.5, 2, 3, 4, 5, 10],
  registers: [register],
});

module.exports = {
  client,
  register,
  imagesProcessedTotal,
  imagesFailedTotal,
  processingDuration,
  processingQueueDepth,
  imageSizeBytes,
  compressionRatio,
};
