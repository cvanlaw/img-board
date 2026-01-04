---
id: 24
title: Fix Raw Directory Volume Mount
depends_on: []
status: pending
---

# Task 24: Fix Raw Directory Volume Mount

## Description

Update the Docker Compose deployment configuration to allow write access to the raw photos directory. The current `:ro` (read-only) mount prevents the upload feature from saving files, causing 400 Bad Request errors with "EROFS: read-only file system".

## Deliverables

- `deploy/docker-compose.yml` - Updated volume mount for raw directory

## Acceptance Criteria

- [ ] Raw photos volume mount does not use `:ro` suffix
- [ ] Upload endpoint can write files to `/mnt/photos/raw/`
- [ ] Existing read-only mounts for certificates remain unchanged
- [ ] Container restarts successfully with updated configuration

## Implementation Details

### docker-compose.yml Change

Update line 18 from:

```yaml
- /mnt/nas/photos/raw:/mnt/photos/raw:ro
```

To:

```yaml
- /mnt/nas/photos/raw:/mnt/photos/raw
```

The processed and archive directories are already writable (no `:ro` suffix).

## Testing Checklist

- [ ] Redeploy container: `docker compose up -d --build`
- [ ] Navigate to admin UI upload section
- [ ] Select and upload a test image
- [ ] Verify file appears in raw directory
- [ ] Verify preprocessor converts the image to processed directory

## References

- Issue: docs/issues/upload-readonly-filesystem.md
