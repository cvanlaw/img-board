# Deployment Design

Simple shell-script based deployment for a single homelab host. The application runs in a Docker container with HTTPS enabled using certificates pulled from S3.

## Architecture Overview

**Environment:**
- Host OS: Ubuntu Server (latest LTS)
- Network: Private network with internet access
- Docker: Latest stable Docker Engine + Compose plugin
- Orchestration: Shell scripts (no Ansible)

**Application:**
- Two-process Docker container (preprocessor + server)
- Base image: Node.js 20 Alpine
- Port: 3000 (HTTPS)
- HTTPS: Enabled with Let's Encrypt certificates from S3

**Certificate Management:**
- Source: AWS S3 bucket (managed by cert-getter Lambda)
- Structure: `s3://{bucket}/{hostname}/cert.pem`, `key.pem`, `chain.pem`
- Format: PEM-encoded ECDSA P-256 certificates
- Renewal: Automatic via cert-getter Lambda (daily 3:00 AM UTC)
- Updates: Run `./scripts/update-certs.sh` then restart container

**NAS Integration:**
- Raw images: `/mnt/nas/photos/raw` → `/mnt/photos/raw:ro` (read-only)
- Processed images: `/mnt/nas/photos/processed` → `/mnt/photos/processed`
- Archive: `/mnt/nas/photos/archive` → `/mnt/photos/archive`

## Directory Structure

```
deploy/
├── setup.sh                 # One-time host setup
├── deploy.sh                # Build and deploy application
├── update-certs.sh          # Pull certificates from S3
├── config.example.json      # Template configuration
├── docker-compose.yml       # Container configuration
├── .env.example             # Environment variables template
└── README.md                # Deployment instructions
```

On the host after deployment:
```
/opt/imgboard/
├── source/                  # Application source code
├── certs/                   # TLS certificates from S3
│   ├── cert.pem
│   ├── key.pem
│   └── chain.pem
├── config.json              # Application configuration
└── docker-compose.yml       # Active compose file
```

## Scripts

### setup.sh - One-Time Host Setup

Run once on a fresh Ubuntu Server to prepare for deployment.

```bash
#!/bin/bash
set -euo pipefail

echo "=== img-board Host Setup ==="

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "Docker installed. Log out and back in for group changes."
fi

# Install AWS CLI
if ! command -v aws &> /dev/null; then
    echo "Installing AWS CLI..."
    sudo apt-get update && sudo apt-get install -y unzip
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp
    sudo /tmp/aws/install
    rm -rf /tmp/aws /tmp/awscliv2.zip
fi

# Create directories
echo "Creating directories..."
sudo mkdir -p /opt/imgboard/{source,certs}
sudo chown -R "$USER:$USER" /opt/imgboard

# Configure Docker logging
echo "Configuring Docker logging..."
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    }
}
EOF
sudo systemctl restart docker

echo "=== Setup Complete ==="
echo "Next steps:"
echo "  1. Configure AWS credentials: aws configure"
echo "  2. Verify S3 access: aws s3 ls s3://your-cert-bucket/"
echo "  3. Run ./deploy.sh to deploy the application"
```

### deploy.sh - Build and Deploy

```bash
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
```

### update-certs.sh - Pull Certificates from S3

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="/opt/imgboard/certs"

# Load environment
if [[ -f "$SCRIPT_DIR/.env" ]]; then
    source "$SCRIPT_DIR/.env"
fi

S3_BUCKET="${S3_CERT_BUCKET:?S3_CERT_BUCKET not set}"
CERT_HOSTNAME="${CERT_HOSTNAME:?CERT_HOSTNAME not set}"

echo "Downloading certificates from S3..."
aws s3 cp "s3://$S3_BUCKET/$CERT_HOSTNAME/cert.pem" "$CERT_DIR/cert.pem"
aws s3 cp "s3://$S3_BUCKET/$CERT_HOSTNAME/key.pem" "$CERT_DIR/key.pem"
aws s3 cp "s3://$S3_BUCKET/$CERT_HOSTNAME/chain.pem" "$CERT_DIR/chain.pem"

# Set permissions
chmod 644 "$CERT_DIR/cert.pem" "$CERT_DIR/chain.pem"
chmod 600 "$CERT_DIR/key.pem"

# Verify certificate
EXPIRY=$(openssl x509 -in "$CERT_DIR/cert.pem" -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

echo "Certificate valid until: $EXPIRY ($DAYS_LEFT days remaining)"
if [[ $DAYS_LEFT -lt 30 ]]; then
    echo "WARNING: Certificate expires in less than 30 days"
fi
```

## Configuration Files

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

## Deployment Workflows

### Initial Deployment

```bash
# 1. Copy deploy scripts to host
scp -r deploy/ user@host:/tmp/

# 2. Run setup (one-time)
ssh user@host
cd /tmp/deploy
./setup.sh

# 3. Configure AWS credentials
aws configure

# 4. Create .env file
cp .env.example .env
nano .env  # Set S3_CERT_BUCKET and CERT_HOSTNAME

# 5. Deploy
./deploy.sh

# 6. Edit application config if needed
nano /opt/imgboard/config.json
docker compose -f /opt/imgboard/docker-compose.yml restart
```

### Update Application

```bash
cd /opt/imgboard
git -C source pull
docker compose up -d --build
```

Or re-run deploy script:
```bash
./deploy.sh
```

### Update Certificates

```bash
./update-certs.sh
docker compose -f /opt/imgboard/docker-compose.yml restart
```

### Rollback

```bash
cd /opt/imgboard
git -C source checkout v1.0.0  # or specific commit
docker compose up -d --build
```

### View Logs

```bash
docker compose -f /opt/imgboard/docker-compose.yml logs -f
```

## Certificate Management

**Renewal Process:**
1. cert-getter Lambda renews certificates automatically (daily 3:00 AM UTC)
2. New certificates uploaded to S3: `s3://{bucket}/{hostname}/`
3. Pull to host: `./update-certs.sh`
4. Restart container: `docker compose restart`

**Optional: Cron for automatic certificate updates**
```bash
# Check for new certs weekly and restart if changed
0 4 * * 0 /opt/imgboard/deploy/update-certs.sh && docker compose -f /opt/imgboard/docker-compose.yml restart
```

## Security Considerations

1. **AWS Credentials:** Configured via `aws configure` (stored in `~/.aws/`)
2. **Certificate Permissions:** Private key restricted to 600
3. **Container:** Runs as non-root user (defined in Dockerfile)
4. **HTTPS Only:** Application configured for HTTPS-only operation
5. **Read-only mounts:** Raw images and certificates mounted read-only

## Troubleshooting

**Container won't start:**
```bash
docker compose -f /opt/imgboard/docker-compose.yml logs
```

**Certificate errors:**
```bash
openssl x509 -in /opt/imgboard/certs/cert.pem -noout -text
openssl verify -CAfile /opt/imgboard/certs/chain.pem /opt/imgboard/certs/cert.pem
```

**NAS mount issues:**
```bash
ls -la /mnt/nas/photos/
mount | grep nas
```

**Health check failing:**
```bash
curl -vk https://localhost:3000/health
```

## Files to Create

```
deploy/
├── setup.sh              # Host preparation script
├── deploy.sh             # Deployment script
├── update-certs.sh       # Certificate update script
├── .env.example          # Environment template
├── docker-compose.yml    # Container configuration
├── config.example.json   # Application config template
└── README.md             # Quick reference
```

