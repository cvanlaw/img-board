---
id: 12
title: Exclude Toggle API
depends_on: [10]
status: pending
---

# Task 12: Exclude Toggle API

## Description

Create the POST `/api/admin/images/:filename/exclude` endpoint that toggles an image's visibility in the slideshow. Updates the exclusion file atomically and broadcasts SSE events to connected slideshow clients.

## Deliverables

- `server.js` - Add POST `/api/admin/images/:filename/exclude` endpoint

## Acceptance Criteria

- [ ] Endpoint accepts `{ "excluded": true|false }` in request body
- [ ] Updates `.excluded-images.json` atomically using `saveExcludedImages()`
- [ ] Broadcasts SSE `remove` event when image excluded
- [ ] Broadcasts SSE `add` event when image included
- [ ] Returns 404 if image file doesn't exist in processed directory
- [ ] Endpoint protected by `adminIPFilter` middleware

## Implementation Details

### POST /api/admin/images/:filename/exclude Endpoint

```javascript
app.post(
  '/api/admin/images/:filename/exclude',
  adminIPFilter,
  async (req, res) => {
    try {
      const filename = path.basename(req.params.filename); // Prevent traversal
      const { excluded } = req.body;

      if (typeof excluded !== 'boolean') {
        return res.status(400).json({ error: 'excluded must be a boolean' });
      }

      // Verify file exists
      const filePath = path.join(config.imagePath, filename);
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: 'Image not found' });
      }

      // Update exclusion list
      const currentExcluded = await loadExcludedImages();
      let newExcluded;

      if (excluded) {
        if (!currentExcluded.includes(filename)) {
          newExcluded = [...currentExcluded, filename];
        } else {
          newExcluded = currentExcluded;
        }
      } else {
        newExcluded = currentExcluded.filter((f) => f !== filename);
      }

      await saveExcludedImages(newExcluded);

      // Broadcast SSE event
      if (excluded) {
        broadcast('remove', { filename });
      } else {
        broadcast('add', { filename });
      }

      log('info', 'Image exclusion toggled', { filename, excluded });
      res.json({ success: true, filename, excluded });
    } catch (err) {
      log('error', 'Failed to toggle exclusion', { error: err.message });
      res.status(500).json({ error: 'Failed to toggle exclusion' });
    }
  }
);
```

## Testing Checklist

- [ ] POST with `{"excluded": true}` adds image to exclusion list
- [ ] POST with `{"excluded": false}` removes image from exclusion list
- [ ] Verify SSE `remove` event received by slideshow when excluding
- [ ] Verify SSE `add` event received by slideshow when including
- [ ] Verify 404 returned for non-existent image
- [ ] Verify slideshow updates in real-time without refresh
