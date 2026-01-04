async function loadConfig() {
  try {
    const res = await fetch('/api/admin/config');
    const config = await res.json();

    document.getElementById('interval').value = config.slideshowInterval / 60000;
    document.getElementById('width').value = config.preprocessing.targetWidth;
    document.getElementById('height').value = config.preprocessing.targetHeight;
  } catch (err) {
    showMessage('slideshow-message', 'Error loading config: ' + err.message, 'error');
  }
}

async function updateStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const stats = await res.json();

    document.getElementById('raw-count').textContent = stats.raw;
    document.getElementById('processed-count').textContent = stats.processed;
    document.getElementById('stats-timestamp').textContent =
      new Date(stats.timestamp).toLocaleTimeString();
  } catch (err) {
    console.error('Error updating stats:', err);
  }
}

async function saveSlideshow() {
  const intervalMinutes = parseFloat(document.getElementById('interval').value);

  if (intervalMinutes < 0.1) {
    showMessage('slideshow-message', 'Interval must be at least 0.1 minutes', 'error');
    return;
  }

  const interval = Math.round(intervalMinutes * 60000);

  try {
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideshowInterval: interval })
    });

    if (res.ok) {
      showMessage('slideshow-message', 'Settings saved!', 'success');
    } else {
      const error = await res.json();
      showMessage('slideshow-message', 'Error: ' + error.error, 'error');
    }
  } catch (err) {
    showMessage('slideshow-message', 'Error: ' + err.message, 'error');
  }
}

async function savePreprocessing() {
  const width = parseInt(document.getElementById('width').value);
  const height = parseInt(document.getElementById('height').value);

  if (width < 1 || height < 1) {
    showMessage('preprocessing-message', 'Width and height must be positive', 'error');
    return;
  }

  if (!confirm(`This will reprocess ALL images with ${width}x${height}. Continue?`)) {
    return;
  }

  try {
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preprocessing: { targetWidth: width, targetHeight: height }
      })
    });

    if (!res.ok) {
      const error = await res.json();
      showMessage('preprocessing-message', 'Error: ' + error.error, 'error');
      return;
    }

    const result = await res.json();
    if (result.reprocessing) {
      showMessage('preprocessing-message', 'Reprocessing started...', 'success');
      document.getElementById('progress-container').style.display = 'block';
      monitorReprocessing();
    }
  } catch (err) {
    showMessage('preprocessing-message', 'Error: ' + err.message, 'error');
  }
}

async function manualReprocess() {
  if (!confirm('Reprocess all images with current settings?')) {
    return;
  }

  try {
    const res = await fetch('/api/admin/reprocess', { method: 'POST' });
    const result = await res.json();

    if (res.ok) {
      showMessage('preprocessing-message', 'Reprocessing started...', 'success');
      document.getElementById('progress-container').style.display = 'block';
      monitorReprocessing();
    } else {
      showMessage('preprocessing-message', 'Error: ' + result.error, 'error');
    }
  } catch (err) {
    showMessage('preprocessing-message', 'Error: ' + err.message, 'error');
  }
}

async function monitorReprocessing() {
  try {
    const res = await fetch('/api/admin/reprocess-status');
    const status = await res.json();

    if (status.active) {
      const percent = (status.completed / status.total) * 100;
      document.getElementById('progress-fill').style.width = percent + '%';
      document.getElementById('progress-text').textContent =
        `Processing: ${status.completed}/${status.total}` +
        (status.failed ? ` (${status.failed} failed)` : '');

      setTimeout(monitorReprocessing, 1000);
    } else {
      document.getElementById('progress-fill').style.width = '100%';
      document.getElementById('progress-text').textContent = 'Complete!';
      setTimeout(() => {
        document.getElementById('progress-container').style.display = 'none';
        updateStats();
      }, 2000);
    }
  } catch (err) {
    document.getElementById('progress-container').style.display = 'none';
  }
}

function showMessage(elementId, message, type) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.className = type;
}

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

loadConfig();
updateStats();
setInterval(updateStats, 5000);
