# Observability Design

## Overview

Add comprehensive observability to img-board for operational visibility and performance optimization using Prometheus metrics and Grafana dashboards.

## Goals

- **Operational visibility**: Know when things break, monitor health, debug issues in production
- **Performance optimization**: Find bottlenecks in image processing, identify slow operations

Non-goals: Usage analytics, engagement patterns, view popularity tracking.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose Network                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │  img-board   │     │  prometheus  │     │   grafana    │ │
│  │              │     │              │     │              │ │
│  │ server:3000  │◄────│   :9090      │     │    :3001     │ │
│  │ metrics:9091 │◄────│   scrapes    │◄────│  dashboards  │ │
│  │ preproc:9092 │◄────│   /metrics   │     │              │ │
│  └──────────────┘     └──────────────┘     └──────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Port Assignments

| Port | Purpose                                                         |
| ---- | --------------------------------------------------------------- |
| 3000 | Main app (slideshow, admin, API) + server metrics at `/metrics` |
| 9092 | Preprocessor metrics only (internal, not exposed to host)       |
| 9090 | Prometheus UI (exposed to host for debugging)                   |
| 3001 | Grafana UI (exposed to host)                                    |

### Scrape Configuration

- Prometheus scrapes `img-board:3000/metrics` every 15s (server process)
- Prometheus scrapes `img-board:9092/metrics` every 15s (preprocessor process)
- Data retention: 15 days (configurable)

## Metrics

### Server Process Metrics (`server.js`)

| Metric                                   | Type      | Description                                 |
| ---------------------------------------- | --------- | ------------------------------------------- |
| `imgboard_server_uptime_seconds`         | Gauge     | Process uptime                              |
| `imgboard_http_requests_total`           | Counter   | Total requests by method, route, status     |
| `imgboard_http_request_duration_seconds` | Histogram | Request latency (buckets: 10ms to 10s)      |
| `imgboard_sse_clients_connected`         | Gauge     | Current SSE client count                    |
| `imgboard_sse_broadcasts_total`          | Counter   | SSE events sent by type (add/remove/config) |
| `imgboard_images_served_total`           | Counter   | Image file serves                           |
| `imgboard_errors_total`                  | Counter   | Errors by source (api, sse, watcher)        |

### Preprocessor Metrics (`preprocessor.js`)

| Metric                                 | Type      | Description                            |
| -------------------------------------- | --------- | -------------------------------------- |
| `imgboard_preprocessor_uptime_seconds` | Gauge     | Process uptime                         |
| `imgboard_images_processed_total`      | Counter   | Images successfully processed          |
| `imgboard_images_failed_total`         | Counter   | Processing failures by reason          |
| `imgboard_processing_duration_seconds` | Histogram | Time per image (buckets: 100ms to 60s) |
| `imgboard_processing_queue_depth`      | Gauge     | Pending images awaiting processing     |
| `imgboard_image_size_bytes`            | Histogram | Output file sizes                      |
| `imgboard_compression_ratio`           | Histogram | Original size / processed size         |

### Node.js Default Metrics (both processes)

Enabled via `prom-client`'s `collectDefaultMetrics()`:

- `process_cpu_seconds_total`
- `process_resident_memory_bytes`
- `nodejs_heap_size_*`
- `nodejs_eventloop_lag_seconds`

## Implementation

### Dependencies

- `prom-client` - Prometheus client for Node.js (only new dependency)

### Server Instrumentation (`server.js`)

```javascript
const client = require('prom-client');

// Enable default Node.js metrics
client.collectDefaultMetrics({ prefix: 'imgboard_' });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'imgboard_http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

// Express middleware for automatic request timing
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
    });
  });
  next();
});

// Endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

### Preprocessor Instrumentation (`preprocessor.js`)

Minimal HTTP server for metrics endpoint:

```javascript
const http = require('http');
const client = require('prom-client');

client.collectDefaultMetrics({ prefix: 'imgboard_preprocessor_' });

http
  .createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', client.register.contentType);
      res.end(await client.register.metrics());
    } else {
      res.statusCode = 404;
      res.end();
    }
  })
  .listen(9092);
