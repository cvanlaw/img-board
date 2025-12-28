# Deployment Design

The application will be containerized and run in docker containers on an Ubuntu Server host (latest LTS). The containers should be built locally on the host and build and deployment should be orchestrated using Ansible.

## Architecture Overview

**Environment:**
- Host OS: Ubuntu Server (latest LTS)
- Network: Private network with internet access
- Docker: Latest stable Docker Engine + Compose plugin
- Orchestration: Ansible (roles-based architecture)

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
- Updates: Manual re-deployment with `ansible-playbook --tags certificates`

**NAS Integration:**
- Raw images: `/mnt/nas/photos/raw` → `/mnt/photos/raw:ro` (read-only)
- Processed images: `/mnt/nas/photos/processed` → `/mnt/photos/processed`
- Archive: `/mnt/nas/photos/archive` → `/mnt/photos/archive`

## Implementation

### Ansible Directory Structure

```
ansible/
├── ansible.cfg                      # Ansible configuration
├── inventory/
│   └── production/
│       ├── hosts.yml               # Host definitions
│       └── group_vars/
│           └── all.yml             # Configuration variables
├── playbooks/
│   ├── deploy.yml                  # Main deployment playbook
│   └── rollback.yml                # Rollback playbook
├── roles/
│   ├── common/                     # System prerequisites
│   │   ├── tasks/main.yml
│   │   ├── handlers/main.yml
│   │   └── defaults/main.yml
│   ├── docker/                     # Docker installation
│   │   ├── tasks/main.yml
│   │   ├── handlers/main.yml
│   │   └── defaults/main.yml
│   ├── certificates/               # Certificate management
│   │   ├── tasks/main.yml
│   │   ├── handlers/main.yml
│   │   └── defaults/main.yml
│   ├── app-build/                  # Docker image build
│   │   ├── tasks/main.yml
│   │   ├── handlers/main.yml
│   │   └── defaults/main.yml
│   └── app-deploy/                 # Application deployment
│       ├── tasks/main.yml
│       ├── handlers/main.yml
│       ├── defaults/main.yml
│       └── templates/
│           ├── config.json.j2
│           └── docker-compose.yml.j2
└── files/
```

### Role Responsibilities

#### Role 1: common
**Purpose:** Prepare Ubuntu host with system prerequisites and AWS tooling

**Tasks:**
- Create `imgboard` user (UID 1100, matches Docker container)
- Install packages: `python3-pip`, `python3-boto3`, `unzip`, `curl`, `git`
- Install AWS CLI v2
- Create directory structure: `/opt/imgboard/{source,certs,bin}`, `/var/log/imgboard`
- Verify S3 access

**Variables:**
- `app_user`: imgboard
- `app_user_uid`: 1100
- `app_base_dir`: /opt/imgboard
- `aws_region`: us-east-1

**Note:** AWS credentials configured via environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) or IAM instance profile.

#### Role 2: docker
**Purpose:** Install Docker Engine and Compose plugin

**Tasks:**
- Remove old Docker versions
- Add Docker GPG key and apt repository
- Install Docker packages: `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-compose-plugin`
- Configure `/etc/docker/daemon.json` with logging limits (10MB × 3 files)
- Add `imgboard` user to `docker` group
- Enable `docker.service`

**Handler:** Restart Docker daemon on config changes

#### Role 3: certificates
**Purpose:** Download TLS certificates from S3

**Tasks:**
- Download certificates from S3:
  - `cert.pem` (mode 644)
  - `key.pem` (mode 600)
  - `chain.pem` (mode 644)
- Set ownership: `imgboard:imgboard`
- Verify certificate validity (warn if < 30 days)

**Variables:**
- `s3_cert_bucket`: S3 bucket name
- `cert_hostname`: Hostname for certificate path

**Handler:** Restart container when certificates change

**Module:** `amazon.aws.s3_object` for S3 downloads

#### Role 4: app-build
**Purpose:** Build Docker image locally on host

**Tasks:**
- Clone/sync application source code
- Build Docker image with timestamp tag
- Tag image as `latest`
- Prune old images (optional)

**Variables:**
- `build_method`: git or sync
- `app_git_repo`: GitHub repository URL
- `app_docker_image`: imgboard/slideshow

**Module:** `community.docker.docker_image`

#### Role 5: app-deploy
**Purpose:** Deploy containerized application with HTTPS enabled

**Tasks:**
- Generate `config.json` from template (HTTPS enabled)
- Generate `docker-compose.yml` from template (certificate mounts)
- Deploy container using Docker Compose
- Wait for health check (5 retries × 10s)
- Verify HTTPS endpoint

**Templates:**
- `config.json.j2`: Application configuration with `https.enabled: true`
- `docker-compose.yml.j2`: Docker Compose configuration with certificate volumes

**Variables:**
- `app_https_enabled`: true
- `app_port`: 3000
- `nas_raw_path`: /mnt/nas/photos/raw
- `nas_processed_path`: /mnt/nas/photos/processed
- `nas_archive_path`: /mnt/nas/photos/archive
- Application settings (slideshow interval, dimensions, quality, etc.)

**Handler:** Restart container on config changes

**Module:** `community.docker.docker_compose`

### Deployment Playbook

**File:** `playbooks/deploy.yml`

```yaml
- name: Deploy img-board slideshow application
  hosts: slideshow_servers
  become: yes

  pre_tasks:
    - name: Verify NAS mounts accessible
      stat:
        path: "{{ nas_mount_base }}"
      register: nas_mount
      failed_when: not nas_mount.stat.exists

  roles:
    - role: common
      tags: [common, setup]
    - role: docker
      tags: [docker, setup]
    - role: certificates
      tags: [certificates, certs]
    - role: app-build
      tags: [build, app]
    - role: app-deploy
      tags: [deploy, app]
```

