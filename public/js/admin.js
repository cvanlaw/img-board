async function loadConfig() {
  try {
    const res = await fetch('/api/admin/config');
    const config = await res.json();

    document.getElementById('interval').value = config.slideshowInterval;
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
  const interval = parseInt(document.getElementById('interval').value);

  if (interval < 1000) {
    showMessage('slideshow-message', 'Interval must be at least 1000ms', 'error');
    return;
  }

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

loadConfig();
updateStats();
setInterval(updateStats, 5000);
