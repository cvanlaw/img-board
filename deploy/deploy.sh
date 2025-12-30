#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/opt/imgboard"
REPO_URL="${REPO_URL:-https://github.com/cvanlaw/img-board.git}"
BRANCH="${BRANCH:-main}"

echo "=== img-board Deployment ==="

# Load environment
if [[ -f "$SCRIPT_DIR/.env" ]]; then
    source "$SCRIPT_DIR/.env"
fi

# Verify NAS mounts
NAS_BASE="${NAS_MOUNT_BASE:-/mnt/nas/photos}"
if [[ ! -d "$NAS_BASE" ]]; then
    echo "ERROR: NAS mount not found at $NAS_BASE"
    exit 1
fi

# Clone or update source
if [[ -d "$APP_DIR/source/.git" ]]; then
    echo "Updating source..."
    git -C "$APP_DIR/source" fetch origin
    git -C "$APP_DIR/source" reset --hard "origin/$BRANCH"
else
    echo "Cloning source..."
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR/source"
fi

# Update certificates
"$SCRIPT_DIR/update-certs.sh"

# Copy config if not exists
if [[ ! -f "$APP_DIR/config.json" ]]; then
    echo "Creating config.json from template..."
    cp "$SCRIPT_DIR/config.example.json" "$APP_DIR/config.json"
    echo "IMPORTANT: Edit /opt/imgboard/config.json before starting"
fi

# Copy docker-compose.yml
cp "$SCRIPT_DIR/docker-compose.yml" "$APP_DIR/docker-compose.yml"

# Build and deploy
echo "Building and starting container..."
cd "$APP_DIR"
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build

# Wait for health check
echo "Waiting for application..."
for i in {1..30}; do
    if curl -sf -k "https://localhost:3000/health" > /dev/null 2>&1; then
        echo "=== Deployment Complete ==="
        echo "Application running at https://$(hostname -I | awk '{print $1}'):3000"
        exit 0
    fi
    sleep 2
done

echo "WARNING: Health check failed. Check logs with: docker compose logs"
exit 1
