# Docker Compose Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate docker-compose files with production as the source of truth and local dev as an override layer.

**Architecture:** Single base `docker-compose.yaml` for production with environment variable defaults. Local development uses `docker-compose.local.yaml` to override build context, volumes, and healthcheck. Deploy script copies from cloned source instead of maintaining separate file.

**Tech Stack:** Docker Compose with override files, Make

**Design Reference:** `docs/plans/2026-01-19-docker-compose-refactor-design.md`

---

### Task 1: Create docker-compose.yaml (Production Base)

**Files:**
- Create: `docker-compose.yaml`

**Step 1: Create the production base compose file**

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
      test: ['CMD', 'wget', '-q', '--spider', '--no-check-certificate', 'https://localhost:3000/health']
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

**Step 2: Verify YAML syntax**

Run: `docker compose -f docker-compose.yaml config --quiet`
Expected: No output (valid YAML)

**Step 3: Commit**

```bash
git add docker-compose.yaml
git commit -m "feat: add production docker-compose.yaml base"
```

---

### Task 2: Create docker-compose.local.yaml (Local Override)

**Files:**
- Create: `docker-compose.local.yaml`

**Step 1: Create the local development override file**

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
      test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:3000/health']
```

**Step 2: Verify combined config**

Run: `docker compose -f docker-compose.yaml -f docker-compose.local.yaml config --quiet`
Expected: No output (valid combined YAML)

**Step 3: Commit**

```bash
git add docker-compose.local.yaml
git commit -m "feat: add docker-compose.local.yaml for dev overrides"
```

---

### Task 3: Update Makefile

**Files:**
- Modify: `Makefile:3-14`

**Step 1: Update compose file variables and conditionals**

Replace lines 3-14 with:

```makefile
# Default to dev; override with IMGBOARD_ENV=prod
IMGBOARD_ENV ?= dev

# Compose files
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

**Step 2: Verify make parses correctly**

Run: `make help`
Expected: Help text displays without errors

**Step 3: Commit**

```bash
git add Makefile
git commit -m "refactor: update Makefile to use new compose file structure"
```

---

### Task 4: Update deploy/deploy.sh

**Files:**
- Modify: `deploy/deploy.sh:43-44`

**Step 1: Update compose file copy to use source repo**

Replace lines 43-44:

From:
```bash
# Copy docker-compose.yml
cp "$SCRIPT_DIR/docker-compose.yml" "$APP_DIR/docker-compose.yml"
```

To:
```bash
# Copy docker-compose.yaml from source
cp "$APP_DIR/source/docker-compose.yaml" "$APP_DIR/docker-compose.yaml"
```

**Step 2: Verify script syntax**

Run: `bash -n deploy/deploy.sh`
Expected: No output (valid bash)

**Step 3: Commit**

```bash
git add deploy/deploy.sh
git commit -m "refactor: deploy.sh copies compose file from source repo"
```

---

### Task 5: Delete Old Files

**Files:**
- Delete: `docker-compose.yml`
- Delete: `deploy/docker-compose.yml`

**Step 1: Remove old compose files**

```bash
rm docker-compose.yml deploy/docker-compose.yml
```

**Step 2: Verify new setup works**

Run: `docker compose -f docker-compose.yaml -f docker-compose.local.yaml config --quiet`
Expected: No output (valid config)

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old docker-compose files"
```

---

### Task 6: Test Local Dev Setup

**Step 1: Verify make up works**

Run: `make up`
Expected: Containers start building/running

**Step 2: Check container status**

Run: `make ps`
Expected: imgboard, prometheus, grafana containers listed

**Step 3: Verify health endpoint**

Run: `make health`
Expected: "OK"

**Step 4: Tear down**

Run: `make down`
Expected: Containers stop cleanly

---

### Task 7: Final Commit

**Step 1: Squash or finalize commits if needed**

Review git log and ensure commits are clean.

Run: `git log --oneline -10`

**Step 2: Push branch (if on feature branch)**

Ready for PR or merge to main.
