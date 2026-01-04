---
id: 14
title: Permanent Delete API
depends_on: [13]
status: pending
---

# Task 14: Permanent Delete API

## Description

Create the DELETE `/api/admin/images/:filename/permanent` endpoint that permanently removes an image from the trash folder. This is a destructive operation with no recovery.

## Deliverables

- `server.js` - Add DELETE `/api/admin/images/:filename/permanent` endpoint

## Acceptance Criteria

- [ ] Endpoint removes image file from trash directory
- [ ] Endpoint removes associated `.meta.json` file
- [ ] Returns 404 if image not found in trash
- [ ] Endpoint protected by `adminIPFilter` middleware

## Implementation Details

### DELETE /api/admin/images/:filename/permanent

```javascript
app.delete(
  '/api/admin/images/:filename/permanent',
  adminIPFilter,
  async (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const trashPath = config.admin?.trashPath;

      if (!trashPath) {
        return res.status(400).json({ error: 'Trash path not configured' });
      }

      const filePath = path.join(trashPath, filename);
      const metaPath = path.join(trashPath, `${filename}.meta.json`);

      // Verify file exists in trash
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: 'Image not found in trash' });
      }

      // Delete image file
      await fs.unlink(filePath);

      // Delete metadata file if exists
      try {
        await fs.unlink(metaPath);
      } catch {
        // Ignore if meta file doesn't exist
      }

      log('info', 'Image permanently deleted', { filename });
      res.json({ success: true, filename });
    } catch (err) {
      log('error', 'Failed to permanently delete image', {
        error: err.message,
      });
      res.status(500).json({ error: 'Failed to permanently delete image' });
    }
  }
);
```

## Testing Checklist

- [ ] Permanent delete removes image file from trash
- [ ] Permanent delete removes `.meta.json` file
- [ ] Verify 404 returned for image not in trash
- [ ] Verify file cannot be recovered after permanent delete
