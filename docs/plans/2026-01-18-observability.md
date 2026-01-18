# Observability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Prometheus metrics and Grafana dashboards for operational visibility and performance optimization.

**Architecture:** Both server.js and preprocessor.js expose `/metrics` endpoints (ports 3000 and 9092). Prometheus scrapes both, Grafana visualizes with pre-built dashboards and alerts.

**Tech Stack:** prom-client, Prometheus 2.50.1, Grafana 10.3.3

---

## Task 1: Add prom-client Dependency

**Files:**
- Modify: `package.json:6-11`

**Step 1: Install prom-client**

Run: `npm install prom-client`

Expected: Package added to dependencies

**Step 2: Verify installation**

Run: `npm ls prom-client`

Expected: `prom-client@15.x.x` (or similar recent version)

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add prom-client for Prometheus metrics"
```

---

## Task 2: Create Metrics Module

**Files:**
- Create: `lib/metrics.js`
- Test: `tests/unit/metrics.test.js`

**Step 1: Write the test**

Create `tests/unit/metrics.test.js`:

```javascript
const { Registry } = require('prom-client');

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
    expect(metrics.register).toBeInstanceOf(Registry);
  });

  it('exports httpRequestDuration histogram', () => {
    expect(metrics.httpRequestDuration).toBeDefined();
    expect(metrics.httpRequestDuration.name).toBe('imgboard_http_request_duration_seconds');
  });

  it('exports sseClientsConnected gauge', () => {
    expect(metrics.sseClientsConnected).toBeDefined();
    expect(metrics.sseClientsConnected.name).toBe('imgboard_sse_clients_connected');
  });

  it('exports errorsTotal counter', () => {
    expect(metrics.errorsTotal).toBeDefined();
    expect(metrics.errorsTotal.name).toBe('imgboard_errors_total');
  });

  it('can increment error counter with labels', () => {
    metrics.errorsTotal.inc({ source: 'api' });
    expect(metrics.errorsTotal.get().values.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --testPathPatterns=metrics`

Expected: FAIL - Cannot find module '../../lib/metrics'

**Step 3: Write minimal implementation**

Create `lib/metrics.js`:

```javascript
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
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- --testPathPatterns=metrics`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/metrics.js tests/unit/metrics.test.js
git commit -m "feat: add metrics module with Prometheus counters and gauges"
```

---

## Task 3: Create Preprocessor Metrics Module

**Files:**
- Create: `lib/preprocessor-metrics.js`
- Test: `tests/unit/preprocessor-metrics.test.js`

**Step 1: Write the test**

Create `tests/unit/preprocessor-metrics.test.js`:

```javascript
const { Registry } = require('prom-client');

describe('preprocessor-metrics module', () => {
  let metrics;

  beforeEach(() => {
    const { register } = require('prom-client');
    register.clear();
    jest.resetModules();
    metrics = require('../../lib/preprocessor-metrics');
  });

  it('exports a Prometheus registry', () => {
    expect(metrics.register).toBeInstanceOf(Registry);
  });

  it('exports imagesProcessedTotal counter', () => {
    expect(metrics.imagesProcessedTotal).toBeDefined();
    expect(metrics.imagesProcessedTotal.name).toBe('imgboard_images_processed_total');
  });

  it('exports processingDuration histogram', () => {
    expect(metrics.processingDuration).toBeDefined();
    expect(metrics.processingDuration.name).toBe('imgboard_processing_duration_seconds');
  });

  it('exports processingQueueDepth gauge', () => {
    expect(metrics.processingQueueDepth).toBeDefined();
    expect(metrics.processingQueueDepth.name).toBe('imgboard_processing_queue_depth');
  });

  it('exports imageSizeBytes histogram', () => {
    expect(metrics.imageSizeBytes).toBeDefined();
    expect(metrics.imageSizeBytes.name).toBe('imgboard_image_size_bytes');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- --testPathPatterns=preprocessor-metrics`

Expected: FAIL - Cannot find module

**Step 3: Write minimal implementation**

Create `lib/preprocessor-metrics.js`:

```javascript
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
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- --testPathPatterns=preprocessor-metrics`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/preprocessor-metrics.js tests/unit/preprocessor-metrics.test.js
git commit -m "feat: add preprocessor metrics module"
```

---

## Task 4: Instrument Server with Metrics

**Files:**
- Modify: `server.js:1-12` (imports)
- Modify: `server.js:104-108` (middleware)
- Modify: `server.js:115-119` (broadcast function)
- Modify: `server.js:121-136` (SSE endpoint)
- Modify: `server.js:138-143` (health endpoint)
- Modify: `server.js:804-840` (image serving)

**Step 1: Add metrics import to server.js**

Add after line 9 (after utils import):

```javascript
const {
  register,
  httpRequestDuration,
  sseClientsConnected,
  sseBroadcastsTotal,
  imagesServedTotal,
  errorsTotal,
} = require('./lib/metrics');
```

**Step 2: Add metrics middleware after line 105 (after express.json)**

```javascript
// Metrics middleware - track request duration
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path || req.path;
    end({ method: req.method, route, status: res.statusCode });
  });
  next();
});
```

**Step 3: Add /metrics endpoint after health endpoint (after line 143)**

```javascript
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

