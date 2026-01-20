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
  } catch {
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

// Image gallery state
let allImages = [];
let currentPage = 1;
let currentFilter = 'all';
let searchQuery = '';
const imagesPerPage = 24;
let selectedImages = new Set();

async function loadImages() {
  const gallery = document.getElementById('image-gallery');
  gallery.innerHTML = '<div class="gallery-loading">Loading images...</div>';

  try {
    const res = await fetch(
      `/api/admin/images?filter=${currentFilter}&limit=1000`
    );
    const data = await res.json();
    allImages = data.images;
    renderGallery();
  } catch (err) {
    gallery.innerHTML =
      '<div class="empty-message">Failed to load images</div>';
    showToast('Failed to load images: ' + err.message, 'error');
  }
}

function renderGallery() {
  const gallery = document.getElementById('image-gallery');
  const isTrashView = currentFilter === 'trash';

  // Apply search filter
  let filtered = allImages;
  if (searchQuery) {
    filtered = allImages.filter((img) =>
      img.filename.toLowerCase().includes(searchQuery)
    );
  }

  if (filtered.length === 0) {
    gallery.innerHTML = '<div class="empty-message">No images found</div>';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  // Paginate
  const start = (currentPage - 1) * imagesPerPage;
  const pageImages = filtered.slice(start, start + imagesPerPage);

  gallery.innerHTML = pageImages
    .map((img) => {
      const classes = ['gallery-item'];
      if (img.excluded) classes.push('excluded');
      if (img.deleted) classes.push('deleted');
      if (selectedImages.has(img.filename)) classes.push('selected');

      // Determine image source based on trash status
      const imgSrc = img.deleted
        ? `/api/admin/trash-image/${encodeURIComponent(img.filename)}`
        : `/images/${encodeURIComponent(img.filename)}`;

      // Different action buttons for trash vs normal view
      let actionButtons;
      if (isTrashView) {
        actionButtons = `
          <button class="btn-icon" onclick="restoreImage('${img.filename}')" title="Restore">
            &#x21A9;
          </button>
          <button class="btn-icon btn-danger" onclick="permanentDeleteImage('${img.filename}')" title="Delete Permanently">
            &#x2716;
          </button>
        `;
      } else {
        actionButtons = `
          <button class="btn-icon rotate-btn" onclick="rotateImage('${img.filename}', 'ccw')" title="Rotate counter-clockwise" aria-label="Rotate counter-clockwise">
            &#x21BA;
          </button>
          <button class="btn-icon rotate-btn" onclick="rotateImage('${img.filename}', 'cw')" title="Rotate clockwise" aria-label="Rotate clockwise">
            &#x21BB;
          </button>
          <button class="btn-icon" onclick="toggleExclusion('${img.filename}')" title="${img.excluded ? 'Include' : 'Exclude'}">
            ${img.excluded ? '&#x1F441;' : '&#x1F6AB;'}
          </button>
          <button class="btn-icon btn-danger" onclick="deleteImage('${img.filename}')" title="Delete">
            &#x1F5D1;
          </button>
        `;
      }

      const escapedFilename = img.filename.replace(/'/g, "\\'");

      return `
        <div class="${classes.join(' ')}" data-filename="${img.filename}">
          <input type="checkbox" class="checkbox"
                 ${selectedImages.has(img.filename) ? 'checked' : ''}
                 onchange="toggleSelection('${escapedFilename}')"
                 aria-label="Select ${img.filename}">
          <img src="${imgSrc}" loading="lazy" alt="${img.filename}">
          <div class="filename" title="${img.filename}">${img.filename}</div>
          <div class="actions">
            ${actionButtons}
          </div>
        </div>
      `;
    })
    .join('');

  renderPagination(filtered.length);
  updateBulkControls();
}

function renderPagination(total) {
  const pages = Math.ceil(total / imagesPerPage);
  const pagination = document.getElementById('pagination');

  if (pages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';

  // Previous button
  if (currentPage > 1) {
    html += `<button onclick="goToPage(${currentPage - 1})" aria-label="Previous page">&laquo;</button>`;
  }

  // Page numbers (show max 7 pages with ellipsis)
  const maxVisible = 7;
  let startPage = Math.max(1, currentPage - 3);
  let endPage = Math.min(pages, startPage + maxVisible - 1);

  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `<button onclick="goToPage(1)">1</button>`;
    if (startPage > 2) {
      html += `<span style="padding: 0.5rem;">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})" ${i === currentPage ? 'aria-current="page"' : ''}>${i}</button>`;
  }

  if (endPage < pages) {
    if (endPage < pages - 1) {
      html += `<span style="padding: 0.5rem;">...</span>`;
    }
    html += `<button onclick="goToPage(${pages})">${pages}</button>`;
  }

  // Next button
  if (currentPage < pages) {
    html += `<button onclick="goToPage(${currentPage + 1})" aria-label="Next page">&raquo;</button>`;
  }

  pagination.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  renderGallery();
  // Scroll gallery into view
  document
    .getElementById('image-gallery')
    .scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function toggleExclusion(filename) {
  const img = allImages.find((i) => i.filename === filename);
  if (!img) return;

  try {
    const res = await fetch(
      `/api/admin/images/${encodeURIComponent(filename)}/exclude`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excluded: !img.excluded }),
      }
    );

    if (res.ok) {
      img.excluded = !img.excluded;
      renderGallery();
      showToast(
        img.excluded
          ? 'Image excluded from slideshow'
          : 'Image included in slideshow',
        'success'
      );
    } else {
      const err = await res.json();
      showToast('Failed: ' + err.error, 'error');
    }
  } catch {
    showToast('Failed to toggle exclusion', 'error');
  }
}

async function deleteImage(filename) {
  const confirmed = await showConfirmDialog(
    'Delete Image',
    `Move "${filename}" to trash?`
  );
  if (!confirmed) return;

  try {
    const res = await fetch(
      `/api/admin/images/${encodeURIComponent(filename)}`,
      {
        method: 'DELETE',
      }
    );

    if (res.ok) {
      allImages = allImages.filter((i) => i.filename !== filename);
      renderGallery();
      showToast('Image moved to trash', 'success');
      updateStats();
    } else {
      const data = await res.json();
      showToast('Failed: ' + data.error, 'error');
    }
  } catch {
    showToast('Failed to delete image', 'error');
  }
}

async function restoreImage(filename) {
  try {
    const res = await fetch(
      `/api/admin/images/${encodeURIComponent(filename)}/restore`,
      {
        method: 'POST',
      }
    );

    if (res.ok) {
      allImages = allImages.filter((i) => i.filename !== filename);
      renderGallery();
      showToast('Image restored', 'success');
      updateStats();
    } else {
      const data = await res.json();
      showToast('Failed: ' + data.error, 'error');
    }
  } catch {
    showToast('Failed to restore image', 'error');
  }
}

async function permanentDeleteImage(filename) {
  const confirmed = await showConfirmDialog(
    'Permanently Delete',
    `Permanently delete "${filename}"? This cannot be undone!`
  );
  if (!confirmed) return;

  try {
    const res = await fetch(
      `/api/admin/images/${encodeURIComponent(filename)}/permanent`,
      {
        method: 'DELETE',
      }
    );

    if (res.ok) {
      allImages = allImages.filter((i) => i.filename !== filename);
      renderGallery();
      showToast('Image permanently deleted', 'success');
    } else {
      const data = await res.json();
      showToast('Failed: ' + data.error, 'error');
    }
  } catch {
    showToast('Failed to permanently delete image', 'error');
  }
}

async function rotateImage(filename, direction) {
  // Find the gallery item and add loading state
  const galleryItem = document.querySelector(
    `.gallery-item[data-filename="${filename}"]`
  );
  if (galleryItem) {
    galleryItem.classList.add('rotating');
  }

  try {
    const res = await fetch(
      `/api/admin/images/${encodeURIComponent(filename)}/rotate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      }
    );

    if (res.ok) {
      // Refresh the thumbnail with cache-busting timestamp
      if (galleryItem) {
        const img = galleryItem.querySelector('img');
        if (img) {
          const url = new URL(img.src, window.location.origin);
          url.searchParams.set('t', Date.now());
          img.src = url.toString();
        }
      }
      showToast(
        `Image rotated ${direction === 'cw' ? 'clockwise' : 'counter-clockwise'}`,
        'success'
      );
    } else {
      const data = await res.json();
      showToast('Failed: ' + data.error, 'error');
    }
  } catch {
    showToast('Failed to rotate image', 'error');
  } finally {
    if (galleryItem) {
      galleryItem.classList.remove('rotating');
    }
  }
}

// Selection functions
function toggleSelection(filename) {
  if (selectedImages.has(filename)) {
    selectedImages.delete(filename);
  } else {
    selectedImages.add(filename);
  }
  renderGallery();
}

function toggleSelectAll() {
  const isTrashView = currentFilter === 'trash';
  const checkbox = isTrashView
    ? document.getElementById('select-all-trash')
    : document.getElementById('select-all');

  const visibleFilenames = getVisibleFilenames();

  if (checkbox && checkbox.checked) {
    visibleFilenames.forEach((f) => selectedImages.add(f));
  } else {
    visibleFilenames.forEach((f) => selectedImages.delete(f));
  }
  renderGallery();
}

function getVisibleFilenames() {
  let filtered = allImages;
  if (searchQuery) {
    filtered = allImages.filter((img) =>
      img.filename.toLowerCase().includes(searchQuery)
    );
  }
  return filtered.map((img) => img.filename);
}

function updateBulkControls() {
  const count = selectedImages.size;
  const isTrashView = currentFilter === 'trash';

  const bulkControls = document.getElementById('bulk-controls');
  const bulkControlsTrash = document.getElementById('bulk-controls-trash');

  if (isTrashView) {
    if (bulkControls) bulkControls.style.display = 'none';
    if (bulkControlsTrash)
      bulkControlsTrash.style.display = count > 0 ? 'flex' : 'none';
    const countEl = document.getElementById('selected-count-trash');
    if (countEl) countEl.textContent = `${count} selected`;
  } else {
    if (bulkControlsTrash) bulkControlsTrash.style.display = 'none';
    if (bulkControls) bulkControls.style.display = count > 0 ? 'flex' : 'none';
    const countEl = document.getElementById('selected-count');
    if (countEl) countEl.textContent = `${count} selected`;
  }

  // Update select-all checkbox state
  const visibleFilenames = getVisibleFilenames();
  const allSelected =
    visibleFilenames.length > 0 &&
    visibleFilenames.every((f) => selectedImages.has(f));
  const selectAllCheckbox = isTrashView
    ? document.getElementById('select-all-trash')
    : document.getElementById('select-all');
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = allSelected;
  }
}

async function bulkAction(action) {
  const count = selectedImages.size;
  if (count === 0) return;

  const actionLabels = {
    exclude: 'exclude from slideshow',
    include: 'include in slideshow',
    delete: 'move to trash',
    restore: 'restore from trash',
    'permanent-delete': 'PERMANENTLY DELETE',
    'rotate-cw': 'rotate clockwise',
    'rotate-ccw': 'rotate counter-clockwise',
  };

  const warningText =
    action === 'permanent-delete' ? '\n\nThis cannot be undone!' : '';

  const confirmed = await showConfirmDialog(
    'Confirm Bulk Action',
    `${actionLabels[action].toUpperCase()} ${count} image(s)?${warningText}`
  );

  if (!confirmed) return;

  try {
    const res = await fetch('/api/admin/images/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        filenames: Array.from(selectedImages),
      }),
    });

    const result = await res.json();
    const successCount = result.results.filter((r) => r.success).length;
    const failCount = result.results.filter((r) => !r.success).length;

    // Clear selection
    selectedImages.clear();

    // Reload images
    await loadImages();

    // Update stats if needed
    if (
      action === 'delete' ||
      action === 'restore' ||
      action === 'permanent-delete'
    ) {
      updateStats();
    }

    // Show result
    if (failCount === 0) {
      showToast(`${successCount} image(s) processed successfully`, 'success');
    } else {
      showToast(`${successCount} succeeded, ${failCount} failed`, 'error');
    }
  } catch (err) {
    showToast('Bulk operation failed: ' + err.message, 'error');
  }
}

// Initialize gallery event listeners
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('image-search');
  const filterSelect = document.getElementById('image-filter');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      currentPage = 1;
      renderGallery();
    });
  }

  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      currentPage = 1;
      selectedImages.clear(); // Clear selection when filter changes
      loadImages();
    });
  }

  // Set up select-all checkbox listeners
  const selectAll = document.getElementById('select-all');
  const selectAllTrash = document.getElementById('select-all-trash');
  if (selectAll) {
    selectAll.addEventListener('change', toggleSelectAll);
  }
  if (selectAllTrash) {
    selectAllTrash.addEventListener('change', toggleSelectAll);
  }

  // Load images on page load
  loadImages();
});

loadConfig();
updateStats();
startPolling();
