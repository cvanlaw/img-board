# Task 05: File Watching & SSE

## Description
Add Chokidar file watching to the server to detect new/changed/deleted images, and implement Server-Sent Events (SSE) to push updates to connected frontend clients in real-time.

## Dependencies
- Task 03: Express Server Core
- Task 04: Slideshow Frontend (to receive updates)

## Deliverables
- Updated `server.js` with Chokidar watcher and SSE endpoint
- Updated `public/js/slideshow.js` with SSE connection and dynamic slide updates

## Acceptance Criteria
- [ ] Server watches processed image directory with Chokidar
- [ ] `usePolling: true` enabled for NAS/network mount compatibility
- [ ] `GET /api/events` establishes SSE connection
- [ ] SSE sends events: `add`, `remove`, `reshuffle`
- [ ] Frontend connects to SSE and handles reconnection
- [ ] New images appear in slideshow without page refresh
- [ ] Deleted images removed from slideshow
- [ ] Reshuffle event triggers full slideshow rebuild
- [ ] Multiple clients receive updates simultaneously

## Implementation Details

### Server-Side Chokidar Setup
```javascript
const chokidar = require('chokidar');

let imageList = [];
let sseClients = [];
let pendingChanges = { added: [], removed: [] };

const watcher = chokidar.watch(config.imagePath, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: true,
  usePolling: true,
  interval: 1000
});

watcher.on('add', (filePath) => {
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();
  if (config.imageExtensions.includes(ext)) {
    if (config.reshuffleInterval > 0) {
      pendingChanges.added.push(filename);
    } else {
      imageList.push(filename);
      broadcast('add', { filename });
    }
    log('info', 'Image added', { filename });
  }
});

watcher.on('unlink', (filePath) => {
  const filename = path.basename(filePath);
  if (config.reshuffleInterval > 0) {
    pendingChanges.removed.push(filename);
  } else {
    imageList = imageList.filter(f => f !== filename);
    broadcast('remove', { filename });
  }
  log('info', 'Image removed', { filename });
});
```

### SSE Endpoint
```javascript
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  res.write('event: connected\ndata: {}\n\n');

  // Track client
  sseClients.push(res);

  // Clean up on disconnect
  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

function broadcast(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => client.write(message));
}
```

### Reshuffle Timer
```javascript
if (config.reshuffleInterval > 0) {
  setInterval(() => {
    // Apply pending changes
    pendingChanges.added.forEach(f => imageList.push(f));
    pendingChanges.removed.forEach(f => {
      imageList = imageList.filter(img => img !== f);
    });
    pendingChanges = { added: [], removed: [] };

    // Shuffle if configured
    if (config.randomOrder) {
      imageList = shuffleArray(imageList);
    }

    // Broadcast full list
    broadcast('reshuffle', { images: imageList });
    log('info', 'Reshuffle broadcast', { count: imageList.length });
  }, config.reshuffleInterval);
}
```

### Frontend SSE Connection
```javascript
function connectSSE() {
  const eventSource = new EventSource('/api/events');

  eventSource.onerror = () => {
    eventSource.close();
    setTimeout(connectSSE, 5000); // Reconnect after 5s
  };

  eventSource.addEventListener('add', (e) => {
    const { filename } = JSON.parse(e.data);
    addSlide(filename);
  });

  eventSource.addEventListener('remove', (e) => {
    const { filename } = JSON.parse(e.data);
    removeSlide(filename);
  });

  eventSource.addEventListener('reshuffle', (e) => {
    const { images } = JSON.parse(e.data);
    rebuildSlideshow(images);
  });
}

function addSlide(filename) {
  const slide = document.createElement('li');
  slide.className = 'splide__slide';
  slide.dataset.filename = filename;
  slide.innerHTML = `<img src="/images/${filename}" loading="lazy" alt="">`;
  splide.add(slide);
}

function removeSlide(filename) {
  const slides = splide.Components.Elements.slides;
  for (let i = 0; i < slides.length; i++) {
    if (slides[i].dataset.filename === filename) {
      splide.remove(i);
      break;
    }
  }
}

function rebuildSlideshow(images) {
  while (splide.length > 0) {
    splide.remove(0);
  }
  images.forEach(filename => addSlide(filename));
}

// Connect on init
connectSSE();
```

## Testing Checklist
- [ ] Add image to processed directory - appears in slideshow within poll interval
- [ ] Delete image from processed directory - removed from slideshow
- [ ] SSE connection established (check DevTools Network tab)
- [ ] SSE reconnects after server restart (5s delay)
- [ ] Multiple browser tabs receive same updates
- [ ] Reshuffle event rebuilds slideshow correctly
- [ ] No memory leak with long-running SSE connections
- [ ] Works through nginx reverse proxy (if applicable)