### Inventory Configuration

**File:** `inventory/production/hosts.yml`

```yaml
all:
  children:
    slideshow_servers:
      hosts:
        imgboard-prod-01:
          ansible_host: 192.168.1.100
          ansible_user: ubuntu
          ansible_become: yes
          cert_hostname: imgboard.example.com
```

**File:** `inventory/production/group_vars/all.yml`

```yaml
# S3 configuration
s3_cert_bucket: my-cert-bucket-name

# Git configuration
app_git_repo: https://github.com/myorg/img-board.git

# Application configuration
app_slideshow_interval: 5000
app_target_width: 1920
app_target_height: 1080
build_method: git
nas_mount_base: /mnt/nas/photos
```

### Deployment Workflows

**Initial Deployment:**
```bash
cd ansible/
ansible all -m ping
ansible-playbook playbooks/deploy.yml
curl -k https://192.168.1.100:3000/health
```

**Update Application:**
```bash
ansible-playbook playbooks/deploy.yml --tags app
```

**Update Certificates:**
```bash
ansible-playbook playbooks/deploy.yml --tags certificates
```

**Rollback:**
```bash
ansible-playbook playbooks/rollback.yml
# Prompts for image tag to rollback to
```

### Certificate Management

**Renewal Process:**
1. cert-getter Lambda renews certificates (daily 3:00 AM UTC)
2. Certificates uploaded to S3: `s3://{bucket}/{hostname}/`
3. Manual update on host: `ansible-playbook playbooks/deploy.yml --tags certificates`

**Certificate Files:**
- `/opt/imgboard/certs/cert.pem` (644, owner imgboard:imgboard)
- `/opt/imgboard/certs/key.pem` (600, owner imgboard:imgboard)
- `/opt/imgboard/certs/chain.pem` (644, owner imgboard:imgboard)

**Container Mounts:**
- `/opt/imgboard/certs/cert.pem:/certs/cert.pem:ro`
- `/opt/imgboard/certs/key.pem:/certs/key.pem:ro`
- `/opt/imgboard/certs/chain.pem:/certs/chain.pem:ro`

### Security Considerations

1. **AWS Credentials:** Configured via environment variables or IAM instance profile (not stored in Ansible)
2. **Certificate Permissions:** Private key restricted to 600, owned by app user
3. **Container User:** Non-root execution (UID 1100)
4. **HTTPS Only:** Application configured for HTTPS-only operation
5. **Docker Group:** App user has docker group membership for compose operations

### File Permissions Strategy

**Container User Mapping:**
- Dockerfile USER: UID 1100
- Docker Compose user: `1100:1100`
- Host user: imgboard (UID 1100, GID 1100)
- Certificate directory owned by UID 1100 for container accessibility

**NAS Mounts:**
- Raw directory: Read-only (`:ro`)
- Processed directory: Read-write (preprocessor output)
- Archive directory: Read-write (preprocessor archival)

### Idempotency and Error Handling

**Idempotent Design:**
- Certificate downloads: Only restart if changed
- Container deployment: `recreate: smart` (only on config change)
- Docker build: Layer caching minimizes rebuild time
- User creation: `state: present` with `create_home: yes`

**Error Recovery:**
- Failed cert download → Playbook fails, container runs with old certs
- Failed Docker build → Deployment stops, previous container continues
- Failed health check → Playbook fails, investigate logs, rollback available
- Missing NAS mounts → Pre-task validation fails before deployment

### Testing Strategy

**Pre-deployment:**
```bash
ansible-playbook playbooks/deploy.yml --syntax-check
ansible-playbook playbooks/deploy.yml --check
ansible-playbook playbooks/deploy.yml --limit imgboard-prod-01
```

**Post-deployment:**
```bash
ansible slideshow_servers -m shell -a "docker ps | grep image-slideshow" --become
ansible slideshow_servers -m uri -a "url=https://{{ ansible_host }}:3000/health validate_certs=no"
ansible slideshow_servers -m shell -a "openssl x509 -in /opt/imgboard/certs/cert.pem -noout -dates" --become
```

### Critical Implementation Files

**Application Files (Reference):**
- `server.js:352-402` - HTTPS initialization logic
- `docker-compose.yml:19-20` - Certificate volume mounts (currently commented)
- `config.json:21-25` - HTTPS configuration structure
- `Dockerfile` - USER directive and UID/GID
- `start.js` - Signal handling for graceful shutdown

**Ansible Files (To Create):**
- `ansible/ansible.cfg` - Ansible configuration
- `ansible/inventory/production/hosts.yml` - Host inventory
- `ansible/inventory/production/group_vars/all.yml` - Configuration variables
- `ansible/roles/*/tasks/main.yml` - Role task definitions
- `ansible/roles/*/handlers/main.yml` - Role handlers
- `ansible/roles/*/defaults/main.yml` - Role default variables
- `ansible/roles/app-deploy/templates/config.json.j2` - Config template
- `ansible/roles/app-deploy/templates/docker-compose.yml.j2` - Compose template
- `ansible/playbooks/deploy.yml` - Main deployment playbook
- `ansible/playbooks/rollback.yml` - Rollback playbook

### Expected Outcomes

After deployment:
- Application accessible at `https://{hostname}:3000`
- Admin interface at `https://{hostname}:3000/admin`
- Container auto-restarts on failure
- Logs available: `docker compose logs -f`
- Health check validates HTTPS endpoint
- Certificates updatable via re-run of playbook with `--tags certificates`

