---
id: 11
title: Image List API
depends_on: [10]
status: pending
---

# Task 11: Image List API

## Description

Create the GET `/api/admin/images` endpoint that returns all images with metadata including exclusion status, file size, and modification time. Supports filtering by visibility state and pagination for large collections.

## Deliverables

- `server.js` - Add GET `/api/admin/images` endpoint with query param support

## Acceptance Criteria

- [ ] Endpoint returns images array with `filename`, `excluded`, `deleted`, `size`, `modified` fields
- [ ] Query param `filter=all|visible|excluded|trash` filters results appropriately
- [ ] Query params `page` and `limit` provide pagination (default limit: 50)
- [ ] Response includes counts: `total`, `visible`, `excluded`, `trash`
- [ ] Endpoint protected by existing `adminIPFilter` middleware
- [ ] Returns 403 for unauthorized IPs

## Implementation Details

### GET /api/admin/images Endpoint

```javascript
app.get('/api/admin/images', adminIPFilter, async (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const processedFiles = await fs.readdir(config.imagePath);
    const excluded = await loadExcludedImages();
    const trashFiles = await getTrashFiles(); // To be implemented in Task 13

    let images = [];

    // Build image list with metadata
    for (const filename of processedFiles) {
      const ext = path.extname(filename).toLowerCase();
      if (!config.imageExtensions.includes(ext)) continue;

      const filePath = path.join(config.imagePath, filename);
      const stats = await fs.stat(filePath);

      images.push({
        filename,
        excluded: excluded.includes(filename),
        deleted: false,
        size: stats.size,
        modified: stats.mtimeMs,
      });
    }

    // Apply filter
    if (filter === 'visible') {
      images = images.filter((i) => !i.excluded);
    } else if (filter === 'excluded') {
      images = images.filter((i) => i.excluded);
    }
    // filter === 'trash' handled separately with trash files

    // Pagination
    const total = images.length;
    const start = (page - 1) * limit;
    const paginatedImages = images.slice(start, start + limit);

    res.json({
      images: paginatedImages,
      total,
      visible: images.filter((i) => !i.excluded).length,
      excluded: excluded.length,
      trash: trashFiles.length,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    log('error', 'Failed to list images', { error: err.message });
    res.status(500).json({ error: 'Failed to list images' });
  }
});
```

## Testing Checklist

- [ ] Verify endpoint returns correct image metadata
- [ ] Test `filter=visible` returns only non-excluded images
- [ ] Test `filter=excluded` returns only excluded images
- [ ] Test pagination with `page=2&limit=10`
- [ ] Verify 403 returned for non-allowed IP
- [ ] Verify counts in response match actual file states
