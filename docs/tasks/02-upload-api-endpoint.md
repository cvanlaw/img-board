---
id: 2
title: Upload API Endpoint
depends_on: []
status: pending
---

# Task 2: Upload API Endpoint

## Description

Add a server-side file upload endpoint that accepts images via multipart form data and saves them to the raw directory for preprocessing. Uses multer middleware for file handling with proper validation and error handling.

## Deliverables

- `package.json` - Add multer dependency
- `server.js` - Add multer configuration, upload endpoint, and error handler

## Acceptance Criteria

- [ ] Multer dependency added to package.json
- [ ] POST `/api/admin/upload` accepts multipart/form-data with `images` field
- [ ] Files saved to `config.preprocessing.rawImagePath` with timestamp-prefixed sanitized names
- [ ] Extension validation rejects files not in `config.preprocessing.inputExtensions`
- [ ] MIME type validation rejects non-image files
- [ ] File size limited to 50MB per file, max 10 files per request
- [ ] Endpoint protected by existing `adminIPFilter` middleware
- [ ] Returns JSON with uploaded file details on success
- [ ] Returns appropriate error responses (413 for size, 400 for validation)

## Implementation Details

### Multer Configuration

```javascript
const multer = require('multer');

const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const config = require('./config.json');
    cb(null, config.preprocessing.rawImagePath);
  },
  filename: (req, file, cb) => {
    // Sanitize: remove path components, replace unsafe characters
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}-${safeName}`;
    cb(null, uniqueName);
  }
});

const uploadFilter = (req, file, cb) => {
  const config = require('./config.json');
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimes = ['image/jpeg', 'image/png'];

  if (!config.preprocessing.inputExtensions.includes(ext)) {
    return cb(new Error(`Invalid extension: ${ext}`), false);
  }
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error(`Invalid MIME type: ${file.mimetype}`), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: uploadStorage,
  fileFilter: uploadFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10
  }
});
```

### Upload Endpoint

```javascript
// POST /api/admin/upload - Upload images to raw directory
app.post('/api/admin/upload', upload.array('images', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const uploaded = req.files.map(f => ({
    original: f.originalname,
    saved: f.filename,
    size: f.size
  }));

  log('info', 'Images uploaded', { count: uploaded.length, files: uploaded.map(f => f.saved) });
  res.json({
    success: true,
    uploaded,
    message: `${uploaded.length} file(s) uploaded. Processing will begin shortly.`
  });
});
```

### Error Handler

```javascript
// Multer error handler
app.use('/api/admin/upload', (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large (max 50MB)' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files (max 10)' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    log('error', 'Upload error', { error: err.message });
    return res.status(400).json({ error: err.message });
  }
  next();
});
```

## Testing Checklist

- [ ] Run `npm install` after adding multer dependency
- [ ] Upload JPG via curl: `curl -X POST -F "images=@test.jpg" http://localhost:3000/api/admin/upload`
- [ ] Verify file appears in raw directory with timestamp prefix
- [ ] Upload PNG and verify accepted
- [ ] Upload GIF and verify rejected with error response
- [ ] Upload file >50MB and verify 413 response
- [ ] Upload 11 files and verify rejection
- [ ] Test from non-allowed IP and verify 403 response
