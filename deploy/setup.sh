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

# ===== NFS Mount Setup =====
echo "=== NFS Mount Setup ==="

NAS_EXPORT="/volume1/img-board"
MOUNT_POINT="/mnt/nas/photos"

# Check if NFS mount already configured in fstab
if grep -q "$NAS_EXPORT" /etc/fstab 2>/dev/null; then
    echo "NFS mount already configured in /etc/fstab"
    NAS_IP=$(grep "$NAS_EXPORT" /etc/fstab | awk '{print $1}' | cut -d: -f1)
    echo "Using existing NFS server: $NAS_IP"
else
    # Install NFS client if not present
    if ! dpkg -l | grep -q nfs-common; then
        echo "Installing NFS client..."
        sudo apt-get update && sudo apt-get install -y nfs-common
    fi

    # Function to validate IP address
    validate_ip() {
        local ip=$1
        if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            IFS='.' read -ra OCTETS <<< "$ip"
            for octet in "${OCTETS[@]}"; do
                if ((octet > 255)); then
                    return 1
                fi
            done
            return 0
        fi
        return 1
    }

    # Prompt for NAS server IP
    NAS_IP=""
    while true; do
        read -p "Enter NAS server IP address (e.g., 192.168.0.11): " NAS_IP
        if validate_ip "$NAS_IP"; then
            break
        else
            echo "Invalid IP address. Please try again."
        fi
    done

    # Test NFS server availability
    echo "Testing NFS server connectivity..."
    if ! showmount -e "$NAS_IP" &>/dev/null; then
        echo "WARNING: Cannot reach NFS server at $NAS_IP"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Setup aborted. Please verify NAS server and try again."
            exit 1
        fi
    fi

    # Add to fstab
    echo "Adding NFS mount to /etc/fstab..."
    echo "$NAS_IP:$NAS_EXPORT $MOUNT_POINT nfs defaults,_netdev,nofail 0 0" | sudo tee -a /etc/fstab > /dev/null
fi

# Create mount point if not exists
sudo mkdir -p "$MOUNT_POINT"

# Mount the NFS share if not already mounted
if ! mountpoint -q "$MOUNT_POINT"; then
    echo "Mounting NFS share..."
    if sudo mount "$MOUNT_POINT" 2>/dev/null; then
        echo "NFS mount successful"
    else
        echo "WARNING: NFS mount failed. Check 'mount' or 'dmesg' for details."
        echo "You can manually mount with: sudo mount $MOUNT_POINT"
    fi
else
    echo "NFS already mounted at $MOUNT_POINT"
fi

# Create required subdirectories
echo "Creating image subdirectories..."
sudo mkdir -p "$MOUNT_POINT"/{raw,processed,archive}

# Verify mount
if mountpoint -q "$MOUNT_POINT"; then
    echo "NFS mount verified: $MOUNT_POINT"
    ls -la "$MOUNT_POINT"
else
    echo "WARNING: $MOUNT_POINT is not a mountpoint"
    echo "The application may not work correctly without NAS access."
fi
# ===== END: NFS Mount Setup =====

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
echo "  3. Verify NAS access: ls -la $MOUNT_POINT"
echo "  4. Run ./deploy.sh to deploy the application"
