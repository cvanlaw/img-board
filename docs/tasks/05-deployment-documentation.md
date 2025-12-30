---
id: 5
title: Deployment Documentation
depends_on: [1, 2, 3, 4]
status: pending
---

# Task 5: Deployment Documentation

## Description

Create comprehensive deployment documentation that covers initial setup, ongoing maintenance, certificate management, troubleshooting, and rollback procedures.

## Deliverables

- `deploy/README.md` - Complete deployment guide

## Acceptance Criteria

- [ ] Documents prerequisites (Ubuntu Server, NAS mounts, AWS credentials)
- [ ] Documents initial deployment workflow step-by-step
- [ ] Documents application update procedure
- [ ] Documents certificate update procedure
- [ ] Documents rollback procedure with git checkout
- [ ] Documents log viewing commands
- [ ] Includes troubleshooting section for common issues
- [ ] Includes optional cron setup for automatic certificate updates

## Implementation Details

### README.md

```markdown
# img-board Deployment

Shell-script based deployment for a single homelab host.

## Prerequisites

- Ubuntu Server (latest LTS)
- NAS mounted at `/mnt/nas/photos/` with `raw/`, `processed/`, `archive/` subdirectories
- AWS credentials with S3 read access to certificate bucket
- Network access to GitHub

## Initial Deployment

### 1. Copy deploy scripts to host

```bash
scp -r deploy/ user@host:/tmp/
```

### 2. Run setup (one-time)

```bash
ssh user@host
cd /tmp/deploy
./setup.sh
```

Log out and back in for Docker group changes to take effect.

### 3. Configure AWS credentials

```bash
aws configure
# Verify access:
aws s3 ls s3://your-cert-bucket/
```

### 4. Create environment file

```bash
cp .env.example .env
nano .env
```

Required variables:
- `S3_CERT_BUCKET` - S3 bucket containing certificates
- `CERT_HOSTNAME` - Hostname folder in S3 bucket

### 5. Deploy

```bash
./deploy.sh
```

### 6. Configure application (if needed)

```bash
nano /opt/imgboard/config.json
docker compose -f /opt/imgboard/docker-compose.yml restart
```

## Maintenance

### Update Application

Re-run deploy script (pulls latest code and rebuilds):

```bash
./deploy.sh
```

Or manually:

```bash
cd /opt/imgboard
git -C source pull
docker compose up -d --build
```

### Update Certificates

```bash
./update-certs.sh
docker compose -f /opt/imgboard/docker-compose.yml restart
```

### View Logs

```bash
docker compose -f /opt/imgboard/docker-compose.yml logs -f
```

### Rollback

```bash
cd /opt/imgboard
git -C source checkout v1.0.0  # or specific commit
docker compose up -d --build
```

## Automatic Certificate Updates (Optional)

Add to crontab (`crontab -e`):

```bash
# Check for new certs weekly and restart if changed
0 4 * * 0 /opt/imgboard/deploy/update-certs.sh && docker compose -f /opt/imgboard/docker-compose.yml restart
```

## Troubleshooting

### Container won't start

```bash
docker compose -f /opt/imgboard/docker-compose.yml logs
```

### Certificate errors

```bash
# View certificate details
openssl x509 -in /opt/imgboard/certs/cert.pem -noout -text

# Verify certificate chain
openssl verify -CAfile /opt/imgboard/certs/chain.pem /opt/imgboard/certs/cert.pem
```

### NAS mount issues

```bash
ls -la /mnt/nas/photos/
mount | grep nas
```

### Health check failing

```bash
curl -vk https://localhost:3000/health
```

## Directory Structure

```
/opt/imgboard/
├── source/           # Application source code
├── certs/            # TLS certificates from S3
│   ├── cert.pem
│   ├── key.pem
│   └── chain.pem
├── config.json       # Application configuration
└── docker-compose.yml
```
```

## Testing Checklist

- [ ] Follow README steps on a fresh Ubuntu Server VM
- [ ] Verify all commands in README work as documented
- [ ] Verify troubleshooting commands produce useful output
- [ ] Verify rollback procedure works
- [ ] Verify cron syntax is correct
