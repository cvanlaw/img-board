---
id: 10
title: Exclusion State Management
depends_on: []
status: pending
---

# Task 10: Exclusion State Management

## Description

Implement the foundation for image exclusion by adding functions to load and save exclusion state from `.excluded-images.json`, and modify the existing `/api/images` endpoint to filter out excluded images from the slideshow.

## Deliverables

- `server.js` - Add `loadExcludedImages()` and `saveExcludedImages()` functions
- `server.js` - Modify GET `/api/images` to filter excluded images
- `.excluded-images.json` - Created automatically when first exclusion occurs

## Acceptance Criteria

- [ ] `loadExcludedImages()` returns array of excluded filenames (empty array if file missing)
- [ ] `saveExcludedImages()` writes atomically (temp file + rename pattern)
- [ ] GET `/api/images` filters out filenames present in exclusion list
- [ ] Exclusion file follows format: `{ "excluded": [...], "lastModified": timestamp }`
- [ ] Existing slideshow functionality unchanged when no exclusions exist

## Implementation Details

### Exclusion File Functions

```javascript
const EXCLUDED_FILE = './.excluded-images.json';

async function loadExcludedImages() {
  try {
    const data = await fs.readFile(EXCLUDED_FILE, 'utf8');
    return JSON.parse(data).excluded || [];
  } catch {
    return [];
  }
}

async function saveExcludedImages(excluded) {
  const data = JSON.stringify({ excluded, lastModified: Date.now() }, null, 2);
  await fs.writeFile(EXCLUDED_FILE + '.tmp', data);
  await fs.rename(EXCLUDED_FILE + '.tmp', EXCLUDED_FILE);
}
```

### Modified /api/images Endpoint

```javascript
app.get('/api/images', async (req, res) => {
  const files = await fs.readdir(config.imagePath);
  const excluded = await loadExcludedImages();

  let images = files.filter(f =>
    config.imageExtensions.includes(path.extname(f).toLowerCase()) &&
    !excluded.includes(f)  // Filter excluded
  );
  // ... rest unchanged
});
```

## Testing Checklist

- [ ] Create `.excluded-images.json` manually with test data, verify `/api/images` filters correctly
- [ ] Delete `.excluded-images.json`, verify `/api/images` returns all images
- [ ] Verify atomic write pattern prevents file corruption
- [ ] Verify slideshow displays only non-excluded images
