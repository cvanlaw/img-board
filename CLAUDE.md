# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Image slideshow web application for DAKboard that displays images from NAS storage via HTTPS iframe. The system automatically detects new images without restart using file watching and real-time SSE updates.

**Critical Requirements:**
- Auto-detection of new files without restart (Chokidar with `usePolling: true` for NFS/CIFS mounts)
- HTTPS support for DAKboard iframe embedding
- NAS integration via network-mounted directories
- Real-time updates via Server-Sent Events (SSE)

## Architecture

Two-process system running in Docker container:

1. **Preprocessing Worker** (`preprocessor.js`)
   - Watches raw image directory with Chokidar
   - Converts images to WebP using Sharp
   - Resizes to configured target resolution
   - Moves to processed directory

2. **Express Server** (`server.js`)
   - Serves slideshow frontend and admin interface
   - Watches processed directory for changes
   - Broadcasts updates via SSE to connected clients
   - Provides admin API for live configuration changes

**File-Based IPC:**
- `config.json` - Shared configuration watched by both processes for hot reload
- `.reprocess-trigger` - Signals batch reprocessing (created by admin API, consumed by preprocessor)
- `.reprocess-progress.json` - Tracks reprocessing progress for admin UI

## Key Technical Decisions

**File Watching:**
- MUST use `usePolling: true` in Chokidar config for NFS/CIFS compatibility
- Standard file system events don't work reliably over network mounts

**Image Processing:**
- WebP format for 25-35% size reduction vs JPEG
- `fit: 'inside'` to preserve aspect ratio during resize
- Process images once, serve many (preprocessing is separate from serving)

**Configuration Hot Reload:**
- Both processes watch `config.json` with Chokidar
- Clear Node.js require cache before reloading: `delete require.cache[require.resolve('./config.json')]`
- Server broadcasts config updates to slideshow clients via SSE

**Admin Interface:**
- Vanilla JavaScript (no framework) for simplicity
- Deep merge for partial config updates to preserve nested properties
- Atomic file writes (temp file + rename) to prevent corruption

## Development Workflow

**Implementation follows task sequence in `docs/tasks/`:**
1. Project initialization (01) → npm setup, config template
2. Can parallelize: Preprocessor (02) + Server core (03)
3. Frontend (04) → SSE integration (05)
4. Admin API (06) → Admin UI (07) → Config hot reload (08) → Reprocessing (09)
5. HTTPS (10) can start anytime after server core (03)
6. Docker deployment (11) after all core features

**Using the /next-task command:**
- Run `/next-task` to automatically identify the next unstarted task
- Scans task files, checks dependencies, and creates implementation plan
- Generates todo list from acceptance criteria
- Use after completing each task to maintain workflow progression

**Testing critical path:**
- Add image to raw directory → appears in slideshow after WebP conversion
- Delete image from processed directory → removed from slideshow via SSE
- Change config via admin UI → both processes reload without restart

## Docker Deployment

**This is the only deployment method** (PM2 removed):
- `start.js` spawns both preprocessor and server processes
- Both processes log to stdout/stderr (captured by Docker)
- Container restarts automatically via `restart: unless-stopped`
- NAS directories mounted as volumes from host

**Commands:**
```bash
docker compose up -d --build    # Deploy
docker compose logs -f          # View logs
docker compose down             # Stop
```

## Documentation Structure

- `docs/ARCHITECTURE.md` - Complete technical specification (1,572 lines)
- `docs/tasks/` - 11 INVEST-compliant implementation tasks with acceptance criteria
- Each task includes code snippets, testing checklists, and implementation details

## Important Constraints

- Never use PM2 or ecosystem.config.js (deployment is Docker-only)
- Config updates must use deep merge to preserve nested properties
- SSE requires `proxy_buffering off` and `proxy_cache off` if using nginx
- Reshuffle new images on timer (don't interrupt viewing with immediate updates)
