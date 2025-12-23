# Image Slideshow Web App for DAKboard - Architecture & Implementation Guide

## Overview
Standalone web app to display and rotate through images from NAS storage, embeddable in DAKboard via HTTPS iframe.

**Setup**: Separate device runs web server with HTTPS/TLS cert → DAKboard embeds via iframe
**Source**: Images on network storage (NAS)

## Critical Requirements

1. **Auto-detection**: Must pick up new files in image directory WITHOUT restart
2. **HTTPS**: Must support TLS cert for DAKboard embedding
3. **NAS Integration**: Read images from network-mounted directory
4. **Slideshow**: Auto-rotate through images with configurable timing

## Technology Stack

### Recommended: Node.js + Express + Chokidar

**Why this stack**:
- Excellent file watching with `chokidar` library (handles NFS/CIFS mounts reliably)
- Fast, lightweight runtime
- Real-time updates via Server-Sent Events (SSE)
- Easy HTTPS setup
- Rich ecosystem for image handling
- Simple containerized deployment with Docker

**Auto-detection approach**: Chokidar watches directory, emits events on file changes, pushes to frontend via SSE

**Key dependencies**:
- Express (web server)
- Chokidar (file system watching)
- Splide.js (frontend slideshow library)

**References**:
- [Chokidar](https://github.com/paulmillr/chokidar) - Robust file watching
- [Express](https://expressjs.com/) - Minimal web framework
- [Splide](https://splidejs.com/) - Lightweight slider (29KB, no dependencies)

### Alternative Options

#### Option 2: Flask + Watchdog + SSE
**Pros**: Python's `watchdog` library for file monitoring, familiar if you prefer Python
**Cons**: Watchdog can be finicky with network mounts, slightly heavier than Node.js

#### Option 3: Go + HTTP Server + fsnotify
**Pros**: Single binary deployment, extremely lightweight, built-in HTTPS
**Cons**: More verbose code, less ecosystem for frontend templates

## Architecture

```
NAS Raw Images Directory (mounted via NFS/SMB)
    ↓
Preprocessing Worker (separate process)
  • Watches raw directory with Chokidar
  • Converts to WebP
  • Resizes to target resolution
  • Moves to processed directory
    ↓
Processed Images Directory
    ↓
Chokidar File Watcher → Detects new/changed images
    ↓
Express Server (serves static files + API)
    ↓
REST API (/api/images) → JSON list + SSE for updates
    ↓
Frontend (Splide.js) → Auto-rotating slideshow + live updates
    ↓
DAKboard (HTTPS iframe embed)
```

## Project Structure

```
image-slideshow/
├── preprocessor.js        # Image preprocessing worker (separate process)
├── server.js              # Express app + Chokidar watcher
├── start.js               # Process wrapper for Docker (runs both processes)
├── package.json           # npm dependencies
├── config.json            # Configuration (NAS path, timing, etc.)
├── .reprocess-trigger     # Temp file: signals reprocessing needed
├── .reprocess-progress.json # Temp file: tracks reprocessing progress
├── Dockerfile             # Docker container build
├── docker-compose.yml     # Docker Compose deployment config
├── README.md              # Setup and deployment instructions
├── nginx.conf             # nginx HTTPS reverse proxy config (optional)
├── public/
│   ├── index.html         # Main slideshow page
│   ├── admin.html         # Admin control interface
│   ├── css/
│   │   └── style.css      # Slideshow styling
│   └── js/
│       ├── slideshow.js   # Splide + SSE connection
│       └── admin.js       # Admin UI logic
└── .dockerignore          # Docker build exclusions
```

## Preprocessing Worker (`preprocessor.js`)

**Purpose**: Separate process that watches raw image directory, optimizes images, and moves them to processed directory for the web app to serve.

### Why Separate Preprocessing

1. **Separation of concerns** - preprocessing doesn't block the web server
2. **Optimize once, serve many** - web app only touches pre-optimized images
3. **Protects originals** - raw images stay untouched in source directory
4. **Handles format conversion** - JPEG → WebP automatically (25-35% smaller)
5. **Resolution matching** - resize to exactly what DAKboard needs, no oversized 4K images

### Core Functionality

- Watch raw image directory with Chokidar (`usePolling: true` for NAS)
- On new image detected:
  - Validate image format
  - Convert to WebP using Sharp
  - Resize to target resolution (from config)
  - Save to processed directory
  - Optionally delete or archive original
- Error handling for corrupt/invalid images
- Logging for all preprocessing operations

### Sharp Processing Pipeline

```javascript
const sharp = require('sharp');

async function processImage(inputPath, outputPath) {
  await sharp(inputPath)
    .webp({ quality: 85 })
    .resize(config.targetWidth, config.targetHeight, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .toFile(outputPath);
}
```

### Key Decisions

- **Original files**: Configure to keep, delete, or move to archive directory
- **Error handling**: Skip corrupt images, log errors, continue processing
- **Naming**: Keep original filenames with .webp extension
- **Multiple resolutions**: Optional - generate different sizes for different displays

### Resource Impact

Minimal - Sharp is fast (~100ms per image), preprocessing happens once per new file. Runs as separate process within Docker container.

## Backend: Express Server (`server.js`)

### Routes
- `GET /` - Serve main slideshow page
- `GET /api/images` - Return JSON list of current images
- `GET /api/events` - SSE endpoint for real-time updates
- `GET /images/:filename` - Serve image files from NAS directory

### Core Functionality
- Initialize Chokidar to watch NAS mount path
- Scan directory on startup for existing images
- Filter by image extensions (jpg, png, webp, etc.)
- Emit SSE events when files are added/removed/changed
- Serve static files from `public/` directory
- Optional: Shuffle order for randomization

### Chokidar Configuration

```javascript
const watcher = chokidar.watch(config.imagePath, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: true, // wait for file write to complete
  usePolling: true, // ESSENTIAL for NFS/CIFS mounts
  interval: 1000 // poll every 1 second
});
```

**Critical**: `usePolling: true` is essential for network mounts. Standard file system events don't work reliably over NFS/CIFS.

### SSE Event Flow

1. Client connects to `/api/events`
2. Server keeps connection open
3. Chokidar detects file change
4. Server sends SSE event to all connected clients
5. Frontend receives event and updates slideshow

## Configuration (`config.json`)

```json
{
  "preprocessing": {
    "enabled": true,
    "rawImagePath": "/mnt/nas/photos/raw",
    "processedImagePath": "/mnt/nas/photos/processed",
    "inputExtensions": [".jpg", ".jpeg", ".png"],
    "outputFormat": "webp",
    "quality": 85,
    "targetWidth": 1920,
    "targetHeight": 1080,
    "keepOriginals": true,
    "archivePath": "/mnt/nas/photos/archive"
  },
  "imagePath": "/mnt/nas/photos/processed",
  "imageExtensions": [".webp"],
  "slideshowInterval": 5000,
  "randomOrder": true,
  "reshuffleInterval": 3600000,
  "recursive": false,
  "port": 3000,
  "https": {
    "enabled": true,
    "cert": "/path/to/cert.pem",
    "key": "/path/to/key.pem"
  },
  "admin": {
    "enabled": true,
    "allowedIPs": ["192.168.1.0/24", "127.0.0.1"]
  }
}
```

### Configuration Options

**Preprocessing**:
- `preprocessing.enabled`: Enable/disable preprocessing worker
- `preprocessing.rawImagePath`: Source directory with original images
- `preprocessing.processedImagePath`: Destination for optimized images
- `preprocessing.inputExtensions`: Supported input formats (HEIC requires additional dependencies - see note below)
- `preprocessing.outputFormat`: Target format (webp recommended)
- `preprocessing.quality`: WebP quality (1-100, default 85)
- `preprocessing.targetWidth`: Max width in pixels
- `preprocessing.targetHeight`: Max height in pixels
- `preprocessing.keepOriginals`: Keep original files after processing
- `preprocessing.archivePath`: Directory to move originals (if keepOriginals is true)

**Web Server**:
- `imagePath`: Directory to serve images from (should match processedImagePath)
- `imageExtensions`: Allowed file types for serving
- `slideshowInterval`: Milliseconds between slides
- `randomOrder`: Shuffle image order (true) or sequential/alphabetical (false)
- `reshuffleInterval`: Milliseconds between reshuffles (0 = shuffle once at startup only). Example: 3600000 = 1 hour
- `recursive`: Scan subdirectories (default: false - flatten to single directory for simplicity)
- `port`: Server port
- `https`: HTTPS configuration

**Admin Interface**:
- `admin.enabled`: Enable/disable admin interface at /admin route
- `admin.allowedIPs`: Array of IP addresses or CIDR ranges allowed to access admin (optional, for additional security)

## Frontend (`public/index.html` + `slideshow.js`)

### Splide Configuration

```javascript
const splide = new Splide('#slideshow', {
  type: 'fade',           // or 'slide' for sliding transitions
  autoplay: true,
  interval: config.slideshowInterval,
  pauseOnHover: false,
  pauseOnFocus: false,
  rewind: true,
  lazyLoad: 'nearby',     // Only load adjacent slides (critical for 200-1000 images)
  preloadPages: 1,        // Preload 1 slide ahead
  keyboard: true,         // For testing
  arrows: false,          // Hide navigation arrows
  pagination: false,      // Hide pagination dots
});
```

**Key settings for large image sets (200-1000 images):**
- `lazyLoad: 'nearby'` - Only loads images adjacent to current slide
- `preloadPages: 1` - Minimal preloading to reduce memory
- Combined with `loading="lazy"` on img elements for browser-level lazy loading

### Image Loading & Real-time Updates

**Initial load**:
1. Fetch `/api/images` on page load (returns shuffled list if `randomOrder: true`)
2. Build Splide slideshow with image list
3. Connect to SSE for updates

**Reshuffle behavior** (when `reshuffleInterval` is configured):
1. Server maintains image list in memory
2. New images detected by file watcher are queued (not immediately broadcast)
3. On reshuffle timer (e.g., every hour):
   - Incorporate pending additions/removals
   - Shuffle the complete list (if `randomOrder: true`)
   - Broadcast `reshuffle` event with full image list via SSE
4. Frontend rebuilds slideshow with new list

**Why queue new images instead of immediate updates:**
- Prevents jarring interruptions during viewing
- Maintains shuffle consistency
- Reduces SSE traffic with batch updates

**SSE Event Handling**:
```javascript
// Connect with auto-reconnection
function connectSSE() {
  const eventsource = new EventSource('/api/events');

  eventsource.onerror = () => {
    eventsource.close();
    setTimeout(connectSSE, 5000); // Reconnect after 5s
  };

  eventsource.addEventListener('add', (e) => {
    const { filename } = JSON.parse(e.data);
    // Note: With reshuffleInterval, new images are queued server-side
    // and broadcast on reshuffle, not immediately
  });

  eventsource.addEventListener('reshuffle', (e) => {
    const { images } = JSON.parse(e.data);
    rebuildSlideshow(images);
  });
}

// Build slideshow with proper Splide slide structure
function rebuildSlideshow(images) {
  // Remove all existing slides
  while (splide.length > 0) {
    splide.remove(0);
  }

  // Add new slides with lazy loading
  images.forEach(filename => {
    const slide = document.createElement('li');
    slide.className = 'splide__slide';
    slide.dataset.filename = filename; // For removal tracking
    slide.innerHTML = `<img src="/images/${filename}" loading="lazy" alt="">`;
    splide.add(slide);
  });
}

// Remove slide by filename (for immediate removal if needed)
function removeSlideByFilename(filename) {
  const slides = splide.Components.Elements.slides;
  for (let i = 0; i < slides.length; i++) {
    if (slides[i].dataset.filename === filename) {
      splide.remove(i);
      break;
    }
  }
}

connectSSE();
```

### Styling Considerations

- Full-screen layout (CSS: `object-fit: contain`)
- No scrollbars
- No margins/padding (maximize image area)
- Optimized for DAKboard target resolution

## Admin Interface

### Overview

Separate admin interface accessible at `/admin` route for managing slideshow settings and preprocessing configuration without restarting processes.

**Purpose**: Live configuration updates, image statistics monitoring, and manual reprocessing control

**Access**: No authentication required (designed for private network deployment), optional IP allowlist for additional security

**Key Features**:
- Real-time image count statistics (raw/processed directories)
- Slideshow interval control with live updates
- Preprocessing aspect ratio configuration
- Manual reprocessing trigger
- Reprocessing progress monitoring

### Architecture

```
Admin UI (Vanilla JS)
    ↓ (HTTP POST)
Express Admin API Routes
    ↓
Write to config.json
    ↓
Chokidar detects config change in both processes
    ↓
├─→ server.js
│   ├─→ Reload configuration (clear require cache)
│   ├─→ Update slideshow settings
│   └─→ Broadcast to slideshow clients via SSE
│
└─→ preprocessor.js
    ├─→ Reload configuration (clear require cache)
    ├─→ Update preprocessing settings
    └─→ If aspect ratio changed: trigger reprocess-all
```

**Why file-based IPC:**
- Leverages existing Chokidar infrastructure in both processes
- Configuration changes persist across restarts
- No additional dependencies required
- Easy to debug (inspect config.json directly)
- Works with Docker process isolation

### Admin Routes

New Express routes added to `server.js`:

- `GET /admin` - Serve admin interface HTML page
- `GET /api/admin/config` - Return current configuration from config.json
- `POST /api/admin/config` - Update configuration, trigger reprocess if aspect ratio changed
- `GET /api/admin/stats` - Return image counts (raw and processed directories)
- `POST /api/admin/reprocess` - Manually trigger reprocessing of all images
- `GET /api/admin/reprocess-status` - Get current reprocessing progress

### Configuration Reloading

Both `server.js` and `preprocessor.js` watch `config.json` with Chokidar for live updates:

```javascript
const configWatcher = chokidar.watch('./config.json', {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100
  }
});

configWatcher.on('change', () => {
  console.log('Config file changed, reloading...');

  // Clear Node.js require cache
  delete require.cache[require.resolve('./config.json')];

  // Reload configuration
  const newConfig = require('./config.json');

  // Update in-memory settings
  updateSettings(newConfig);

  // Broadcast changes to connected clients
  broadcastConfigUpdate(newConfig);
});
```

**Live update timeline:**
- Admin UI submits config change
- Config.json written atomically (temp file → rename)
- Chokidar detects change within ~1 second
- Both processes reload and apply new settings
- Slideshow clients receive SSE update (if applicable)

**Config update with deep merge:**

Admin API receives partial config updates (e.g., just `{ slideshowInterval: 10000 }`).
Must deep merge to preserve existing nested properties:

```javascript
// Deep merge utility (avoids lodash dependency)
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

// In POST /api/admin/config handler
app.post('/api/admin/config', async (req, res) => {
  const currentConfig = JSON.parse(await fs.promises.readFile('./config.json', 'utf8'));
  const newConfig = deepMerge(currentConfig, req.body);

  // Validate before writing
  if (newConfig.slideshowInterval < 1000) {
    return res.status(400).json({ error: 'slideshowInterval must be >= 1000ms' });
  }

  // Atomic write to prevent corruption
  const tempFile = './config.json.tmp';
  await fs.promises.writeFile(tempFile, JSON.stringify(newConfig, null, 2));
  await fs.promises.rename(tempFile, './config.json');

  // Check if aspect ratio changed (triggers reprocessing)
  const aspectChanged =
    req.body.preprocessing?.targetWidth !== undefined ||
    req.body.preprocessing?.targetHeight !== undefined;

  if (aspectChanged) {
    await fs.promises.writeFile('./.reprocess-trigger', Date.now().toString());
  }

  res.json({ success: true, reprocessing: aspectChanged });
});
```

### Reprocessing Workflow

When aspect ratio settings change, all existing images are reprocessed:

**Trigger mechanism:**
1. Admin API detects aspect ratio change in POST request
2. Admin API creates `.reprocess-trigger` file
3. Preprocessor's Chokidar watcher detects trigger file
4. Preprocessor scans raw image directory
5. All images queued for reprocessing with new dimensions
6. Progress written to `.reprocess-progress.json` after each image
7. Admin UI polls progress endpoint
8. Trigger file removed when reprocessing completes

**Preprocessor trigger handler:**

```javascript
const reprocessWatcher = chokidar.watch('./.reprocess-trigger', {
  persistent: true,
  ignoreInitial: false
});

reprocessWatcher.on('add', async () => {
  console.log('Reprocess triggered, scanning raw directory...');

  try {
    // Scan raw directory for all images
    const files = await scanDirectory(config.preprocessing.rawImagePath);
    console.log(`Found ${files.length} images to reprocess`);

    // Track failures for summary
    let completed = 0;
    let failed = 0;
    const errors = [];

    for (const file of files) {
      try {
        await processImage(file);
        completed++;
      } catch (err) {
        failed++;
        errors.push({ file, error: err.message });
        console.error(`Failed to process ${file}:`, err.message);
        // Continue processing remaining files
      }

      // Write progress for admin UI (include failure count)
      await fs.promises.writeFile('./.reprocess-progress.json',
        JSON.stringify({
          completed,
          failed,
          total: files.length,
          timestamp: Date.now()
        })
      );
    }

    // Log summary
    console.log(`Reprocessing complete: ${completed} succeeded, ${failed} failed`);
    if (errors.length > 0) {
      console.log('Failed files:', errors.map(e => e.file).join(', '));
    }

  } catch (err) {
    console.error('Reprocessing failed:', err);
  } finally {
    // Always clean up trigger/progress files
    try { await fs.promises.unlink('./.reprocess-trigger'); } catch {}
    try { await fs.promises.unlink('./.reprocess-progress.json'); } catch {}
  }
});
```

**Admin API trigger endpoint:**

```javascript
app.post('/api/admin/reprocess', async (req, res) => {
  // Check if reprocessing already running
  if (fs.existsSync('./.reprocess-trigger') || fs.existsSync('./.reprocess-progress.json')) {
    return res.status(409).json({ error: 'Reprocessing already in progress' });
  }

  // Create trigger file
  await fs.promises.writeFile('./.reprocess-trigger', Date.now().toString());

  res.json({
    status: 'triggered',
    message: 'Reprocessing started. Use /api/admin/reprocess-status to monitor progress.'
  });
});
```

**Progress monitoring:**

```javascript
app.get('/api/admin/reprocess-status', async (req, res) => {
  try {
    const progress = JSON.parse(
      await fs.promises.readFile('./.reprocess-progress.json', 'utf8')
    );
    res.json({ active: true, ...progress });
  } catch (err) {
    // No progress file = not running
    res.json({ active: false });
  }
});
```

### Admin UI Implementation

**Frontend approach**: Vanilla JavaScript (no framework)

**Why vanilla JS:**
- No build step required
- No dependencies to manage
- Faster initial load
- Easier to modify and maintain
- Sufficient for simple admin interface

**Admin interface features:**

1. **Real-time Statistics**
   - Display count of images in raw directory
   - Display count of images in processed directory
   - Auto-refresh every 5 seconds

2. **Slideshow Settings**
   - Input field for slideshow interval (milliseconds)
   - Save button updates config.json
   - Changes apply immediately to running slideshow

3. **Preprocessing Settings**
   - Input fields for target width and height
   - Save button updates config and triggers reprocessing
   - Progress bar shows reprocessing status

4. **Validation**
   - Client-side validation before submission
   - Server-side validation in API endpoints
   - Error messages displayed to user

**Sample admin UI code (public/admin.html):**

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

**Admin JavaScript (public/js/admin.js):**

```javascript
// Load current configuration on page load
async function loadConfig() {
  try {
    const res = await fetch('/api/admin/config');
    const config = await res.json();

    document.getElementById('interval').value = config.slideshowInterval;
    document.getElementById('width').value = config.preprocessing.targetWidth;
    document.getElementById('height').value = config.preprocessing.targetHeight;
  } catch (err) {
    showMessage('preprocessing-message', 'Error loading config: ' + err.message, 'error');
  }
}

// Update image statistics
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

// Save slideshow settings (no reprocess)
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
      showMessage('slideshow-message',
        'Settings saved! Slideshow will update automatically within 1 second.',
        'success');
    } else {
      const error = await res.json();
      showMessage('slideshow-message', 'Error: ' + error.error, 'error');
    }
  } catch (err) {
    showMessage('slideshow-message', 'Error: ' + err.message, 'error');
  }
}

// Save preprocessing settings and trigger reprocess
async function savePreprocessing() {
  const width = parseInt(document.getElementById('width').value);
  const height = parseInt(document.getElementById('height').value);

  if (width < 1 || height < 1) {
    showMessage('preprocessing-message', 'Width and height must be positive', 'error');
    return;
  }

  if (!confirm(`This will reprocess ALL images with new dimensions ${width}x${height}. Continue?`)) {
    return;
  }

  try {
    // Update config
    const configRes = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preprocessing: {
          targetWidth: width,
          targetHeight: height
        }
      })
    });

    if (!configRes.ok) {
      const error = await configRes.json();
      showMessage('preprocessing-message', 'Error: ' + error.error, 'error');
      return;
    }

    // Check if reprocessing was triggered
    const result = await configRes.json();
    if (result.reprocessing) {
      showMessage('preprocessing-message',
        'Settings saved! Reprocessing started...',
        'success');

      // Show progress bar
      document.getElementById('progress-container').style.display = 'block';
      monitorReprocessing();
    } else {
      showMessage('preprocessing-message',
        'Settings saved (no changes detected)',
        'success');
    }
  } catch (err) {
    showMessage('preprocessing-message', 'Error: ' + err.message, 'error');
  }
}

// Monitor reprocessing progress
async function monitorReprocessing() {
  try {
    const res = await fetch('/api/admin/reprocess-status');
    const status = await res.json();

    if (status.active) {
      const percent = (status.completed / status.total) * 100;
      document.getElementById('progress-fill').style.width = percent + '%';
      document.getElementById('progress-text').textContent =
        `Processing: ${status.completed}/${status.total} images`;

      // Continue polling
      setTimeout(monitorReprocessing, 1000);
    } else {
      // Complete
      document.getElementById('progress-fill').style.width = '100%';
      document.getElementById('progress-text').textContent = 'Complete!';
      setTimeout(() => {
        document.getElementById('progress-container').style.display = 'none';
        updateStats();
      }, 2000);
    }
  } catch (err) {
    // Reprocessing not active or error
    document.getElementById('progress-container').style.display = 'none';
  }
}

// Helper function to show messages
function showMessage(elementId, message, type) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.className = type;
}

// Initialize on page load
loadConfig();
updateStats();
setInterval(updateStats, 5000); // Update stats every 5 seconds
```

### File-Based IPC Artifacts

Three files used for inter-process communication:

1. **config.json** - Shared configuration
   - Source of truth for both processes
   - Watched by Chokidar in server.js and preprocessor.js
   - Updated atomically by admin API (temp file → rename)

2. **.reprocess-trigger** - Reprocessing trigger (temporary)
   - Created by admin API when aspect ratio changes
   - Detected by preprocessor's Chokidar watcher
   - Deleted by preprocessor when reprocessing completes

3. **.reprocess-progress.json** - Progress tracking (temporary)
   - Written by preprocessor after each image
   - Read by admin API for progress endpoint
   - Deleted by preprocessor when reprocessing completes

**Why file-based approach:**
- No network communication required between processes
- No external dependencies
- Progress survives if admin UI disconnects
- Easy to debug (inspect files directly)
- Simple and reliable

### Live Updates Mechanism

**For slideshow interval changes:**

1. Admin UI posts new interval to `/api/admin/config`
2. Server.js writes to config.json
3. Server.js config watcher detects change within ~1 second
4. Server.js broadcasts SSE event to all slideshow clients
5. Slideshow frontend updates Splide interval on the fly

```javascript
// In slideshow.js
const configEvents = new EventSource('/api/events');
configEvents.addEventListener('config-update', (e) => {
  const config = JSON.parse(e.data);
  splide.options.interval = config.slideshowInterval;
  console.log('Slideshow interval updated to', config.slideshowInterval);
});
```

**For preprocessing aspect ratio changes:**

1. Admin UI posts new dimensions to `/api/admin/config`
2. Server.js detects aspect ratio change
3. Server.js creates `.reprocess-trigger` file
4. Preprocessor.js detects trigger file
5. Preprocessor.js reprocesses all images with new dimensions
6. Admin UI polls progress endpoint to show status

### Security Considerations

**IP Allowlist (optional):**

```javascript
// Simple IP matching - supports exact IPs and /24 subnets
function ipMatches(clientIP, pattern) {
  // Normalize IPv6-mapped IPv4 (::ffff:192.168.1.1 -> 192.168.1.1)
  const ip = clientIP.replace(/^::ffff:/, '');

  // Always allow localhost
  if (ip === '127.0.0.1' || ip === '::1' || clientIP === '::1') {
    return true;
  }

  // Exact match
  if (ip === pattern) {
    return true;
  }

  // Simple /24 subnet match (e.g., "192.168.1.0/24" matches "192.168.1.*")
  if (pattern.endsWith('/24')) {
    const subnet = pattern.replace('/24', '').split('.').slice(0, 3).join('.');
    const ipPrefix = ip.split('.').slice(0, 3).join('.');
    return subnet === ipPrefix;
  }

  return false;
}

// Middleware for admin routes
function adminIPFilter(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  const allowedPatterns = config.admin?.allowedIPs || [];

  // If no allowlist configured, allow all (private network assumption)
  if (allowedPatterns.length === 0) {
    return next();
  }

  const isAllowed = allowedPatterns.some(pattern => ipMatches(clientIP, pattern));

  if (!isAllowed) {
    console.log(`Admin access denied for IP: ${clientIP}`);
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
}

// Apply to admin routes
app.use('/admin', adminIPFilter);
app.use('/api/admin', adminIPFilter);
```

**Note**: This simple implementation only supports exact IPs and /24 subnets. For complex CIDR matching, add the `ip-range-check` package.

**For truly private network deployment, leave `allowedIPs` empty or omit `admin` config entirely to skip filtering.**

## Deployment

### Prerequisites

- Docker and Docker Compose
- NAS mounted to local filesystem (host machine)
- nginx (optional, for HTTPS reverse proxy)

### NAS Mounting

**NFS**:
```bash
sudo mount -t nfs nas.local:/volume1/photos /mnt/nas/photos

# Add to /etc/fstab for auto-mount on boot
nas.local:/volume1/photos /mnt/nas/photos nfs defaults 0 0
```

**SMB/CIFS**:
```bash
sudo mount -t cifs //nas.local/photos /mnt/nas/photos -o credentials=/etc/nas-creds

# Add to /etc/fstab
//nas.local/photos /mnt/nas/photos cifs credentials=/etc/nas-creds 0 0
```

### Docker Deployment

For container-based deployment with NAS volume mount:

**Dockerfile**:
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install Sharp dependencies
RUN apk add --no-cache vips-dev

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy application
COPY . .

EXPOSE 3000

# Run both processes using a simple wrapper
CMD ["node", "start.js"]
```

**start.js** (runs both processes in container):
```javascript
const { spawn } = require('child_process');

// Start preprocessor
const preprocessor = spawn('node', ['preprocessor.js'], { stdio: 'inherit' });

// Start server
const server = spawn('node', ['server.js'], { stdio: 'inherit' });

// Handle process exit
process.on('SIGTERM', () => {
  preprocessor.kill();
  server.kill();
  process.exit(0);
});
```

**docker-compose.yml**:
```yaml
version: '3.8'
services:
  slideshow:
    build: .
    ports:
      - "3000:3000"
    volumes:
      # NAS mount (read-only for raw, container manages processed)
      - /mnt/nas/photos/raw:/mnt/photos/raw:ro
      - /mnt/nas/photos/processed:/mnt/photos/processed
      - /mnt/nas/photos/archive:/mnt/photos/archive
      # Configuration and certificates
      - ./config.json:/app/config.json:ro
      - /path/to/certs:/certs:ro
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

**Notes**:
- NAS directories should be mounted on the host before starting the container
- For HEIC support, add `libheif-dev` to the Dockerfile: `RUN apk add --no-cache vips-dev libheif-dev`
- Container restarts automatically on failure via Docker Compose `restart: unless-stopped` policy

### HTTPS Setup

TLS certificates are provided externally (wildcard cert or similar). Mount the cert files and configure paths in config.json.

**Direct HTTPS in Node.js** (simpler for Docker):

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  cert: fs.readFileSync(config.https.cert),
  key: fs.readFileSync(config.https.key)
};

https.createServer(options, app).listen(443);
```

**With Docker**, mount certificates as volumes:
```yaml
volumes:
  - /path/to/cert.pem:/certs/cert.pem:ro
  - /path/to/key.pem:/certs/key.pem:ro
```

Then configure in config.json:
```json
{
  "https": {
    "enabled": true,
    "cert": "/certs/cert.pem",
    "key": "/certs/key.pem"
  }
}
```

**Alternative: nginx Reverse Proxy**

If running behind nginx (e.g., for load balancing or centralized SSL termination):

```nginx
server {
    listen 443 ssl;
    server_name slideshow.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off; # CRITICAL for SSE
        proxy_cache off; # CRITICAL for SSE
    }
}
```

**Important**: `proxy_buffering off` and `proxy_cache off` are essential for SSE to work through nginx.

## Implementation Phases

### Phase 0: Preprocessing Worker (1-2 hours)

1. Initialize Node.js project:
   ```bash
   mkdir image-slideshow && cd image-slideshow
   npm init -y
   npm install express chokidar sharp
   ```

2. Write `preprocessor.js`:
   - Chokidar watcher on raw image directory
   - Sharp image processing pipeline
   - File move/archive logic
   - Error handling for corrupt images
   - Configuration loading from `config.json`

3. Test preprocessing:
   - Add test image to raw directory
   - Verify WebP conversion
   - Verify resize to target resolution
   - Verify move to processed directory
   - Test with various input formats (JPEG, PNG, HEIC)

### Phase 1: Core Functionality (1-2 hours)

1. Continue with existing Node.js project (dependencies already installed in Phase 0)

2. Write `server.js`:
   - Express app setup
   - Basic routes (`/`, `/api/images`)
   - Image directory scanning
   - Configuration loading from `config.json`

3. Create frontend in `public/`:
   - `index.html` with Splide integration
   - `slideshow.js` to fetch and display images
   - `style.css` for full-screen layout

4. Test locally with sample images

### Phase 2: File Watching (2-3 hours)

5. Add Chokidar watcher to `server.js`:
   - Watch configured image directory
   - Handle `add`, `change`, `unlink` events
   - Use `usePolling: true` for network mounts

6. Implement SSE endpoint (`/api/events`):
   - Send events to connected clients
   - Handle client disconnects

7. Update frontend to listen to SSE:
   - Connect to `/api/events`
   - Dynamically add/remove slides
   - Test with manual file add/remove

### Phase 3: NAS Integration (1 hour)

8. Mount NAS to development machine
9. Update `config.json` to use NAS path
10. Test file watching on network mount:
    - Add new image → verify it appears in slideshow
    - Delete image → verify it's removed
    - Handle edge cases (empty directory, unsupported formats)
11. Test with large image sets (100+ images)

### Phase 4: HTTPS & Deployment (1-2 hours)

12. Choose HTTPS approach (direct Node.js or nginx proxy)
13. Configure TLS cert paths in `config.json` or nginx
14. Create Docker deployment files:
    - `Dockerfile` - Container image definition
    - `docker-compose.yml` - Service configuration with volume mounts
    - `start.js` - Process wrapper for both services
    - `.dockerignore` - Build exclusions
15. Deploy to target device:
    ```bash
    docker compose up -d --build
    ```
16. Test HTTPS access from other devices
17. Verify container health checks and auto-restart

### Phase 5: DAKboard Integration (1 hour)

18. Add DAKboard-specific optimizations:
    - Full-screen CSS (no margins, no scrollbars)
    - Optimize for target resolution
    - Test with various transition effects

19. Test embedding in DAKboard iframe:
    - Verify HTTPS loads without security warnings
    - Verify auto-play works in iframe context
    - Verify SSE connections work in iframe

20. Fine-tune timing/transitions
21. Load test: Add many images, verify performance

### Phase 6: Admin Interface (2-3 hours)

22. Add config watching to both processes:
    - Add Chokidar watcher for `config.json` in `server.js`
    - Add Chokidar watcher for `config.json` in `preprocessor.js`
    - Implement config reload logic (clear require cache)
    - Test manual config change → verify both processes reload

23. Implement admin API routes in `server.js`:
    - `GET /api/admin/config` - Return current configuration
    - `POST /api/admin/config` - Update configuration with validation
    - `GET /api/admin/stats` - Count images in raw/processed directories
    - `POST /api/admin/reprocess` - Create reprocess trigger file
    - `GET /api/admin/reprocess-status` - Read progress from JSON file
    - Add IP allowlist middleware (optional)

24. Add reprocess trigger mechanism to `preprocessor.js`:
    - Watch `.reprocess-trigger` file with Chokidar
    - On trigger: scan raw directory, queue all images
    - Write progress to `.reprocess-progress.json` after each image
    - Delete trigger and progress files when complete
    - Test: Create trigger file manually, verify reprocessing starts

25. Create admin frontend:
    - Create `public/admin.html` with statistics, slideshow controls, preprocessing controls
    - Create `public/js/admin.js` with config loading, stats polling, update handlers
    - Add progress bar for reprocessing
    - Add client-side validation

26. Integration testing:
    - Test slideshow interval change → verify slideshow updates without restart
    - Test aspect ratio change → verify reprocessing triggers automatically
    - Test progress monitoring during reprocessing
    - Test error handling (invalid values, concurrent updates)
    - Test with both processes running simultaneously

## Testing Checklist

**Preprocessing Worker**:
- [ ] Preprocessor detects new images in raw directory
- [ ] JPEG converts to WebP successfully
- [ ] PNG converts to WebP successfully
- [ ] HEIC converts to WebP successfully (if supported)
- [ ] Images resize to target resolution
- [ ] Aspect ratio preserved during resize
- [ ] Processed images move to correct directory
- [ ] Original files handled per config (keep/delete/archive)
- [ ] Corrupt images logged and skipped (don't crash process)
- [ ] Preprocessor runs in Docker container
- [ ] File watching works on NAS mount with polling

**Web Server**:
- [ ] Node.js server starts and serves homepage
- [ ] API returns correct image list from processed directory
- [ ] Images display and rotate automatically
- [ ] **File watching**: New processed images appear without restart
- [ ] **File watching**: Deleted images disappear from slideshow
- [ ] **File watching**: Modified images update in slideshow
- [ ] SSE connection establishes and receives events
- [ ] HTTPS works with TLS cert
- [ ] Embeds correctly in DAKboard iframe
- [ ] Auto-play works in iframe context
- [ ] SSE works through nginx proxy (if using proxy)
- [ ] Page handles empty directories gracefully
- [ ] Page handles 100+ images without performance issues
- [ ] Docker container auto-restarts on crash
- [ ] Container health check passes
- [ ] Chokidar polling works on NFS/CIFS mount

**End-to-End**:
- [ ] Add image to raw directory → appears in slideshow after processing
- [ ] Both processes run simultaneously without conflict
- [ ] System handles batch uploads (multiple images at once)

**Admin Interface**:
- [ ] Admin page loads at /admin route
- [ ] Admin page displays current configuration correctly
- [ ] Image statistics show correct counts (raw/processed)
- [ ] Statistics auto-refresh every 5 seconds
- [ ] Slideshow interval can be changed via admin UI
- [ ] Slideshow interval change updates running slideshow without restart
- [ ] Slideshow updates within 1 second of config change
- [ ] Aspect ratio settings can be changed via admin UI
- [ ] Aspect ratio change triggers automatic reprocessing
- [ ] Reprocessing progress displays correctly
- [ ] Progress bar updates during reprocessing
- [ ] Manual reprocess button works
- [ ] Client-side validation rejects invalid values
- [ ] Server-side validation rejects invalid values with error messages
- [ ] Config watcher in server.js detects changes
- [ ] Config watcher in preprocessor.js detects changes
- [ ] Both processes reload config within 1 second
- [ ] Reprocess trigger file mechanism works
- [ ] Reprocess doesn't start if already running (409 error)
- [ ] IP allowlist blocks unauthorized access (if enabled)
- [ ] Concurrent config updates handled gracefully
- [ ] Admin UI handles server errors gracefully

## Image Best Practices

Based on 2025 web performance standards:

1. **Consistent Sizing**: Preprocessing worker handles this - all images resized to target resolution
2. **Format**: Preprocessing worker converts everything to WebP (25-35% size reduction vs JPEG)
3. **Limit Count**: Start with ~50 images, add more if performance allows
4. **Resolution**: Configure target resolution in config.json to match DAKboard display
5. **Caching**: Set long cache headers for processed images (they don't change after processing)
6. **Source Images**: Keep high-quality originals in raw directory - preprocessing optimizes for web delivery

## Security Considerations

1. **No directory traversal**: Validate image paths are within configured `imagePath`
2. **File type validation**: Only serve configured image extensions
3. **HTTPS required**: DAKboard requires secure connection
4. **No authentication needed**: Assuming private network deployment
5. **CORS headers**: May need to set if DAKboard origin differs
6. **SSE connection limits**: Consider max SSE connections if serving multiple clients

## File Permissions

**NAS Mount Permissions:**
- **Raw directory**: Read-only for preprocessor (if not archiving originals)
- **Processed directory**: Read-write for preprocessor, read-only for web server
- **Archive directory**: Write for preprocessor

**Docker volume permissions:**
```yaml
volumes:
  - /mnt/nas/photos/raw:/mnt/photos/raw:ro      # Read-only
  - /mnt/nas/photos/processed:/mnt/photos/processed  # Read-write
```

**User mapping in Docker:**
The container runs as node user (UID 1000). If NAS files have different ownership:
```dockerfile
# In Dockerfile, or use Docker's --user flag
USER 1000:1000
```

Or mount with specific UID/GID on the host.

## Logging

**Log format** (JSON for structured logging):
```javascript
const log = (level, message, data = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  }));
};

