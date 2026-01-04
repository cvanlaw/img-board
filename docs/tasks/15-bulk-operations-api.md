---
id: 15
title: Bulk Operations API
depends_on: [12, 13, 14]
status: pending
---

# Task 15: Bulk Operations API

## Description

Create the POST `/api/admin/images/bulk` endpoint that performs batch operations on multiple images. Supports exclude, include, delete, restore, and permanent-delete actions.

## Deliverables

- `server.js` - Add POST `/api/admin/images/bulk` endpoint

## Acceptance Criteria

- [ ] Accepts `action` (exclude|include|delete|restore|permanent-delete) and `filenames` array
- [ ] Processes each file and collects individual results
- [ ] Returns success status for each file (handles partial failures)
- [ ] Broadcasts appropriate SSE events for each successful operation
- [ ] Endpoint protected by `adminIPFilter` middleware

## Implementation Details

### POST /api/admin/images/bulk

```javascript
app.post('/api/admin/images/bulk', adminIPFilter, async (req, res) => {
  try {
    const { action, filenames } = req.body;

    if (!action || !Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({
        error: 'action and filenames array required',
      });
    }

    const validActions = [
      'exclude',
      'include',
      'delete',
      'restore',
      'permanent-delete',
    ];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      });
    }

    const results = [];

    for (const filename of filenames) {
      const safeFilename = path.basename(filename);

      try {
        switch (action) {
          case 'exclude':
            await performExclude(safeFilename, true);
            break;
          case 'include':
            await performExclude(safeFilename, false);
            break;
          case 'delete':
            await performSoftDelete(safeFilename);
            break;
          case 'restore':
            await performRestore(safeFilename);
            break;
          case 'permanent-delete':
            await performPermanentDelete(safeFilename);
            break;
        }
        results.push({ filename: safeFilename, success: true });
      } catch (err) {
        results.push({
          filename: safeFilename,
          success: false,
          error: err.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    log('info', 'Bulk operation completed', {
      action,
      total: filenames.length,
      success: successCount,
    });

    res.json({
      success: successCount === filenames.length,
      results,
    });
  } catch (err) {
    log('error', 'Bulk operation failed', { error: err.message });
    res.status(500).json({ error: 'Bulk operation failed' });
  }
});
```

### Helper Functions (refactored from individual endpoints)

```javascript
async function performExclude(filename, excluded) {
  const filePath = path.join(config.imagePath, filename);
  await fs.access(filePath); // Throws if not found

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
  broadcast(excluded ? 'remove' : 'add', { filename });
}

async function performSoftDelete(filename) {
  // Implementation from Task 13
}

async function performRestore(filename) {
  // Implementation from Task 13
}

async function performPermanentDelete(filename) {
  // Implementation from Task 14
}
```

## Testing Checklist

- [ ] Bulk exclude updates multiple images at once
- [ ] Bulk include removes multiple images from exclusion list
- [ ] Bulk delete moves multiple images to trash
- [ ] Bulk restore moves multiple images back from trash
- [ ] Bulk permanent-delete removes multiple images from trash
- [ ] Partial failures return per-item results
- [ ] SSE events broadcast for each successful operation
