// Toast notification system
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '\u2713' : '\u26A0'}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Unsaved changes tracking
let hasUnsavedChanges = false;

function markAsUnsaved() {
  hasUnsavedChanges = true;
}

function clearUnsavedChanges() {
  hasUnsavedChanges = false;
}

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ETA calculation for reprocessing
let processingStartTime = null;

function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function calculateETA(completed, total) {
  if (!processingStartTime || completed === 0) return null;

  const remaining = total - completed;
  const elapsed = Date.now() - processingStartTime;
  const rate = completed / (elapsed / 1000); // images per second
  const etaSeconds = remaining / rate;

  return formatTime(etaSeconds);
}

// Confirmation dialog helper
function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-dialog');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;

    const handleConfirm = () => {
      dialog.close();
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      dialog.close();
      cleanup();
      resolve(false);
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    const cleanup = () => {
      document
        .getElementById('confirm-ok')
        .removeEventListener('click', handleConfirm);
      document
        .getElementById('confirm-cancel')
        .removeEventListener('click', handleCancel);
      dialog.removeEventListener('keydown', handleEscape);
    };

    document
      .getElementById('confirm-ok')
      .addEventListener('click', handleConfirm);
    document
      .getElementById('confirm-cancel')
      .addEventListener('click', handleCancel);
    dialog.addEventListener('keydown', handleEscape);

    dialog.showModal();
  });
}

async function loadConfig() {
  try {
    const res = await fetch('/api/admin/config');
    const config = await res.json();

    document.getElementById('interval').value =
      config.slideshowInterval / 60000;
    document.getElementById('width').value = config.preprocessing.targetWidth;
    document.getElementById('height').value = config.preprocessing.targetHeight;
  } catch (err) {
    showMessage(
      'slideshow-message',
      'Error loading config: ' + err.message,
      'error'
    );
  }
}

async function updateStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const stats = await res.json();

    document.getElementById('raw-count').textContent = stats.raw;
    document.getElementById('processed-count').textContent = stats.processed;
    document.getElementById('stats-timestamp').textContent = new Date(
      stats.timestamp
    ).toLocaleTimeString();
  } catch (err) {
    console.error('Error updating stats:', err);
  }
}

