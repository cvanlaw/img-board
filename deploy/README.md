# img-board Deployment

Shell-script based deployment for a single homelab host.

## Prerequisites

- Ubuntu Server 24.04 LTS
- NFS server accessible on local network
  - Export path: `/img-board`
  - Subdirectories: `raw/`, `processed/`, `archive/`
  - No authentication required (NFSv3 or NFSv4)
- AWS credentials with S3 read access to certificate bucket
  - Created via cert-getter Terraform (see `cert-getter/terraform/README.md`)
  - IAM user: `cert-getter-cert-reader`
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

The setup script will:
1. Install Docker and AWS CLI
2. Prompt for NAS server IP address (e.g., 192.168.0.11)
3. Configure NFS mount at `/mnt/nas/photos`
4. Create required directory structure

**Important:** The NAS server IP is prompted during setup and stored in `/etc/fstab`. It is NOT committed to the repository for security.

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

Check NFS server exports:
```bash
showmount -e 192.168.0.11
```

Check mount status:
```bash
mount | grep nas
df -h | grep nas
ls -la /mnt/nas/photos/
```

Manually test mount:
```bash
sudo mount -t nfs 192.168.0.11:/img-board /mnt/nas/photos
```

Check fstab entry:
```bash
grep nas /etc/fstab
```

View NFS logs:
```bash
sudo dmesg | grep -i nfs
sudo journalctl -u nfs-client.target
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
