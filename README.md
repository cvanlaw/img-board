# Image Slideshow for DAKboard

Auto-updating image slideshow web application designed for DAKboard iframe embedding. Displays images from NAS storage with automatic file detection, real-time updates, and zero-downtime configuration changes.

## Overview

This application provides a standalone web server that displays and rotates through images stored on network-attached storage (NAS). Built specifically for embedding in DAKboard via HTTPS iframe, it automatically detects new images without requiring a restart.

### Key Features

- **Auto-Detection**: Automatically picks up new images from NAS directory without server restart
- **Real-Time Updates**: Server-Sent Events (SSE) push new images to connected clients instantly
- **Image Preprocessing**: Automatic conversion to WebP format with configurable resizing for optimal performance
- **Admin Interface**: Web-based configuration management with live updates (no restart required)
- **HTTPS Support**: Built-in TLS certificate support for secure iframe embedding
- **Docker Deployment**: Single-container deployment with automatic restart and health checks

## Architecture

The system runs two processes within a Docker container:

1. **Preprocessing Worker** (`preprocessor.js`)
   - Watches raw image directory using Chokidar file watcher
   - Converts images to WebP format using Sharp
   - Resizes to configured target resolution
   - Moves processed images to serving directory

2. **Express Web Server** (`server.js`)
   - Serves slideshow frontend (Splide.js) and admin interface
   - Watches processed directory for changes
   - Broadcasts updates via SSE to connected clients
   - Provides REST API for configuration and statistics

### Technology Stack

- **Backend**: Node.js + Express + Chokidar + Sharp
- **Frontend**: Vanilla JavaScript + Splide.js (lightweight slider)
- **Deployment**: Docker + Docker Compose
- **Image Format**: WebP (25-35% smaller than JPEG)

## Quick Start

```bash
# Build and start container
docker compose up -d --build

# View logs
docker compose logs -f

# Stop container
docker compose down
```

Access the slideshow at `https://localhost:3000` and admin interface at `https://localhost:3000/admin`.

## Documentation

- **[Architecture & Implementation Guide](docs/ARCHITECTURE.md)** - Complete technical specification with implementation phases
- **[Implementation Tasks](docs/tasks/)** - 11 INVEST-compliant tasks with acceptance criteria and code examples

## Configuration

All settings managed via `config.json`:
- NAS mount paths (raw/processed/archive directories)
- Image preprocessing (target dimensions, quality, format)
- Slideshow timing and randomization
- HTTPS certificate paths
- Admin interface settings

Changes to configuration apply automatically without restart via file-watching hot reload.

