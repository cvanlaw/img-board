# Task 07: Admin Frontend

## Description
Create the admin interface UI for managing slideshow settings, viewing image statistics, and triggering image reprocessing.

## Dependencies
- Task 06: Admin API (backend routes)

## Deliverables
- `public/admin.html` - Admin interface page
- `public/js/admin.js` - Admin UI logic

## Acceptance Criteria
- [ ] Displays current configuration values on page load
- [ ] Shows image counts (raw and processed directories)
- [ ] Statistics auto-refresh every 5 seconds
- [ ] Slideshow interval can be changed and saved
- [ ] Preprocessing dimensions can be changed
- [ ] Dimension change triggers reprocessing with confirmation
- [ ] Progress bar displays during reprocessing
- [ ] Client-side validation prevents invalid inputs
- [ ] Success/error messages displayed to user
- [ ] Clean, functional UI (no framework required)

## Implementation Details

### admin.html Structure
```html
<!DOCTYPE html>
<html>
<head>
  <title>Slideshow Admin</title>
  <meta charset="utf-8">
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    .card {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 1.5rem;
      margin: 1rem 0;
      background: #f9f9f9;
    }
    h2 { margin-top: 0; }
    input {
      padding: 0.5rem;
      margin: 0.5rem 0;
      width: 100%;
      max-width: 300px;
    }
    button {
      padding: 0.5rem 1rem;
      margin: 0.5rem 0.5rem 0 0;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover { background: #0056b3; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .success { color: green; }
    .error { color: red; }
    .stat { font-size: 2rem; font-weight: bold; }
    .progress-bar {
      width: 100%;
      height: 20px;
      background: #ddd;
      border-radius: 4px;
      overflow: hidden;
      margin: 1rem 0;
    }
    .progress-fill {
      height: 100%;
      background: #28a745;
      transition: width 0.3s;
    }
  </style>
</head>
<body>
  <h1>Slideshow Admin</h1>

  <div class="card">
    <h2>Image Statistics</h2>
    <p>Raw images: <span class="stat" id="raw-count">-</span></p>
    <p>Processed images: <span class="stat" id="processed-count">-</span></p>
    <p><small>Last updated: <span id="stats-timestamp">-</span></small></p>
  </div>

  <div class="card">
    <h2>Slideshow Settings</h2>
    <label>
      Interval (milliseconds):
      <input type="number" id="interval" min="1000" step="100" />
    </label><br>
    <button onclick="saveSlideshow()">Save Slideshow Settings</button>
    <p id="slideshow-message"></p>
  </div>

  <div class="card">
    <h2>Preprocessing Settings</h2>
    <label>
      Target Width (pixels):
      <input type="number" id="width" min="1" />
    </label><br>
    <label>
      Target Height (pixels):
      <input type="number" id="height" min="1" />
    </label><br>
    <button onclick="savePreprocessing()">Save & Reprocess All Images</button>
    <button onclick="manualReprocess()">Reprocess Now</button>
    <p id="preprocessing-message"></p>
    <div id="progress-container" style="display: none;">
      <div class="progress-bar">
        <div class="progress-fill" id="progress-fill"></div>
      </div>
      <p id="progress-text">Processing: 0/0</p>
    </div>
  </div>

  <script src="/js/admin.js"></script>
</body>
</html>
```

### admin.js Logic
```javascript
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

// Initialize
loadConfig();
updateStats();
setInterval(updateStats, 5000);
```

## Testing Checklist
- [ ] Admin page loads at `/admin`
- [ ] Current config values displayed correctly
- [ ] Image counts displayed and update every 5 seconds
- [ ] Slideshow interval save works (verify config.json updated)
- [ ] Invalid interval (<1000) shows error message
- [ ] Dimension change triggers confirmation dialog
- [ ] Progress bar appears during reprocessing
- [ ] Progress updates in real-time
- [ ] Manual reprocess button works
- [ ] Error messages display correctly on failure
- [ ] UI remains responsive during operations