**Step 4: Update broadcast function to track metrics**

Replace the broadcast function (lines 115-119):

```javascript
function broadcast(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => client.write(message));
  sseBroadcastsTotal.inc({ event });
  log('debug', 'SSE broadcast', { event, clientCount: sseClients.length });
}
```

**Step 5: Update SSE client tracking**

In the `/api/events` handler, update connect/disconnect:

After `sseClients.push(res);` add:
```javascript
sseClientsConnected.set(sseClients.length);
```

In the `req.on('close')` callback, after filtering add:
```javascript
sseClientsConnected.set(sseClients.length);
```

**Step 6: Update image serving to track metrics**

In the `/images/:filename` handler, in the success branch of `res.sendFile` callback:

```javascript
} else {
  imagesServedTotal.inc();
  log('info', 'Image served', { filename: safeName });
}
```

**Step 7: Add error tracking to existing error handlers**

In catch blocks where `log('error', ...)` is called, add:
```javascript
errorsTotal.inc({ source: 'api' });  // or 'watcher', 'sse' depending on context
```

**Step 8: Run existing tests to verify no regressions**

Run: `npm test`

Expected: All tests pass

**Step 9: Commit**

```bash
git add server.js
git commit -m "feat: instrument server.js with Prometheus metrics"
```

---

## Task 5: Instrument Preprocessor with Metrics Server

**Files:**
- Modify: `preprocessor.js:1-6` (imports)
- Modify: `preprocessor.js:30-66` (processImage function)
- Modify: `preprocessor.js:98-141` (init function)

**Step 1: Add imports to preprocessor.js**

Add after line 4 (after fs import):

```javascript
const http = require('http');
const {
  register,
  imagesProcessedTotal,
  imagesFailedTotal,
  processingDuration,
  processingQueueDepth,
  imageSizeBytes,
  compressionRatio,
} = require('./lib/preprocessor-metrics');
```

**Step 2: Update processImage to track metrics**

Replace the processImage function:

```javascript
async function processImage(inputPath) {
  const filename = path.basename(inputPath);
  const nameWithoutExt = path.parse(filename).name;
  const outputFilename = `${nameWithoutExt}.webp`;
  const outputPath = path.join(
    config.preprocessing.processedImagePath,
    outputFilename
  );

  const endTimer = processingDuration.startTimer();
  let inputSize = 0;

  try {
    log('info', 'Processing image', { input: inputPath, output: outputPath });

    // Get input file size for compression ratio
    const inputStats = await fs.stat(inputPath);
    inputSize = inputStats.size;

    await sharp(inputPath)
      .webp({ quality: config.preprocessing.quality })
      .resize(
        config.preprocessing.targetWidth,
        config.preprocessing.targetHeight,
        {
          fit: 'inside',
          withoutEnlargement: true,
        }
      )
      .toFile(outputPath);

    // Get output file size
    const outputStats = await fs.stat(outputPath);
    const outputSize = outputStats.size;

    // Record metrics
    endTimer();
    imagesProcessedTotal.inc();
    imageSizeBytes.observe(outputSize);
    if (inputSize > 0) {
      compressionRatio.observe(inputSize / outputSize);
    }

    log('info', 'Image processed successfully', {
      input: inputPath,
      output: outputPath,
      inputSize,
      outputSize,
      ratio: inputSize > 0 ? (inputSize / outputSize).toFixed(2) : 'N/A',
    });

    await handleOriginalFile(inputPath);
  } catch (err) {
    endTimer();
    imagesFailedTotal.inc({ reason: err.code || 'unknown' });
    log('error', 'Failed to process image', {
      input: inputPath,
      error: err.message,
    });
  }
}
```

