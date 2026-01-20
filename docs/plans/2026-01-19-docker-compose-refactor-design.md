# Docker Compose Refactor Design

## Goal

Consolidate docker-compose files so that:

- `docker-compose.yaml` is the production source of truth
- `docker-compose.local.yaml` provides local development overrides
- DRY: minimize duplication using Compose's override mechanism

## Current State

Two separate files with duplicated configuration:

- `docker-compose.yml` (root) - local development
- `deploy/docker-compose.yml` - production

## New Structure

```
docker-compose.yaml          # Production base (source of truth)
docker-compose.local.yaml    # Local dev overrides
```

### docker-compose.yaml (Production Base)

```yaml
services:
  imgboard:
    build:
      context: ${BUILD_CONTEXT:-./source}
      dockerfile: Dockerfile
    container_name: imgboard
    restart: unless-stopped
    ports:
      - '3000:3000'
    expose:
      - '9092'
    volumes:
      - ./config.json:/app/config.json
      - ${CERTS_DIR:-./certs}/cert.pem:/certs/cert.pem:ro
      - ${CERTS_DIR:-./certs}/key.pem:/certs/key.pem:ro
      - ${CERTS_DIR:-./certs}/chain.pem:/certs/chain.pem:ro
      - ${NAS_RAW:-/mnt/nas/photos/raw}:/mnt/photos/raw
      - ${NAS_PROCESSED:-/mnt/nas/photos/processed}:/mnt/photos/processed
      - ${NAS_ARCHIVE:-/mnt/nas/photos/archive}:/mnt/photos/archive
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
          '-q',
          '--spider',
          '--no-check-certificate',
          'https://localhost:3000/health',
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
      - imgboard

  grafana:
    image: grafana/grafana:10.3.3
    container_name: grafana
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
      - ./monitoring/grafana/alerting:/etc/grafana/provisioning/alerting:ro
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
      - GF_AUTH_ANONYMOUS_ENABLED=${GRAFANA_ANONYMOUS_ENABLED:-true}
      - GF_AUTH_ANONYMOUS_ORG_ROLE=${GRAFANA_ANONYMOUS_ROLE:-Viewer}
      - GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=/var/lib/grafana/dashboards/img-board.json
    ports:
      - '3111:3000'
    restart: unless-stopped
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:
```

### docker-compose.local.yaml (Local Override)

```yaml
services:
  imgboard:
    build:
      context: .
    volumes:
      - ./config.json:/app/config.json
      # No TLS certs for local dev
      - ./test-images/raw:/mnt/photos/raw
      - ./test-images/processed:/mnt/photos/processed
      - ./test-images/archive:/mnt/photos/archive
    environment:
      - NODE_ENV=development
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
```

## File Changes

| Action | File                        |
| ------ | --------------------------- |
| Create | `docker-compose.yaml`       |
| Create | `docker-compose.local.yaml` |
| Delete | `docker-compose.yml`        |
| Delete | `deploy/docker-compose.yml` |
| Update | `Makefile`                  |
| Update | `deploy/deploy.sh`          |

## Makefile Changes

```makefile
COMPOSE_BASE := docker-compose.yaml
COMPOSE_LOCAL := docker-compose.local.yaml

ifeq ($(IMGBOARD_ENV),prod)
  DOCKER_COMPOSE := docker compose -f $(COMPOSE_BASE)
  HEALTH_CMD := curl -sf -k https://localhost:3000/health
else
  DOCKER_COMPOSE := docker compose -f $(COMPOSE_BASE) -f $(COMPOSE_LOCAL)
  HEALTH_CMD := curl -sf http://localhost:3000/health
endif
```

## deploy/deploy.sh Changes

Change line 44 from:

```bash
cp "$SCRIPT_DIR/docker-compose.yml" "$APP_DIR/docker-compose.yml"
```

To:

```bash
cp "$APP_DIR/source/docker-compose.yaml" "$APP_DIR/docker-compose.yaml"
```

## Usage

**Local development:**

```bash
make up      # Uses both files automatically
make logs
make down
```

**Production deployment:**

```bash
make deploy  # Runs deploy.sh, copies docker-compose.yaml to /opt/imgboard
```
