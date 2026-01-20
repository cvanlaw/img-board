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
