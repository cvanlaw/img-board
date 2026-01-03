# Issue: Admin Config Save Returns 500 Internal Server Error

**Date Discovered:** 2026-01-03
**Status:** Open
**Severity:** High (Breaks core admin functionality)

## Summary

When attempting to save slideshow interval settings via the admin page, the server returns a 500 Internal Server Error. The configuration cannot be updated through the admin interface.

## Steps to Reproduce

1. Navigate to admin page: `https://imgboard.alton.vanlawlabs.com:3000/admin.html`
2. Change the "Interval (milliseconds)" field to any valid value (e.g., 5000)
3. Click "Save Slideshow Settings" button
4. Observe error message: "Error: Failed to update configuration"

## Expected Behavior

- Config should save successfully
- Message should show "Settings saved!"
- New interval should be persisted to `config.json`
- SSE broadcast should notify connected slideshow clients

## Actual Behavior

- POST request to `/api/admin/config` returns HTTP 500
- Error message displays: "Error: Failed to update configuration"
- Config is not updated
- No SSE broadcast occurs

## Technical Details

### Request
```
POST /api/admin/config
Content-Type: application/json
Body: {"slideshowInterval": 5000}
```

### Response
```
HTTP/1.1 500 Internal Server Error
{"error": "Failed to update configuration"}
```

### Relevant Code

**server.js:121-151** - POST /api/admin/config handler:
```javascript
app.post('/api/admin/config', async (req, res) => {
  try {
    const currentConfig = JSON.parse(await fs.readFile('./config.json', 'utf8'));
    const newConfig = deepMerge(currentConfig, req.body);
    // ... validation ...

    const tempFile = './config.json.tmp';
    await fs.writeFile(tempFile, JSON.stringify(newConfig, null, 2));
    await fs.rename(tempFile, './config.json');
    // ...
  } catch (err) {
    log('error', 'Config update failed', { error: err.message });
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});
```

## Root Cause Analysis (5 Whys)

### Why #1: Why does saving the interval setting fail?
The POST request to `/api/admin/config` returns HTTP 500 Internal Server Error.

### Why #2: Why does the POST request return 500?
The server code catches an exception when attempting to write to `config.json`. The error is logged but the generic message "Failed to update configuration" is returned to the client.

### Why #3: Why can't the server write to config.json?
The file is mounted as **read-only** in the Docker container. Any write operation (including creating the temp file `config.json.tmp` or renaming it) fails with a filesystem permission error.

### Why #4: Why is config.json mounted as read-only?
In `deploy/docker-compose.yml` line 12, the volume mount includes the `:ro` flag:
```yaml
volumes:
  - ./config.json:/app/config.json:ro  # <-- READ-ONLY
```

### Why #5: Why was it configured as read-only?
The read-only flag was likely added as a security/immutability pattern to prevent accidental or malicious modification of the configuration file at runtime. However, this conflicts with the admin interface's design which expects to modify the config file dynamically.

---

## Root Cause

**The config.json file is mounted read-only in the Docker container**, making it impossible for the admin interface to save configuration changes.

**Location:** `deploy/docker-compose.yml:12`
```yaml
- ./config.json:/app/config.json:ro
```

---

## Recommended Fix Options

### Option 1: Remove read-only flag (Simple)
Change the mount to allow writes:
```yaml
- ./config.json:/app/config.json
```
**Pros:** Simple, maintains current architecture
**Cons:** Config file on host can be modified by container

### Option 2: Separate mutable settings file
Keep config.json read-only for static settings, create a new `settings.json` for runtime-modifiable settings:
- `config.json:ro` - Static settings (paths, HTTPS config, etc.)
- `settings.json` - Mutable settings (interval, shuffle, etc.)

**Pros:** Security for critical settings, mutability for admin settings
**Cons:** Code changes required, two config files to manage

### Option 3: Use environment variables for static config
Move static configuration to environment variables, use config.json only for mutable settings.

**Pros:** Follows 12-factor app principles
**Cons:** Significant code changes

---

## Impact

- All admin configuration changes are blocked
- Slideshow interval cannot be modified without container rebuild
- Preprocessing settings cannot be changed dynamically
- Reprocessing cannot be triggered via admin UI