**Step 3: Add metrics HTTP server in init function**

Add at the beginning of the `init()` function, before the preprocessing check:

```javascript
async function init() {
  // Start metrics server
  const metricsServer = http.createServer(async (req, res) => {
    if (req.url === '/metrics' && req.method === 'GET') {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  metricsServer.listen(9092, () => {
    log('info', 'Preprocessor metrics server started', { port: 9092 });
  });

  if (!config.preprocessing.enabled) {
    // ... rest of existing code
```

**Step 4: Run existing tests**

Run: `npm test`

Expected: All tests pass

**Step 5: Commit**

```bash
git add preprocessor.js
git commit -m "feat: instrument preprocessor with metrics and HTTP server"
```

---

## Task 6: Create Monitoring Directory Structure

**Files:**
- Create: `monitoring/prometheus/prometheus.yml`
- Create: `monitoring/grafana/provisioning/datasources/prometheus.yml`
- Create: `monitoring/grafana/provisioning/dashboards/dashboards.yml`

**Step 1: Create directory structure**

Run:
```bash
mkdir -p monitoring/prometheus
mkdir -p monitoring/grafana/provisioning/datasources
mkdir -p monitoring/grafana/provisioning/dashboards
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/alerting
```

**Step 2: Create Prometheus config**

Create `monitoring/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'server'
    static_configs:
      - targets: ['slideshow:3000']
    metrics_path: /metrics

  - job_name: 'preprocessor'
    static_configs:
      - targets: ['slideshow:9092']
    metrics_path: /metrics
```

**Step 3: Create Grafana datasource provisioning**

Create `monitoring/grafana/provisioning/datasources/prometheus.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

**Step 4: Create Grafana dashboard provisioning**

Create `monitoring/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1