```

Processing instrumented by wrapping the Sharp pipeline with timer start/end calls.

## Grafana Dashboard

**Dashboard: "img-board Overview"**

### Row 1: Health at a Glance (4 stat panels)

- Server uptime
- Preprocessor uptime
- Current SSE clients
- Error rate (last 5 min)

### Row 2: Image Processing (4 panels)

- Processing throughput (images/minute graph)
- Processing duration (p50, p95, p99 time series)
- Queue depth (gauge with thresholds: green < 10, yellow < 50, red >= 50)
- Compression ratio distribution (histogram)

### Row 3: Server Performance (3 panels)

- Request rate by route (stacked graph)
- Request latency by route (heatmap)
- SSE broadcasts by type (stacked graph)

### Row 4: Resource Usage (4 panels)

- Memory usage (server + preprocessor overlaid)
- CPU usage (both processes)
- Heap used vs heap total (both processes)
- Event loop lag (both processes)

### Row 5: Errors (2 panels)

- Error count by source (table, last 24h)
- Error rate over time (graph with annotations)

Dashboard JSON auto-loaded via Grafana provisioning.

## Alert Rules

### Critical Alerts (immediate attention)

| Alert               | Condition                                                                                   | For | Description                            |
| ------------------- | ------------------------------------------------------------------------------------------- | --- | -------------------------------------- |
| `PreprocessorDown`  | `up{job="preprocessor"} == 0`                                                               | 1m  | Preprocessor not responding to scrapes |
| `ServerDown`        | `up{job="server"} == 0`                                                                     | 1m  | Server not responding to scrapes       |
| `HighErrorRate`     | `rate(imgboard_errors_total[5m]) > 0.1`                                                     | 2m  | More than 6 errors/minute sustained    |
| `ProcessingStalled` | `rate(imgboard_images_processed_total[10m]) == 0` AND `imgboard_processing_queue_depth > 0` | 5m  | Queue has items but nothing processing |

### Warning Alerts (investigate soon)

| Alert             | Condition                                                             | For | Description                               |
| ----------------- | --------------------------------------------------------------------- | --- | ----------------------------------------- |
| `HighMemoryUsage` | `process_resident_memory_bytes > 500MB`                               | 5m  | Memory above 500MB sustained              |
| `SlowProcessing`  | `histogram_quantile(0.95, imgboard_processing_duration_seconds) > 30` | 5m  | 95th percentile processing > 30s          |
| `LargeQueueDepth` | `imgboard_processing_queue_depth > 50`                                | 5m  | Backlog building up                       |
| `NoSSEClients`    | `imgboard_sse_clients_connected == 0`                                 | 10m | No slideshows connected (may be expected) |

### Alert Delivery

Configured via Grafana alerting. Default contact point sends to Grafana's built-in alert list. Users can add email/Slack/webhook integrations post-deployment.

## File Structure

```
monitoring/
├── prometheus/
│   └── prometheus.yml          # Scrape config
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── prometheus.yml  # Auto-configure Prometheus datasource
│   │   └── dashboards/
│   │       └── dashboards.yml  # Dashboard provisioning config
│   ├── dashboards/
│   │   └── img-board.json      # Main dashboard
│   └── alerting/
│       └── alerts.yml          # Alert rules
└── README.md                   # Observability documentation
```

## Docker Compose Changes

```yaml
services:
  # Existing img-board service - add metrics port exposure
  img-board:
    # ... existing config ...
    expose:
      - '9092' # Preprocessor metrics (internal only)

  prometheus:
    image: prom/prometheus:v2.50.1
    volumes:
      - ./monitoring/prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=15d'
    ports:
      - '9090:9090'

  grafana:
    image: grafana/grafana:10.3.3
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin # Change in production
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
    ports:
      - '3001:3000'

volumes:
  prometheus_data:
  grafana_data:
```

## Testing Strategy

- Unit tests for metric helper functions
- Integration tests verify `/metrics` endpoints return valid Prometheus format
- Manual verification of dashboard panels during development
- Alert rule testing via Prometheus unit test framework
