# Task 11: Docker Deployment

## Description
Create Docker configuration for containerized deployment including Dockerfile, docker-compose.yml, and a process wrapper to run both preprocessor and server in a single container. This is the standard deployment method for the application.

## Dependencies
- All core tasks (01-10) should be functional

## Deliverables
- `Dockerfile` - Container image definition
- `docker-compose.yml` - Compose configuration with volume mounts
- `start.js` - Process wrapper to run both processes

## Acceptance Criteria
- [ ] `docker build` creates working image
- [ ] `docker compose up` starts container successfully
- [ ] Both preprocessor and server processes run in container
- [ ] NAS directories mounted as volumes (raw, processed, archive)
- [ ] Config file mounted as volume
- [ ] TLS certificates mounted as volumes (if HTTPS enabled)
- [ ] Container restarts automatically on failure
- [ ] Logs accessible via `docker logs`
- [ ] Health check endpoint for container orchestration

## Implementation Details

### Dockerfile
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install Sharp dependencies
RUN apk add --no-cache vips-dev

# For HEIC support (optional, increases image size):
# RUN apk add --no-cache vips-dev libheif-dev

# Copy package files first (layer caching)
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Create directories for runtime files
RUN mkdir -p /app/logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run process wrapper
CMD ["node", "start.js"]
```

### start.js (Process Wrapper)
```javascript
const { spawn } = require('child_process');

console.log('Starting image slideshow services...');

// Start preprocessor
const preprocessor = spawn('node', ['preprocessor.js'], {
  stdio: 'inherit',
  env: { ...process.env, PROCESS_NAME: 'preprocessor' }
});

preprocessor.on('error', (err) => {
  console.error('Preprocessor failed to start:', err);
});

preprocessor.on('exit', (code) => {
  console.error('Preprocessor exited with code:', code);
  // Could restart here if needed
});

// Start server
const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  env: { ...process.env, PROCESS_NAME: 'server' }
});

server.on('error', (err) => {
  console.error('Server failed to start:', err);
});

server.on('exit', (code) => {
  console.error('Server exited with code:', code);
  // Could restart here if needed
});

// Handle container shutdown signals
function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  preprocessor.kill('SIGTERM');
  server.kill('SIGTERM');

  // Force kill after timeout
  setTimeout(() => {
    preprocessor.kill('SIGKILL');
    server.kill('SIGKILL');
    process.exit(0);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Keep process running
process.stdin.resume();
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  slideshow:
    build: .
    container_name: image-slideshow
    ports:
      - "3000:3000"
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
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

### Config for Docker
Update config.json paths to match container mount points:
```json
{
  "preprocessing": {
    "rawImagePath": "/mnt/photos/raw",
    "processedImagePath": "/mnt/photos/processed",
    "archivePath": "/mnt/photos/archive"
  },
  "imagePath": "/mnt/photos/processed",
  "https": {
    "enabled": true,
    "cert": "/certs/cert.pem",
    "key": "/certs/key.pem"
  }
}
```

### .dockerignore
```
node_modules
npm-debug.log
.git
.gitignore
*.md
docs/
logs/
.reprocess-*
*.pem
.env
```

### Build and Run Commands
```bash
# Build image
docker build -t image-slideshow .

# Run with docker-compose
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Rebuild after code changes
docker compose up -d --build
```

### Volume Permissions

If NAS files have different ownership than container user (node, UID 1000):

Option 1: Run container as specific user
```yaml
services:
  slideshow:
    user: "1000:1000"
```

Option 2: Use Docker's userns-remap feature

Option 3: Ensure NAS exports with correct permissions

## Testing Checklist
- [ ] `docker build .` completes without errors
- [ ] `docker compose up` starts container
- [ ] Health check passes (check `docker ps`)
- [ ] `docker logs image-slideshow` shows both process logs
- [ ] Slideshow accessible at http://localhost:3000
- [ ] Images from NAS directory displayed
- [ ] Add image to raw directory - processed and displayed
- [ ] Admin interface works
- [ ] Container restarts automatically after `docker restart`
- [ ] `docker compose down && docker compose up` preserves state
- [ ] HTTPS works with mounted certificates
