# Photo Upload Feature Design

## Overview

Add photo upload capability to the admin interface, allowing administrators to upload images directly to the raw directory where the preprocessor will automatically process them.

## Architecture

### Data Flow

```
Browser → POST /api/admin/upload → Multer → Raw Directory
                                              ↓
                              Chokidar detects new file
                                              ↓
                              Preprocessor converts to WebP
                                              ↓
                              Processed Directory
                                              ↓
                              SSE notifies slideshow clients
```

The preprocessor's existing `awaitWriteFinish` configuration (2-second stability threshold) handles incomplete uploads, so no special coordination is needed between the upload endpoint and file watcher.

### Components

| Component | File | Changes |
|-----------|------|---------|
| Upload endpoint | `server.js` | Add multer config + `/api/admin/upload` route |
| Admin HTML | `public/admin.html` | Add upload card with drop zone |
| Admin CSS | `public/admin.html` | Add drop zone and preview styles (inline) |
| Admin JS | `public/js/admin.js` | Add upload logic and file handling |
| Package deps | `package.json` | Add multer dependency |
| Preprocessor | `preprocessor.js` | No changes (already handles new files) |

## Server-Side Implementation

### Dependencies

```json
{
  "dependencies": {
    "multer": "^1.4.5-lts.1"
  }
}
```

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

### API Endpoint

**`POST /api/admin/upload`**

Protected by existing `adminIPFilter` middleware.

Request:
- Content-Type: `multipart/form-data`
- Field: `images` (array of files)

Response (success):
```json
{
  "success": true,
  "uploaded": [
    { "original": "photo.jpg", "saved": "1704384000000-photo.jpg", "size": 2048576 }
  ],
  "message": "2 file(s) uploaded. Processing will begin shortly."
}
```

Response (error):
```json
{
  "error": "File too large (max 50MB)"
}
```

### Error Handling

Multer errors require dedicated error handler middleware:

```javascript
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
    return res.status(400).json({ error: err.message });
  }
  next();
});
```

## Admin UI Implementation

### HTML Structure

New card after Image Statistics section:

```html
<div class="card">
  <h2>Upload Images</h2>
  <p>Supported formats: JPG, JPEG, PNG (max 50MB each, up to 10 files)</p>

  <div id="drop-zone" class="drop-zone">
    <p>Drag and drop images here, or click to select</p>
    <input type="file" id="file-input" multiple
           accept=".jpg,.jpeg,.png,image/jpeg,image/png"
           style="display: none;" />
  </div>

  <div id="upload-preview" class="upload-preview"></div>

  <button id="upload-btn" onclick="uploadFiles()" disabled>
    Upload Selected Files
  </button>
  <button onclick="clearUploadQueue()">Clear</button>

  <div id="upload-progress" class="progress-bar" style="display: none;">
    <div class="progress-fill" id="upload-progress-fill"></div>
  </div>
  <p id="upload-message"></p>
</div>
```

### CSS Styling

```css
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 4px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  margin: 1rem 0;
}

.drop-zone:hover,
.drop-zone.dragover {
  border-color: #007bff;
  background: #f0f7ff;
}

.upload-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0;
}

.upload-preview-item {
  position: relative;
  width: 80px;
  height: 80px;
}

.upload-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.upload-preview-item .remove-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
  font-size: 12px;
}

.upload-preview-item .file-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.7);
  color: white;
  font-size: 10px;
  padding: 2px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
```

### JavaScript Functions

Key functions to add to `admin.js`:

| Function | Purpose |
|----------|---------|
| `handleFiles(fileList)` | Validate and queue files for upload |
| `renderPreview()` | Display thumbnail grid with remove buttons |
| `removeFile(index)` | Remove file from queue |
| `clearUploadQueue()` | Clear all queued files |
| `updateUploadButton()` | Update button text and disabled state |
| `uploadFiles()` | Send files via XHR with progress tracking |

Progress tracking uses `XMLHttpRequest` instead of `fetch` for upload progress events:

```javascript
xhr.upload.addEventListener('progress', (e) => {
  if (e.lengthComputable) {
    const percent = (e.loaded / e.total) * 100;
    progressFill.style.width = percent + '%';
  }
});
```

## Security

| Risk | Mitigation |
|------|------------|
| Unauthorized access | Existing `adminIPFilter` middleware on `/api/admin/*` |
| Directory traversal | `path.basename()` + character sanitization |
| Invalid file types | Double validation: MIME type + extension |
| DoS via large files | 50MB per-file limit, 10 files per request |
| Incomplete uploads | Preprocessor 2-second stability threshold |
| Filename collisions | Timestamp prefix ensures uniqueness |

## Testing Checklist

- [ ] Upload single JPG file via click-to-select
- [ ] Upload single PNG file via drag-and-drop
- [ ] Upload multiple files (up to 10)
- [ ] Verify thumbnail previews display correctly
- [ ] Remove file from queue before upload
- [ ] Clear entire upload queue
- [ ] Reject file with invalid extension (.gif, .bmp, .webp)
- [ ] Reject file exceeding 50MB
- [ ] Reject request with >10 files
- [ ] Verify progress bar updates during upload
- [ ] Verify success message after upload
- [ ] Verify file appears in raw directory
- [ ] Verify preprocessor converts file to WebP
- [ ] Verify slideshow updates via SSE
- [ ] Verify stats update after processing completes
- [ ] Verify IP filtering blocks unauthorized uploads
- [ ] Verify sanitized filename in raw directory

## Implementation Order

1. Add multer to `package.json`
2. Add multer configuration to `server.js`
3. Add upload endpoint and error handler to `server.js`
4. Add upload card HTML to `admin.html`
5. Add CSS styles to `admin.html`
6. Add JavaScript functions to `admin.js`
7. Test complete flow
