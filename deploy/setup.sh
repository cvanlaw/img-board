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
