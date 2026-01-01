# NAS Setup for img-board

This document describes the NFS server requirements and configuration for img-board.

## NFS Server Requirements

The img-board application requires an NFS server with the following export:

- **Export path:** `/img-board`
- **Access:** Read/write for client hosts
- **Protocol:** NFSv3 or NFSv4
- **Authentication:** None required (trust-based on IP/network)

### Directory Structure

The export must contain three subdirectories:

```
/img-board/
├── raw/         # Source images (read by preprocessor)
├── processed/   # WebP images (written by preprocessor, read by server)
└── archive/     # Archived originals (optional)
```

## Example NFS Server Configuration

On a Synology NAS or Linux server:

### Option 1: Synology DSM

1. Control Panel → Shared Folder → Create `img-board`
2. Create subdirectories: `raw`, `processed`, `archive`
3. Control Panel → File Services → Enable NFS
4. Shared Folder → img-board → Edit → NFS Permissions
   - Server: `192.168.0.0/24` (or specific client IP)
   - Privilege: Read/Write
   - Squash: Map all users to admin
   - Enable asynchronous

### Option 2: Linux NFS Server

Install NFS server:
```bash
sudo apt-get install nfs-kernel-server
```

Create directory structure:
```bash
sudo mkdir -p /srv/img-board/{raw,processed,archive}
sudo chmod -R 755 /srv/img-board
```

Configure `/etc/exports`:
```
/srv/img-board 192.168.0.0/24(rw,sync,no_subtree_check,all_squash,anonuid=1000,anongid=1000)
```

Apply changes:
```bash
sudo exportfs -ra
sudo systemctl restart nfs-kernel-server
```

## Client Configuration

The img-board `setup.sh` script handles client configuration automatically. It will:

1. Install `nfs-common` package
2. Prompt for NFS server IP
3. Create mount point `/mnt/nas/photos`
4. Add fstab entry for persistent mounting
5. Mount the NFS share
6. Create subdirectories if needed

### Manual Configuration

If needed, configure manually:

```bash
# Install NFS client
sudo apt-get install -y nfs-common

# Create mount point
sudo mkdir -p /mnt/nas/photos

# Add to fstab
echo "192.168.0.11:/img-board /mnt/nas/photos nfs defaults,_netdev,nofail 0 0" | sudo tee -a /etc/fstab

# Mount
sudo mount -a

# Verify
mountpoint /mnt/nas/photos
```

## Troubleshooting

### Cannot mount NFS share

Check NFS server is exporting:
```bash
showmount -e 192.168.0.11
```

Expected output:
```
Export list for 192.168.0.11:
/img-board 192.168.0.0/24
```

### Permission denied errors

Check NFS export permissions and UID/GID mapping. The container runs as UID 1000 by default.

### Network issues

Verify connectivity:
```bash
ping 192.168.0.11
rpcinfo -p 192.168.0.11
```

### Mount at boot fails

Ensure `_netdev` option is in fstab (waits for network).

Check systemd mount dependencies:
```bash
sudo systemctl status mnt-nas-photos.mount
```

## Security Considerations

1. **Network isolation:** NFS server should only be accessible on private network
2. **Firewall:** Restrict NFS ports (2049, 111) to trusted subnet
3. **No authentication:** NFS v3 has no user authentication, relies on IP-based trust
4. **Read-only mounts:** Container mounts `raw/` as read-only for safety

For enhanced security, consider NFSv4 with Kerberos authentication.