providers:
  - name: 'img-board'
    orgId: 1
    folder: ''
    folderUid: ''
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
```

**Step 5: Commit**

```bash
git add monitoring/
git commit -m "feat: add Prometheus and Grafana provisioning config"
```

---

## Task 7: Create Grafana Dashboard

**Files:**
- Create: `monitoring/grafana/dashboards/img-board.json`

**Step 1: Create the dashboard JSON**

Create `monitoring/grafana/dashboards/img-board.json`:

```json
{
  "annotations": {
    "list": []
  },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 0,
  "id": null,
  "links": [],
  "panels": [
    {
      "gridPos": { "h": 4, "w": 6, "x": 0, "y": 0 },
      "id": 1,
      "options": {
        "colorMode": "value",
        "graphMode": "none",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "targets": [
        {
          "expr": "time() - process_start_time_seconds{job=\"server\"}",
          "refId": "A"
        }
      ],
      "title": "Server Uptime",
      "type": "stat",
      "fieldConfig": {
        "defaults": {
          "unit": "s"
        }
      }
    },
    {
      "gridPos": { "h": 4, "w": 6, "x": 6, "y": 0 },
      "id": 2,
      "options": {
        "colorMode": "value",
        "graphMode": "none",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "targets": [
        {
          "expr": "time() - imgboard_preprocessor_process_start_time_seconds{job=\"preprocessor\"}",
          "refId": "A"
        }
      ],
      "title": "Preprocessor Uptime",
      "type": "stat",
      "fieldConfig": {
        "defaults": {
          "unit": "s"
        }
      }
    },
    {
      "gridPos": { "h": 4, "w": 6, "x": 12, "y": 0 },
      "id": 3,
      "options": {
        "colorMode": "value",
        "graphMode": "area",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "targets": [
        {
          "expr": "imgboard_sse_clients_connected",
          "refId": "A"
        }
      ],
      "title": "SSE Clients",
      "type": "stat"
    },
    {
      "gridPos": { "h": 4, "w": 6, "x": 18, "y": 0 },
      "id": 4,
      "options": {
        "colorMode": "value",
        "graphMode": "area",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "targets": [
        {
          "expr": "rate(imgboard_errors_total[5m]) * 60",
          "refId": "A"
        }
      ],
      "title": "Error Rate (per min)",
      "type": "stat",
      "fieldConfig": {
        "defaults": {
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 1 },
              { "color": "red", "value": 5 }
            ]
          }
        }
      }
    },
    {
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 4 },
      "id": 5,
      "options": {},
      "targets": [
        {
          "expr": "rate(imgboard_images_processed_total[5m]) * 60",
          "legendFormat": "Images/min",
          "refId": "A"
        }
      ],
      "title": "Processing Throughput",
      "type": "timeseries",
      "fieldConfig": {
        "defaults": {
          "custom": {
            "drawStyle": "line",
            "lineInterpolation": "smooth",
            "fillOpacity": 20
          }
        }
      }
    },
    {
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 4 },
      "id": 6,
      "options": {},
      "targets": [
        {
          "expr": "histogram_quantile(0.50, rate(imgboard_processing_duration_seconds_bucket[5m]))",
          "legendFormat": "p50",
          "refId": "A"
        },
        {
          "expr": "histogram_quantile(0.95, rate(imgboard_processing_duration_seconds_bucket[5m]))",
          "legendFormat": "p95",
          "refId": "B"
        },
        {
          "expr": "histogram_quantile(0.99, rate(imgboard_processing_duration_seconds_bucket[5m]))",
          "legendFormat": "p99",
          "refId": "C"
        }
      ],
      "title": "Processing Duration",
      "type": "timeseries",
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "custom": {
            "drawStyle": "line",
            "lineInterpolation": "smooth"
          }
        }
      }
    },
    {
      "gridPos": { "h": 8, "w": 8, "x": 0, "y": 12 },
      "id": 7,
      "options": {
        "colorMode": "value",
        "graphMode": "area",
        "justifyMode": "auto",
        "orientation": "auto",
        "reduceOptions": {
          "calcs": ["lastNotNull"],
          "fields": "",
          "values": false
        },
        "textMode": "auto"
      },
      "targets": [
        {
          "expr": "imgboard_processing_queue_depth",
          "refId": "A"
        }
      ],
      "title": "Queue Depth",
      "type": "stat",
      "fieldConfig": {
        "defaults": {
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 10 },
              { "color": "red", "value": 50 }
            ]
          }
        }
      }
    },
    {
      "gridPos": { "h": 8, "w": 8, "x": 8, "y": 12 },
      "id": 8,
      "options": {},
      "targets": [
        {
          "expr": "histogram_quantile(0.50, rate(imgboard_compression_ratio_bucket[5m]))",
          "legendFormat": "Median ratio",
          "refId": "A"
        }
      ],
      "title": "Compression Ratio",
      "type": "timeseries"
    },
    {
      "gridPos": { "h": 8, "w": 8, "x": 16, "y": 12 },
      "id": 9,
      "options": {},
      "targets": [
        {
          "expr": "rate(imgboard_http_requests_total[5m]) * 60",
          "legendFormat": "{{route}}",
          "refId": "A"
        }
      ],
      "title": "Request Rate by Route",
      "type": "timeseries"
    },
    {
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 20 },
      "id": 10,
      "options": {},
      "targets": [
        {
          "expr": "process_resident_memory_bytes{job=\"server\"} / 1024 / 1024",
          "legendFormat": "Server",
          "refId": "A"
        },
        {
          "expr": "imgboard_preprocessor_process_resident_memory_bytes{job=\"preprocessor\"} / 1024 / 1024",
          "legendFormat": "Preprocessor",
          "refId": "B"
        }
      ],
      "title": "Memory Usage",
      "type": "timeseries",
      "fieldConfig": {
        "defaults": {
          "unit": "MB",
          "custom": {
            "drawStyle": "line",
            "fillOpacity": 10
          }
        }
      }
    },
    {
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 20 },
      "id": 11,
      "options": {},
      "targets": [
        {
          "expr": "rate(process_cpu_seconds_total{job=\"server\"}[1m]) * 100",
          "legendFormat": "Server",
          "refId": "A"
        },
        {
          "expr": "rate(imgboard_preprocessor_process_cpu_seconds_total{job=\"preprocessor\"}[1m]) * 100",
          "legendFormat": "Preprocessor",
          "refId": "B"
        }
      ],
      "title": "CPU Usage",
      "type": "timeseries",
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "max": 100,
          "custom": {
            "drawStyle": "line",
            "fillOpacity": 10
          }
        }
      }
    },
    {
      "gridPos": { "h": 8, "w": 24, "x": 0, "y": 28 },
      "id": 12,
      "options": {},
      "targets": [
        {
          "expr": "rate(imgboard_errors_total[5m]) * 60",
          "legendFormat": "{{source}}",
          "refId": "A"
        },
        {
          "expr": "rate(imgboard_images_failed_total[5m]) * 60",
          "legendFormat": "processing ({{reason}})",
          "refId": "B"
        }
      ],
      "title": "Errors Over Time",
      "type": "timeseries",
      "fieldConfig": {
        "defaults": {
          "custom": {
            "drawStyle": "bars",
            "fillOpacity": 80
          }
        }
      }
    }
  ],
  "refresh": "10s",
  "schemaVersion": 38,
  "tags": ["img-board"],
  "templating": {
    "list": []
  },
  "time": {
    "from": "now-1h",
    "to": "now"
  },
  "timepicker": {},
  "timezone": "",
  "title": "img-board Overview",
  "uid": "img-board-overview",
  "version": 1
}
```

**Step 2: Commit**

```bash
git add monitoring/grafana/dashboards/img-board.json
git commit -m "feat: add Grafana dashboard for img-board metrics"
```

---

## Task 8: Create Alert Rules

**Files:**
- Create: `monitoring/grafana/alerting/alerts.yml`

**Step 1: Create alert rules file**

Create `monitoring/grafana/alerting/alerts.yml`:

```yaml
apiVersion: 1