async function saveSlideshow() {
  const intervalMinutes = parseFloat(document.getElementById('interval').value);

  if (intervalMinutes < 0.1) {
    showToast('Interval must be at least 0.1 minutes', 'error');
    return;
  }

  const interval = Math.round(intervalMinutes * 60000);
  const btn = document.getElementById('save-slideshow-btn');
  const originalText = btn.textContent;

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slideshowInterval: interval }),
    });

    if (res.ok) {
      showToast('Slideshow settings saved!', 'success');
      clearUnsavedChanges();
    } else {
      const error = await res.json();
      showToast('Error: ' + error.error, 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function savePreprocessing() {
  const width = parseInt(document.getElementById('width').value);
  const height = parseInt(document.getElementById('height').value);

  if (width < 1 || height < 1) {
    showToast('Width and height must be positive', 'error');
    return;
  }

  const confirmed = await showConfirmDialog(
    'Confirm Reprocessing',
    `This will reprocess ALL images with ${width}x${height}. Continue?`
  );
  if (!confirmed) return;

  const btn = document.getElementById('save-preprocessing-btn');
  const originalText = btn.textContent;

  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preprocessing: { targetWidth: width, targetHeight: height },
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      showToast('Error: ' + error.error, 'error');
      return;
    }

    const result = await res.json();
    clearUnsavedChanges();
    if (result.reprocessing) {
      showToast('Reprocessing started...', 'success');
      document.getElementById('progress-container').style.display = 'block';
      processingStartTime = Date.now();
      monitorReprocessing();
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function manualReprocess() {
  const confirmed = await showConfirmDialog(
    'Confirm Reprocessing',
    'Reprocess all images with current settings?'
  );
  if (!confirmed) return;

  const btn = document.getElementById('manual-reprocess-btn');
  const originalText = btn.textContent;

  btn.disabled = true;
  btn.textContent = 'Processing...';

  try {
    const res = await fetch('/api/admin/reprocess', { method: 'POST' });
    const result = await res.json();

    if (res.ok) {
      showToast('Reprocessing started...', 'success');
      document.getElementById('progress-container').style.display = 'block';
      processingStartTime = Date.now();
      monitorReprocessing();
    } else {
      showToast('Error: ' + result.error, 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function monitorReprocessing() {
  try {
    const res = await fetch('/api/admin/reprocess-status');
    const status = await res.json();

    if (status.active) {
      const percent = Math.round((status.completed / status.total) * 100);
      const progressFill = document.getElementById('progress-fill');
      const progressLabel = progressFill.querySelector('.progress-label');

      progressFill.style.width = percent + '%';
      if (progressLabel) {
        progressLabel.textContent = percent + '%';
      }

      let progressText = `Processing: ${status.completed}/${status.total}`;
      if (status.failed) {
        progressText += ` (${status.failed} failed)`;
      }

      const eta = calculateETA(status.completed, status.total);
      if (eta) {
        progressText += ` - ETA: ${eta}`;
      }

      document.getElementById('progress-text').textContent = progressText;

      setTimeout(monitorReprocessing, 1000);
    } else {
      const progressFill = document.getElementById('progress-fill');
      const progressLabel = progressFill.querySelector('.progress-label');

      progressFill.style.width = '100%';
      if (progressLabel) {
        progressLabel.textContent = '100%';
      }

      document.getElementById('progress-text').textContent = 'Complete!';
      processingStartTime = null;
      setTimeout(() => {
        document.getElementById('progress-container').style.display = 'none';
        updateStats();
      }, 2000);
    }
  } catch (err) {
    document.getElementById('progress-container').style.display = 'none';
    processingStartTime = null;
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

  // Track unsaved changes on settings inputs
  document.querySelectorAll('#interval, #width, #height').forEach((input) => {
    input.addEventListener('change', markAsUnsaved);
    input.addEventListener('input', markAsUnsaved);
  });
});

function handleFiles(fileList) {
  const validExtensions = ['.jpg', '.jpeg', '.png'];
  const maxSize = 50 * 1024 * 1024; // 50MB

  for (const file of fileList) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(ext)) {
      showToast(`Skipped ${file.name}: invalid type`, 'error');
      continue;
    }
    if (file.size > maxSize) {
      showToast(`Skipped ${file.name}: exceeds 50MB`, 'error');
      continue;
    }
    if (filesToUpload.length >= 10) {
      showToast('Maximum 10 files allowed', 'error');
      break;
    }

    // Check for duplicates
    if (
      !filesToUpload.some((f) => f.name === file.name && f.size === file.size)
    ) {
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
  btn.textContent =
    filesToUpload.length > 0
      ? `Upload ${filesToUpload.length} File${filesToUpload.length > 1 ? 's' : ''}`
      : 'Upload Selected Files';
}

async function uploadFiles() {
  if (filesToUpload.length === 0) return;

  const formData = new FormData();
  filesToUpload.forEach((file) => formData.append('images', file));

  const progressBar = document.getElementById('upload-progress');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressLabel = progressFill.querySelector('.progress-label');
  const uploadBtn = document.getElementById('upload-btn');

  progressBar.style.display = 'block';
  progressFill.style.width = '0%';
  if (progressLabel) {
    progressLabel.textContent = '0%';
  }
  uploadBtn.disabled = true;
  showMessage('upload-message', 'Uploading...', '');

  try {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressFill.style.width = percent + '%';
        if (progressLabel) {
          progressLabel.textContent = percent + '%';
        }
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

    showToast(response.message, 'success');
    clearUploadQueue();

    // Refresh stats after a delay to allow processing
    setTimeout(updateStats, 3000);
  } catch (err) {
    showToast('Upload failed: ' + (err.error || err.message), 'error');
  } finally {
    progressBar.style.display = 'none';
    updateUploadButton();
  }
}

// Smart polling with visibility detection
let pollInterval;

function startPolling() {
  pollInterval = setInterval(updateStats, 5000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling();
  } else {
    updateStats(); // Immediate refresh on return
    startPolling();
  }
});

loadConfig();
updateStats();
startPolling();
