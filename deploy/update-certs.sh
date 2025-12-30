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
