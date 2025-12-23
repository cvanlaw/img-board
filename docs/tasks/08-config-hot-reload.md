# Task 08: Config Hot Reload

## Description
Implement configuration file watching in both server.js and preprocessor.js so that config changes apply without process restart. Changes to slideshow settings broadcast to connected clients via SSE.

## Dependencies
- Task 02: Image Preprocessor
- Task 03: Express Server Core
- Task 05: File Watching & SSE (for broadcasting)

## Deliverables
- Updated `server.js` with config.json watcher
- Updated `preprocessor.js` with config.json watcher

## Acceptance Criteria
- [ ] Both processes watch config.json for changes
- [ ] Config changes detected within ~1 second
- [ ] Server reloads config and updates in-memory settings
- [ ] Preprocessor reloads config and updates processing settings
- [ ] Slideshow clients receive `config-update` SSE event
- [ ] Slideshow interval updates live without refresh
- [ ] No process restart required for config changes
- [ ] Handles rapid config changes gracefully (debounce)

## Implementation Details

### Chokidar Config Watcher (Both Processes)
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
  log('info', 'Config file changed, reloading...');

  // Clear Node.js require cache
  delete require.cache[require.resolve('./config.json')];

  // Reload configuration
  const newConfig = require('./config.json');

  // Update in-memory settings
  updateSettings(newConfig);
});
```

### Server Config Update
```javascript
// In server.js
let config = require('./config.json');

function updateSettings(newConfig) {
  const oldInterval = config.slideshowInterval;
  config = newConfig;

  // Broadcast config update to slideshow clients
  if (oldInterval !== newConfig.slideshowInterval) {
    broadcast('config-update', {
      slideshowInterval: newConfig.slideshowInterval
    });
    log('info', 'Slideshow interval updated', {
      from: oldInterval,
      to: newConfig.slideshowInterval
    });
  }
}
```

### Preprocessor Config Update
```javascript
// In preprocessor.js
let config = require('./config.json');

function updateSettings(newConfig) {
  const oldWidth = config.preprocessing.targetWidth;
  const oldHeight = config.preprocessing.targetHeight;

  config = newConfig;

  log('info', 'Preprocessor config reloaded', {
    targetWidth: config.preprocessing.targetWidth,
    targetHeight: config.preprocessing.targetHeight
  });

  // Note: Dimension changes trigger reprocessing via separate mechanism (Task 09)
}
```

### Frontend SSE Handler for Config Updates
```javascript
// In slideshow.js
eventSource.addEventListener('config-update', (e) => {
  const update = JSON.parse(e.data);

  if (update.slideshowInterval) {
    splide.options.interval = update.slideshowInterval;
    console.log('Slideshow interval updated to', update.slideshowInterval);
  }
});
```

### Key Considerations

1. **Cache Clearing**: Must use `delete require.cache[...]` before re-requiring config.json, otherwise Node.js serves cached version.

2. **awaitWriteFinish**: Essential when config is written atomically (temp file + rename). The `stabilityThreshold` ensures we don't trigger on incomplete writes.

3. **Debouncing**: The `awaitWriteFinish` options provide built-in debouncing for rapid changes.

4. **Error Handling**: Wrap config reload in try/catch to handle malformed JSON gracefully:
```javascript
configWatcher.on('change', () => {
  try {
    delete require.cache[require.resolve('./config.json')];
    const newConfig = require('./config.json');
    updateSettings(newConfig);
  } catch (err) {
    log('error', 'Failed to reload config', { error: err.message });
    // Keep using existing config
  }
});
```

## Testing Checklist
- [ ] Modify config.json manually - server detects change
- [ ] Modify config.json manually - preprocessor detects change
- [ ] Change slideshowInterval - slideshow updates without refresh
- [ ] Change slideshowInterval via admin UI - slideshow updates
- [ ] Rapid config changes don't cause issues
- [ ] Invalid JSON in config.json - process logs error but continues
- [ ] Both processes log config reload
- [ ] SSE `config-update` event sent (check DevTools Network)
- [ ] Multiple slideshow clients all receive update
