---
id: 13
title: Soft Delete and Restore API
depends_on: [10]
status: pending
---

# Task 13: Soft Delete and Restore API

## Description

Implement soft delete functionality that moves images to a trash folder instead of permanently deleting them. Add the `admin.trashPath` config option, DELETE endpoint for soft delete, and POST endpoint for restore.

## Deliverables

- `config.json` - Add `admin.trashPath` configuration option
- `server.js` - Add DELETE `/api/admin/images/:filename` endpoint (soft delete)
- `server.js` - Add POST `/api/admin/images/:filename/restore` endpoint
- `server.js` - Add `getTrashFiles()` helper function

## Acceptance Criteria

- [ ] Config supports `admin.trashPath` for trash directory location
- [ ] Soft delete moves image from processed to trash directory
- [ ] Soft delete creates `.meta.json` file with deletion timestamp and original path
- [ ] Soft delete removes image from exclusion list if present
- [ ] Soft delete broadcasts SSE `remove` event
- [ ] Restore moves image from trash back to processed directory
- [ ] Restore deletes the `.meta.json` file and broadcasts SSE `add` event

## Implementation Details

### Config Addition

```json
{
  "admin": {
    "enabled": true,
    "allowedIPs": [],
    "trashPath": "/mnt/photos/trash"
  }
}
```

### Helper Functions

```javascript
async function getTrashFiles() {
  try {
    const trashPath = config.admin?.trashPath;
    if (!trashPath) return [];

    const files = await fs.readdir(trashPath);
    return files.filter(f =>
      config.imageExtensions.includes(path.extname(f).toLowerCase())
    );
  } catch {
    return [];
  }
}

async function ensureTrashDir() {
  const trashPath = config.admin?.trashPath;
  if (trashPath) {
    await fs.mkdir(trashPath, { recursive: true });
  }
}
```

### DELETE /api/admin/images/:filename (Soft Delete)

```javascript
app.delete('/api/admin/images/:filename', adminIPFilter, async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const trashPath = config.admin?.trashPath;

    if (!trashPath) {
      return res.status(400).json({ error: 'Trash path not configured' });
    }

    const sourcePath = path.join(config.imagePath, filename);
    const destPath = path.join(trashPath, filename);
    const metaPath = path.join(trashPath, `${filename}.meta.json`);

    // Verify source exists
    try {
      await fs.access(sourcePath);
    } catch {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Ensure trash directory exists
    await ensureTrashDir();

    // Move to trash
    await fs.rename(sourcePath, destPath);

    // Create metadata file
    const meta = {
      deletedAt: Date.now(),
      originalPath: 'processed'
    };
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

    // Remove from exclusion list if present
    const excluded = await loadExcludedImages();
    if (excluded.includes(filename)) {
      await saveExcludedImages(excluded.filter(f => f !== filename));
    }

    // Broadcast removal
    broadcast('remove', { filename });

    log('info', 'Image soft deleted', { filename });
    res.json({ success: true, filename });
  } catch (err) {
    log('error', 'Failed to delete image', { error: err.message });
    res.status(500).json({ error: 'Failed to delete image' });
  }
});
```

### POST /api/admin/images/:filename/restore

```javascript
app.post('/api/admin/images/:filename/restore', adminIPFilter, async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const trashPath = config.admin?.trashPath;

    if (!trashPath) {
      return res.status(400).json({ error: 'Trash path not configured' });
    }

    const sourcePath = path.join(trashPath, filename);
    const destPath = path.join(config.imagePath, filename);
    const metaPath = path.join(trashPath, `${filename}.meta.json`);

    // Verify source exists in trash
    try {
      await fs.access(sourcePath);
    } catch {
      return res.status(404).json({ error: 'Image not found in trash' });
    }

    // Move back to processed
    await fs.rename(sourcePath, destPath);

    // Delete metadata file
    try {
      await fs.unlink(metaPath);
    } catch {
      // Ignore if meta file doesn't exist
    }

    // Broadcast addition
    broadcast('add', { filename });

    log('info', 'Image restored', { filename });
    res.json({ success: true, filename });
  } catch (err) {
    log('error', 'Failed to restore image', { error: err.message });
    res.status(500).json({ error: 'Failed to restore image' });
  }
});
```

## Testing Checklist

- [ ] Soft delete moves image to trash directory
- [ ] Verify `.meta.json` created with correct timestamp
- [ ] Verify image removed from exclusion list on delete
- [ ] Verify SSE `remove` event broadcast on delete
- [ ] Restore moves image back to processed directory
- [ ] Verify `.meta.json` deleted on restore
- [ ] Verify SSE `add` event broadcast on restore
- [ ] Verify 404 for non-existent images
