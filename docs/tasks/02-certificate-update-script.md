---
id: 2
title: Certificate Update Script
depends_on: []
status: pending
---

# Task 2: Certificate Update Script

## Description

Create the certificate update script that pulls TLS certificates from S3 and sets appropriate permissions. This script is used both during initial deployment and for certificate renewals.

## Deliverables

- `deploy/update-certs.sh` - Certificate download and verification script

## Acceptance Criteria

- [ ] Script loads environment variables from `.env` file
- [ ] Script requires `S3_CERT_BUCKET` and `CERT_HOSTNAME` environment variables
- [ ] Script downloads `cert.pem`, `key.pem`, and `chain.pem` from S3
- [ ] Script sets correct permissions (644 for cert/chain, 600 for key)
- [ ] Script verifies certificate and displays expiry date
- [ ] Script warns if certificate expires in less than 30 days
- [ ] Script fails fast on errors (set -euo pipefail)
- [ ] Script is executable (chmod +x)

## Implementation Details

### update-certs.sh

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

## Testing Checklist

- [ ] Verify script fails without `.env` or required environment variables
- [ ] Create test `.env` with valid S3 bucket and hostname
- [ ] Run script and verify certificates downloaded to `/opt/imgboard/certs/`
- [ ] Verify `cert.pem` and `chain.pem` permissions are 644: `stat -c %a /opt/imgboard/certs/cert.pem`
- [ ] Verify `key.pem` permissions are 600: `stat -c %a /opt/imgboard/certs/key.pem`
- [ ] Verify expiry date displayed correctly
- [ ] Test with certificate expiring in <30 days to verify warning
