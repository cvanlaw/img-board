# Task 03: Express Server Core

## Description
Create the Express web server that serves static files, provides an API endpoint for listing images, and serves image files from the processed directory.

## Dependencies
- Task 01: Project Initialization (package.json with express)

## Deliverables
- `server.js` - Express application (initial version without file watching/SSE)

## Acceptance Criteria
- [ ] Server starts on configured port
- [ ] `GET /` serves static files from `public/` directory
- [ ] `GET /api/images` returns JSON array of image filenames
- [ ] `GET /images/:filename` serves image files from configured imagePath
- [ ] Only serves files with allowed extensions (security)
- [ ] Validates paths to prevent directory traversal attacks
- [ ] Logs requests (JSON format)
- [ ] Optional: Shuffles image list if `randomOrder: true`

## Implementation Details

### Basic Server Setup
```javascript
const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const config = require('./config.json');
const app = express();

// Serve static frontend files
app.use(express.static('public'));

// Serve images from configured path
app.get('/images/:filename', (req, res) => {
  const filename = req.params.filename;
  // Validate extension
  const ext = path.extname(filename).toLowerCase();
  if (!config.imageExtensions.includes(ext)) {
    return res.status(403).send('Forbidden');
  }
  // Prevent directory traversal
  const safeName = path.basename(filename);
  const imagePath = path.join(config.imagePath, safeName);
  res.sendFile(imagePath);
});
```

### Image List API
```javascript
app.get('/api/images', async (req, res) => {
  const files = await fs.readdir(config.imagePath);
  let images = files.filter(f =>
    config.imageExtensions.includes(path.extname(f).toLowerCase())
  );

  if (config.randomOrder) {
    images = shuffleArray(images);
  }

  res.json(images);
});

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

### Health Check Endpoint
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime()
  });
});
```

### Server Startup
```javascript
app.listen(config.port, () => {
  log('info', 'Server started', { port: config.port });
});
```

### Security Considerations
- Validate all file paths to prevent traversal (../)
- Only serve files with configured extensions
- Use `path.basename()` to strip directory components

## Testing Checklist
- [ ] Server starts on configured port
- [ ] `curl http://localhost:3000/` returns HTML (or 404 if no index.html yet)
- [ ] `curl http://localhost:3000/api/images` returns JSON array
- [ ] Images serve correctly via `/images/:filename`
- [ ] Request for `../../../etc/passwd` blocked (traversal attack)
- [ ] Request for `.exe` file blocked (extension filter)
- [ ] `/health` endpoint returns status JSON
- [ ] Empty directory returns empty array (not error)