groups:
  - orgId: 1
    name: img-board-alerts
    folder: img-board
    interval: 1m
    rules:
      # Critical: Server Down
      - uid: server-down
        title: Server Down
        condition: C
        data:
          - refId: A
            relativeTimeRange:
              from: 60
              to: 0
            datasourceUid: prometheus
            model:
              expr: up{job="server"}
              intervalMs: 1000
              maxDataPoints: 43200
              refId: A
          - refId: C
            relativeTimeRange:
              from: 60
              to: 0
            datasourceUid: __expr__
            model:
              conditions:
                - evaluator:
                    params: [1]
                    type: lt
                  operator:
                    type: and
                  query:
                    params: [A]
                  reducer:
                    type: last
              refId: C
              type: classic_conditions
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Server is not responding to Prometheus scrapes

      # Critical: Preprocessor Down
      - uid: preprocessor-down
        title: Preprocessor Down
        condition: C
        data:
          - refId: A
            relativeTimeRange:
              from: 60
              to: 0
            datasourceUid: prometheus
            model:
              expr: up{job="preprocessor"}
              intervalMs: 1000
              maxDataPoints: 43200
              refId: A
          - refId: C
            relativeTimeRange:
              from: 60
              to: 0
            datasourceUid: __expr__
            model:
              conditions:
                - evaluator:
                    params: [1]
                    type: lt
                  operator:
                    type: and
                  query:
                    params: [A]
                  reducer:
                    type: last
              refId: C
              type: classic_conditions
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Preprocessor is not responding to Prometheus scrapes

      # Critical: High Error Rate
      - uid: high-error-rate
        title: High Error Rate
        condition: C
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: prometheus
            model:
              expr: rate(imgboard_errors_total[5m])
              intervalMs: 1000
              maxDataPoints: 43200
              refId: A
          - refId: C
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: __expr__
            model:
              conditions:
                - evaluator:
                    params: [0.1]
                    type: gt
                  operator:
                    type: and
                  query:
                    params: [A]
                  reducer:
                    type: last
              refId: C
              type: classic_conditions
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: Error rate exceeds 6/minute for 2+ minutes

      # Warning: High Memory Usage
      - uid: high-memory
        title: High Memory Usage
        condition: C
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: prometheus
            model:
              expr: max(process_resident_memory_bytes)
              intervalMs: 1000
              maxDataPoints: 43200
              refId: A
          - refId: C
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: __expr__
            model:
              conditions:
                - evaluator:
                    params: [524288000]  # 500MB
                    type: gt
                  operator:
                    type: and
                  query:
                    params: [A]
                  reducer:
                    type: last
              refId: C
              type: classic_conditions
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Memory usage exceeds 500MB for 5+ minutes

      # Warning: Large Queue Depth
      - uid: large-queue
        title: Large Processing Queue
        condition: C
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: prometheus
            model:
              expr: imgboard_processing_queue_depth
              intervalMs: 1000
              maxDataPoints: 43200
              refId: A
          - refId: C
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: __expr__
            model:
              conditions:
                - evaluator:
                    params: [50]
                    type: gt
                  operator:
                    type: and
                  query:
                    params: [A]
                  reducer:
                    type: last
              refId: C
              type: classic_conditions
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Processing queue has 50+ items for 5+ minutes
```

**Step 2: Update Grafana provisioning for alerting**

Create `monitoring/grafana/provisioning/alerting/alerting.yml`:

```yaml
apiVersion: 1

