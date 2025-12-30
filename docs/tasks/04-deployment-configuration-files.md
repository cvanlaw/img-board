---
id: 4
title: Deployment Configuration Files
depends_on: []
status: pending
---

# Task 4: Deployment Configuration Files

## Description

Create the configuration file templates needed for deployment: environment variables template, Docker Compose configuration, and application configuration template.

## Deliverables

- `deploy/.env.example` - Environment variables template
- `deploy/docker-compose.yml` - Container orchestration configuration
- `deploy/config.example.json` - Application configuration template

## Acceptance Criteria

- [ ] `.env.example` contains S3 bucket, hostname, repo URL, branch, and NAS mount variables
- [ ] `docker-compose.yml` defines imgboard service with correct build context
- [ ] `docker-compose.yml` mounts config.json, certificates, and NAS directories
- [ ] `docker-compose.yml` includes healthcheck configuration
- [ ] `docker-compose.yml` sets restart policy to `unless-stopped`
- [ ] `config.example.json` contains all preprocessor, server, slideshow, and https settings
- [ ] Certificate paths in config match volume mounts in docker-compose.yml

## Implementation Details

### .env.example

```bash
# S3 Certificate Configuration
S3_CERT_BUCKET=my-cert-bucket
CERT_HOSTNAME=imgboard.example.com

# Git Configuration (optional)
REPO_URL=https://github.com/cvanlaw/img-board.git
BRANCH=main

# NAS Configuration
NAS_MOUNT_BASE=/mnt/nas/photos
```

### docker-compose.yml

```yaml
services:
  imgboard:
    build:
      context: ./source
      dockerfile: Dockerfile
    container_name: imgboard
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      # Application config
      - ./config.json:/app/config.json:ro
      # TLS certificates
      - ./certs/cert.pem:/certs/cert.pem:ro
      - ./certs/key.pem:/certs/key.pem:ro
      - ./certs/chain.pem:/certs/chain.pem:ro
      # NAS mounts
      - /mnt/nas/photos/raw:/mnt/photos/raw:ro
      - /mnt/nas/photos/processed:/mnt/photos/processed
      - /mnt/nas/photos/archive:/mnt/photos/archive
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "--no-check-certificate", "https://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

### config.example.json

```json
{
  "preprocessor": {
    "inputDir": "/mnt/photos/raw",
    "outputDir": "/mnt/photos/processed",
    "archiveDir": "/mnt/photos/archive",
    "targetWidth": 1920,
    "targetHeight": 1080,
    "quality": 85,
    "format": "webp",
    "extensions": [".jpg", ".jpeg", ".png", ".webp", ".heic"]
  },
  "server": {
    "port": 3000,
    "imageDir": "/mnt/photos/processed"
  },
  "slideshow": {
    "interval": 5000,
    "transition": "fade",
    "shuffle": true
  },
  "https": {
    "enabled": true,
    "certPath": "/certs/cert.pem",
    "keyPath": "/certs/key.pem",
    "chainPath": "/certs/chain.pem"
  }
}
```

## Testing Checklist

- [ ] Verify `.env.example` contains all required variables with placeholder values
- [ ] Verify `docker-compose.yml` is valid YAML: `docker compose config`
- [ ] Verify `config.example.json` is valid JSON: `jq . deploy/config.example.json`
- [ ] Verify certificate paths in config.json match volume mounts in docker-compose.yml
- [ ] Verify NAS mount paths in docker-compose.yml match design spec
- [ ] Verify raw images mounted read-only, processed writable
