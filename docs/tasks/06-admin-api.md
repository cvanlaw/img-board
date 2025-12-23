# Task 06: Admin API

## Description
Implement backend API routes for the admin interface to retrieve and update configuration, get image statistics, and trigger reprocessing.

## Dependencies
- Task 03: Express Server Core
- Task 05: File Watching & SSE (for broadcasting config updates)

## Deliverables
- Updated `server.js` with admin API routes
- Optional IP allowlist middleware

## Acceptance Criteria
- [ ] `GET /api/admin/config` returns current configuration
- [ ] `POST /api/admin/config` updates configuration with validation
- [ ] `GET /api/admin/stats` returns image counts (raw/processed)
- [ ] `POST /api/admin/reprocess` triggers reprocessing
- [ ] `GET /api/admin/reprocess-status` returns reprocessing progress
- [ ] Configuration writes are atomic (temp file + rename)
- [ ] Partial config updates use deep merge (preserve existing values)
- [ ] IP allowlist blocks unauthorized access (if configured)

## Implementation Details

### Admin Routes
```javascript
// Get current config
app.get('/api/admin/config', (req, res) => {
  const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
  res.json(config);
});

// Update config with deep merge
app.post('/api/admin/config', express.json(), async (req, res) => {
  const currentConfig = JSON.parse(await fs.promises.readFile('./config.json', 'utf8'));
  const newConfig = deepMerge(currentConfig, req.body);

  // Validation
  if (newConfig.slideshowInterval < 1000) {
    return res.status(400).json({ error: 'slideshowInterval must be >= 1000ms' });
  }
  if (newConfig.preprocessing?.quality < 1 || newConfig.preprocessing?.quality > 100) {
    return res.status(400).json({ error: 'quality must be 1-100' });
  }

  // Atomic write
  const tempFile = './config.json.tmp';
  await fs.promises.writeFile(tempFile, JSON.stringify(newConfig, null, 2));
  await fs.promises.rename(tempFile, './config.json');

  // Check if reprocessing needed
  const aspectChanged =
    req.body.preprocessing?.targetWidth !== undefined ||
    req.body.preprocessing?.targetHeight !== undefined;

  if (aspectChanged) {
    await fs.promises.writeFile('./.reprocess-trigger', Date.now().toString());
  }

  res.json({ success: true, reprocessing: aspectChanged });
});
```

### Deep Merge Utility
```javascript
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
```

### Image Statistics
```javascript
app.get('/api/admin/stats', async (req, res) => {
  const config = require('./config.json');

  let rawCount = 0;
  let processedCount = 0;

  try {
    const rawFiles = await fs.promises.readdir(config.preprocessing.rawImagePath);
    rawCount = rawFiles.filter(f =>
      config.preprocessing.inputExtensions.includes(path.extname(f).toLowerCase())
    ).length;
  } catch (e) {
    // Directory may not exist
  }

  try {
    const processedFiles = await fs.promises.readdir(config.imagePath);
    processedCount = processedFiles.filter(f =>
      config.imageExtensions.includes(path.extname(f).toLowerCase())
    ).length;
  } catch (e) {
    // Directory may not exist
  }

  res.json({
    raw: rawCount,
    processed: processedCount,
    timestamp: Date.now()
  });
});
```

### Reprocessing Endpoints
```javascript
app.post('/api/admin/reprocess', async (req, res) => {
  // Check if already running
  if (fs.existsSync('./.reprocess-trigger') || fs.existsSync('./.reprocess-progress.json')) {
    return res.status(409).json({ error: 'Reprocessing already in progress' });
  }

  await fs.promises.writeFile('./.reprocess-trigger', Date.now().toString());
  res.json({
    status: 'triggered',
    message: 'Reprocessing started. Use /api/admin/reprocess-status to monitor.'
  });
});

app.get('/api/admin/reprocess-status', async (req, res) => {
  try {
    const progress = JSON.parse(
      await fs.promises.readFile('./.reprocess-progress.json', 'utf8')
    );
    res.json({ active: true, ...progress });
  } catch (e) {
    res.json({ active: false });
  }
});
```

### IP Allowlist Middleware
```javascript
function ipMatches(clientIP, pattern) {
  const ip = clientIP.replace(/^::ffff:/, '');

  if (ip === '127.0.0.1' || ip === '::1' || clientIP === '::1') {
    return true;
  }
  if (ip === pattern) {
    return true;
  }
  if (pattern.endsWith('/24')) {
    const subnet = pattern.replace('/24', '').split('.').slice(0, 3).join('.');
    const ipPrefix = ip.split('.').slice(0, 3).join('.');
    return subnet === ipPrefix;
  }
  return false;
}

function adminIPFilter(req, res, next) {
  const config = require('./config.json');
  const clientIP = req.ip || req.connection.remoteAddress;
  const allowedPatterns = config.admin?.allowedIPs || [];

  if (allowedPatterns.length === 0) {
    return next();
  }

  const isAllowed = allowedPatterns.some(pattern => ipMatches(clientIP, pattern));
  if (!isAllowed) {
    log('warn', 'Admin access denied', { ip: clientIP });
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

// Apply to admin routes
app.use('/admin', adminIPFilter);
app.use('/api/admin', adminIPFilter);
```

## Testing Checklist
- [ ] `GET /api/admin/config` returns valid JSON config
- [ ] `POST /api/admin/config` with partial update preserves existing values
- [ ] Invalid slideshowInterval (<1000) returns 400 error
- [ ] `GET /api/admin/stats` returns correct image counts
- [ ] `POST /api/admin/reprocess` creates trigger file
- [ ] Second `POST /api/admin/reprocess` returns 409 conflict
- [ ] `GET /api/admin/reprocess-status` returns progress when active
- [ ] IP allowlist blocks requests from non-allowed IPs
- [ ] localhost (127.0.0.1) always allowed
