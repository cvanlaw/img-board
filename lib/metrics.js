const client = require('prom-client');

// Create a custom registry
const register = new client.Registry();

// Add default Node.js metrics
client.collectDefaultMetrics({ register, prefix: 'imgboard_' });

// HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
  name: 'imgboard_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// SSE clients gauge
const sseClientsConnected = new client.Gauge({
  name: 'imgboard_sse_clients_connected',
  help: 'Number of connected SSE clients',
  registers: [register],
});

// SSE broadcasts counter
const sseBroadcastsTotal = new client.Counter({
  name: 'imgboard_sse_broadcasts_total',
  help: 'Total SSE broadcasts by event type',
  labelNames: ['event'],
  registers: [register],
});

// Images served counter
const imagesServedTotal = new client.Counter({
  name: 'imgboard_images_served_total',
  help: 'Total images served',
  registers: [register],
});

// Error counter
const errorsTotal = new client.Counter({
  name: 'imgboard_errors_total',
  help: 'Total errors by source',
  labelNames: ['source'],
  registers: [register],
});

module.exports = {
  client,
  register,
  httpRequestDuration,
  sseClientsConnected,
  sseBroadcastsTotal,
  imagesServedTotal,
  errorsTotal,
};
