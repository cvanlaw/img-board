# Issue: Admin Config Save Returns 500 Internal Server Error

**Date Discovered:** 2026-01-03
**Date Resolved:** 2026-01-03
**Status:** Resolved
**Severity:** High (Breaks core admin functionality)

## Summary

When attempting to save slideshow interval settings via the admin page, the server returns a 500 Internal Server Error. The configuration cannot be updated through the admin interface.

## Root Cause

**Two issues identified:**

### Issue 1: Read-only volume mount (Fixed in commit 4dd3a12)

The config.json file was mounted read-only in Docker:
```yaml
- ./config.json:/app/config.json:ro  # <-- was READ-ONLY
```

### Issue 2: Cross-filesystem rename failure

The atomic write pattern used `fs.rename()` to replace the config file:
```javascript
const tempFile = './config.json.tmp';
await fs.writeFile(tempFile, JSON.stringify(newConfig, null, 2));
await fs.rename(tempFile, './config.json');
```

When Docker bind-mounts a single file:
- `/app/config.json` is on the host filesystem (bind mount)
- `/app/config.json.tmp` is on the container's overlay filesystem

`fs.rename()` fails with `EXDEV` (cross-device link not permitted) because the rename syscall cannot move files across different filesystems.

## Resolution

1. Removed `:ro` flag from docker-compose volume mount (commit 4dd3a12)
2. Replaced temp-file-then-rename pattern with direct `fs.writeFile()`:

```javascript
// Before (broken)
const tempFile = './config.json.tmp';
await fs.writeFile(tempFile, JSON.stringify(newConfig, null, 2));
await fs.rename(tempFile, './config.json');

// After (working)
await fs.writeFile('./config.json', JSON.stringify(newConfig, null, 2));
```

3. Added error details to response for easier debugging:
```javascript
res.status(500).json({ error: 'Failed to update configuration', details: err.message });
```

## Files Modified

- `server.js` - Lines 133, 147
- `deploy/docker-compose.yml` - Line 12 (previous commit)

## Verification

1. Deploy updated container
2. Navigate to admin page
3. Change slideshow interval
4. Verify save succeeds with "Settings saved!" message
5. Verify slideshow receives new config via SSE