// Usage
log('info', 'Image processed', { file: 'photo.jpg', duration: 150 });
log('error', 'Processing failed', { file: 'bad.jpg', error: err.message });
```

**Docker logs:**
- Logs go to stdout/stderr (captured by Docker)
- View with: `docker logs slideshow` or `docker compose logs -f`
- Follow logs in real-time: `docker compose logs -f`
- Configure log rotation in Docker daemon or docker-compose:
```yaml
services:
  slideshow:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Process Startup Order

**No strict dependency** - both processes can start independently:

1. **Preprocessor** watches raw directory and processes new images
2. **Server** serves whatever is already in the processed directory

**On fresh install:**
- Preprocessor may take time to process existing images
- Server shows empty slideshow until images are processed
- This is expected behavior - no manual intervention needed

**Health check endpoint** (optional):
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    images: imageList.length,
    uptime: process.uptime()
  });
});
```

## Dependencies

**package.json**:
```json
{
  "name": "image-slideshow",
  "version": "1.0.0",
  "description": "Auto-updating image slideshow for DAKboard",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.0",
    "chokidar": "^3.5.0",
    "sharp": "^0.33.0"
  },
  "scripts": {
    "start": "node server.js",
    "preprocess": "node preprocessor.js",
    "dev": "NODE_ENV=development node server.js",
    "dev:preprocess": "NODE_ENV=development node preprocessor.js"
  }
}
```

**Global dependencies** (on deployment server):
- Docker and Docker Compose
- nginx (optional, for HTTPS reverse proxy)

## Future Enhancements

- Image metadata display (filename, date, EXIF data)
- Multiple albums/directories with navigation
- Web-based configuration UI (change settings without editing files)
- Image upload capability via web interface
- Video support (mp4, webm)
- Clock/weather overlay (similar to DAKboard)
- Transition effects library (Splide has plugins)
- Image caching/thumbnails for faster loading
- Mobile-responsive layout (for testing on phone)
- Image rotation based on EXIF orientation

## Troubleshooting

### File watching not working on NAS

**Symptom**: New images don't appear in slideshow
**Solution**: Ensure `usePolling: true` in Chokidar config. Standard file system events don't work on network mounts.

### SSE connection drops

**Symptom**: Updates stop working after some time
**Solution**: Check nginx config has `proxy_buffering off` and `proxy_cache off`. Add SSE reconnection logic in frontend.

### High CPU usage

**Symptom**: Server consuming excessive CPU
**Solution**: Increase Chokidar `interval` from 1000ms to 3000-5000ms. Reduce polling frequency.

### Images not loading in iframe

**Symptom**: DAKboard shows security warning
**Solution**: Verify HTTPS cert is valid and trusted. Check CORS headers if needed.

### Preprocessing not working

**Symptom**: Images added to raw directory don't get processed
**Solution**:
- Check container is running (`docker ps` or `docker compose ps`)
- Verify `usePolling: true` in preprocessor's Chokidar config
- Check file permissions on raw and processed directories
- Check preprocessor logs for errors (`docker compose logs -f`)

### Sharp installation fails

**Symptom**: `npm install sharp` fails with compilation errors
**Solution**: Sharp requires native dependencies. On Linux, install: `apt-get install build-essential libvips-dev`. On macOS, ensure Xcode command line tools are installed.

### HEIC images not converting

**Symptom**: HEIC/HEIF images fail to process or are skipped
**Cause**: Sharp requires `libheif` for HEIC support, which is not installed by default.
**Solution**:
- **macOS**: `brew install libheif`
- **Linux (Debian/Ubuntu)**: `apt-get install libheif-dev`
- **Docker**: Add to Dockerfile: `RUN apt-get install -y libheif-dev`
- **Alternative**: Convert HEIC to JPEG on your phone/device before uploading to NAS

**Note**: HEIC is intentionally not included in the default `inputExtensions` config. Add `.heic` and `.heif` only after installing libheif.

## Estimated Complexity

**Development time**:
- Phase 0 (Preprocessing worker): 1-2 hours
- Phase 1 (Core): 1-2 hours
- Phase 2 (File watching + SSE): 2-3 hours
- Phase 3 (NAS integration): 1 hour
- Phase 4 (HTTPS/Deployment): 1-2 hours
- Phase 5 (DAKboard integration): 1 hour
- Phase 6 (Admin interface): 2-3 hours

**Total**: ~9-14 hours for production-ready solution with preprocessing, file watching, and admin interface

---

*Last updated: December 2025*