contactPoints:
  - orgId: 1
    name: default-email
    receivers:
      - uid: default-email-receiver
        type: email
        settings:
          addresses: admin@example.com
        disableResolveMessage: false

policies:
  - orgId: 1
    receiver: grafana-default-email
    group_by: ['grafana_folder', 'alertname']
```

Run: `mkdir -p monitoring/grafana/provisioning/alerting`

**Step 3: Commit**

```bash
git add monitoring/grafana/alerting/ monitoring/grafana/provisioning/alerting/
git commit -m "feat: add Grafana alert rules for critical and warning conditions"
```

---

## Task 9: Update Docker Compose

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Update docker-compose.yml**

Replace entire file with:

```yaml
version: '3.8'

services:
  slideshow:
    build: .
    container_name: image-slideshow
    ports:
      - '3000:3000'
    expose:
      - '9092'  # Preprocessor metrics (internal only)
    volumes:
      # NAS mounts (adjust paths to your setup)
      - /mnt/nas/photos/raw:/mnt/photos/raw:ro
      - /mnt/nas/photos/processed:/mnt/photos/processed
      - /mnt/nas/photos/archive:/mnt/photos/archive

      # Configuration (mount as read-only, use admin API to update)
      - ./config.json:/app/config.json

      # TLS certificates (optional)
      # - /path/to/cert.pem:/certs/cert.pem:ro
      # - /path/to/key.pem:/certs/key.pem:ro
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
    healthcheck:
      test:
        [
          'CMD',
          'wget',
          '--no-verbose',
          '--tries=1',
          '--spider',
          'http://localhost:3000/health',
        ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  prometheus:
    image: prom/prometheus:v2.50.1
    container_name: prometheus
    volumes:
      - ./monitoring/prometheus:/etc/prometheus:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
      - '--web.enable-lifecycle'
    ports:
      - '9090:9090'
    restart: unless-stopped
    depends_on:
      - slideshow

  grafana:
    image: grafana/grafana:10.3.3
    container_name: grafana
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
      - GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=/var/lib/grafana/dashboards/img-board.json
    ports:
      - '3001:3000'
    restart: unless-stopped
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:
```

**Step 2: Verify YAML syntax**

Run: `docker compose config --quiet`

Expected: No output (valid YAML)

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add Prometheus and Grafana services to docker-compose"
```

---

## Task 10: Add Monitoring Documentation

**Files:**
- Create: `monitoring/README.md`

**Step 1: Create monitoring README**

Create `monitoring/README.md`:

```markdown
# Observability Stack

This directory contains configuration for the img-board observability stack.

## Components

- **Prometheus** (port 9090): Metrics collection and storage
- **Grafana** (port 3001): Dashboards and alerting

## Quick Start

```bash
# Start all services including monitoring
docker compose up -d

# View Grafana dashboard
open http://localhost:3001

# View Prometheus UI
open http://localhost:9090
```

## Default Credentials

- **Grafana**: admin / admin (change in production via `GF_SECURITY_ADMIN_PASSWORD`)

## Metrics Endpoints

| Service | Endpoint | Port |
|---------|----------|------|
| Server | `/metrics` | 3000 |
| Preprocessor | `/metrics` | 9092 |

## Available Metrics

### Server Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `imgboard_http_request_duration_seconds` | Histogram | HTTP request latency |
| `imgboard_sse_clients_connected` | Gauge | Current SSE clients |
| `imgboard_sse_broadcasts_total` | Counter | SSE events by type |
| `imgboard_images_served_total` | Counter | Images served |
| `imgboard_errors_total` | Counter | Errors by source |

### Preprocessor Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `imgboard_images_processed_total` | Counter | Successful processing |
| `imgboard_images_failed_total` | Counter | Failed processing |
| `imgboard_processing_duration_seconds` | Histogram | Processing time |
| `imgboard_processing_queue_depth` | Gauge | Pending images |
| `imgboard_image_size_bytes` | Histogram | Output file sizes |
| `imgboard_compression_ratio` | Histogram | Size reduction |

## Alert Rules

### Critical

- **Server Down**: Server not responding for 1+ minute
- **Preprocessor Down**: Preprocessor not responding for 1+ minute
- **High Error Rate**: >6 errors/minute for 2+ minutes

### Warning

- **High Memory Usage**: >500MB for 5+ minutes
- **Large Queue Depth**: >50 pending images for 5+ minutes

## Customization

### Changing Alert Destinations

Edit `grafana/provisioning/alerting/alerting.yml` to configure email, Slack, or webhook notifications.

### Data Retention

Default: 15 days. Change via Prometheus `--storage.tsdb.retention.time` flag in docker-compose.yml.

### Adding Panels

Edit `grafana/dashboards/img-board.json` or use Grafana UI (changes persist in volume).
```

**Step 2: Commit**

```bash
git add monitoring/README.md
git commit -m "docs: add monitoring stack documentation"
```

---

## Task 11: Integration Test for Metrics Endpoint

**Files:**
- Create: `tests/integration/metrics.test.js`

**Step 1: Create integration test**

Create `tests/integration/metrics.test.js`:

```javascript
const request = require('supertest');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

describe('Metrics Endpoint', () => {
  it('GET /metrics returns Prometheus format', async () => {
    const response = await request(BASE_URL)
      .get('/metrics')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/text\/plain/);
    expect(response.text).toContain('imgboard_http_request_duration_seconds');
    expect(response.text).toContain('imgboard_sse_clients_connected');
    expect(response.text).toContain('imgboard_errors_total');
  });

  it('GET /metrics includes Node.js default metrics', async () => {
    const response = await request(BASE_URL)
      .get('/metrics')
      .expect(200);

    expect(response.text).toContain('process_cpu_seconds_total');
    expect(response.text).toContain('process_resident_memory_bytes');
    expect(response.text).toContain('nodejs_heap_size_total_bytes');
  });
});
```

**Step 2: Commit**

```bash
git add tests/integration/metrics.test.js
git commit -m "test: add integration test for metrics endpoint"
```

---

## Task 12: Final Verification

**Step 1: Run all unit tests**

Run: `npm run test:unit`

Expected: All tests pass

**Step 2: Run linting**

Run: `npm run lint:check`

Expected: No errors

**Step 3: Build and start containers**

Run: `docker compose up -d --build`

Expected: All 3 containers start successfully

**Step 4: Verify metrics endpoints**

Run:
```bash
curl -s http://localhost:3000/metrics | head -20
curl -s http://localhost:9092/metrics | head -20  # May need to exec into container network
```

Expected: Prometheus-formatted metrics

**Step 5: Verify Grafana dashboard loads**

Open: `http://localhost:3001`

Expected: Dashboard shows with panels (may show "No data" until metrics accumulate)

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete observability implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add prom-client | package.json |
| 2 | Metrics module | lib/metrics.js |
| 3 | Preprocessor metrics | lib/preprocessor-metrics.js |
| 4 | Instrument server | server.js |
| 5 | Instrument preprocessor | preprocessor.js |
| 6 | Monitoring config | monitoring/prometheus/, monitoring/grafana/provisioning/ |
| 7 | Grafana dashboard | monitoring/grafana/dashboards/img-board.json |
| 8 | Alert rules | monitoring/grafana/alerting/ |
| 9 | Docker compose | docker-compose.yml |
| 10 | Documentation | monitoring/README.md |
| 11 | Integration test | tests/integration/metrics.test.js |
| 12 | Final verification | - |
