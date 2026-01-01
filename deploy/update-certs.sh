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

# Extract base domain for wildcard cert lookup
# Example: imgboard.example.com -> wildcard.example.com
BASE_DOMAIN=$(echo "$CERT_HOSTNAME" | sed -E 's/^[^.]+\.//')
WILDCARD_PREFIX="wildcard.$BASE_DOMAIN"

echo "Downloading wildcard certificates for $BASE_DOMAIN from S3..."
aws s3 cp "s3://$S3_BUCKET/$WILDCARD_PREFIX/cert.pem" "$CERT_DIR/cert.pem"
aws s3 cp "s3://$S3_BUCKET/$WILDCARD_PREFIX/key.pem" "$CERT_DIR/key.pem"
aws s3 cp "s3://$S3_BUCKET/$WILDCARD_PREFIX/chain.pem" "$CERT_DIR/chain.pem"

# Set permissions
chmod 644 "$CERT_DIR/cert.pem" "$CERT_DIR/chain.pem"
chmod 600 "$CERT_DIR/key.pem"

# Verify certificate
EXPIRY=$(openssl x509 -in "$CERT_DIR/cert.pem" -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

echo "Using wildcard certificate from: $WILDCARD_PREFIX"
echo "Certificate valid until: $EXPIRY ($DAYS_LEFT days remaining)"
if [[ $DAYS_LEFT -lt 30 ]]; then
    echo "WARNING: Certificate expires in less than 30 days"
fi
