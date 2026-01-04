---
id: 4
title: Upload JavaScript Logic
depends_on: [2, 3]
status: pending
---

# Task 4: Upload JavaScript Logic

## Description

Implement the client-side JavaScript for handling file selection, preview rendering, validation, and upload with progress tracking. Integrates with the upload API endpoint and UI components.

## Deliverables

- `public/js/admin.js` - Add upload state management and functions

## Acceptance Criteria

- [ ] Drop zone responds to click and drag-and-drop events
- [ ] Files validated client-side for extension and size before queuing
- [ ] Thumbnail previews generated using `URL.createObjectURL()`
- [ ] Remove button on each preview removes file from queue
- [ ] Clear button removes all queued files
- [ ] Upload button text updates to show file count
- [ ] Upload button enabled only when files are queued
- [ ] XHR upload shows progress percentage in progress bar
- [ ] Success message displays after successful upload
- [ ] Error messages display for failed uploads
- [ ] Stats refresh after upload completes (with delay for processing)
- [ ] Maximum 10 files enforced client-side

## Implementation Details

### State and Initialization

```javascript
// Upload state
let filesToUpload = [];

// Initialize drop zone event handlers on page load
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = ''; // Reset for re-selection
  });
});
```

### File Handling

```javascript
function handleFiles(fileList) {
  const validExtensions = ['.jpg', '.jpeg', '.png'];
  const maxSize = 50 * 1024 * 1024; // 50MB

  for (const file of fileList) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(ext)) {
      showMessage('upload-message', `Skipped ${file.name}: invalid type`, 'error');
      continue;
    }
    if (file.size > maxSize) {
      showMessage('upload-message', `Skipped ${file.name}: exceeds 50MB`, 'error');
      continue;
    }
    if (filesToUpload.length >= 10) {
      showMessage('upload-message', 'Maximum 10 files allowed', 'error');
      break;
    }

    // Check for duplicates
    if (!filesToUpload.some(f => f.name === file.name && f.size === file.size)) {
      filesToUpload.push(file);
    }
  }

  renderPreview();
  updateUploadButton();
}
```

### Preview Rendering

```javascript
function renderPreview() {
  const container = document.getElementById('upload-preview');
  container.innerHTML = '';

  filesToUpload.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'upload-preview-item';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'x';
    removeBtn.onclick = () => removeFile(index);

    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = file.name;

    item.appendChild(img);
    item.appendChild(removeBtn);
    item.appendChild(fileName);
    container.appendChild(item);
  });
}

function removeFile(index) {
  filesToUpload.splice(index, 1);
  renderPreview();
  updateUploadButton();
}

function clearUploadQueue() {
  filesToUpload = [];
  renderPreview();
  updateUploadButton();
  showMessage('upload-message', '', '');
}

function updateUploadButton() {
  const btn = document.getElementById('upload-btn');
  btn.disabled = filesToUpload.length === 0;
  btn.textContent = filesToUpload.length > 0
    ? `Upload ${filesToUpload.length} File${filesToUpload.length > 1 ? 's' : ''}`
    : 'Upload Selected Files';
}
```

### Upload Function

```javascript
async function uploadFiles() {
  if (filesToUpload.length === 0) return;

  const formData = new FormData();
  filesToUpload.forEach(file => formData.append('images', file));

  const progressBar = document.getElementById('upload-progress');
  const progressFill = document.getElementById('upload-progress-fill');
  const uploadBtn = document.getElementById('upload-btn');

  progressBar.style.display = 'block';
  progressFill.style.width = '0%';
  uploadBtn.disabled = true;
  showMessage('upload-message', 'Uploading...', '');

  try {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total) * 100;
        progressFill.style.width = percent + '%';
      }
    });

    const response = await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            reject(JSON.parse(xhr.responseText));
          } catch {
            reject({ error: xhr.statusText });
          }
        }
      };
      xhr.onerror = () => reject({ error: 'Network error' });

      xhr.open('POST', '/api/admin/upload');
      xhr.send(formData);
    });

    showMessage('upload-message', response.message, 'success');
    clearUploadQueue();

    // Refresh stats after a delay to allow processing
    setTimeout(updateStats, 3000);

  } catch (err) {
    showMessage('upload-message', 'Upload failed: ' + (err.error || err.message), 'error');
  } finally {
    progressBar.style.display = 'none';
    updateUploadButton();
  }
}
```

## Testing Checklist

- [ ] Click drop zone opens file picker
- [ ] Drag file over drop zone shows blue border
- [ ] Drop files adds them to preview
- [ ] Select files via picker adds them to preview
- [ ] Invalid file type shows error and is not added
- [ ] File >50MB shows error and is not added
- [ ] Selecting 11+ files shows error after 10th
- [ ] Remove button removes single file from queue
- [ ] Clear button removes all files from queue
- [ ] Upload button shows count (e.g., "Upload 3 Files")
- [ ] Upload button disabled when queue is empty
- [ ] Progress bar appears during upload
- [ ] Progress bar fills as upload progresses
- [ ] Success message appears after upload
- [ ] Preview clears after successful upload
- [ ] Stats update after upload (after processing delay)
- [ ] Network error shows error message
