# Image Management Feature Design

## Overview

Admin feature to manage existing images in the slideshow: include/exclude from display, soft delete with restore capability, and bulk operations.

## Requirements

1. **Include/Exclude** - Toggle image visibility in slideshow without deleting
2. **Soft Delete** - Move images to trash folder with restore option
3. **Bulk Operations** - Multi-select for batch exclude/include/delete/restore
4. **Admin Only** - Protected by existing IP filter middleware

---

## Data Storage

### Exclusion State: `.excluded-images.json`

Follows existing IPC file pattern (`.reprocess-trigger`, `.reprocess-progress.json`).

```json
{
  "excluded": ["vacation-2024.webp", "old-photo.webp"],
  "lastModified": 1704384000000
}
```

**Location:** Project root (alongside `config.json`)

### Trash Directory

New config option for soft-deleted images:

```json
{
  "admin": {
    "trashPath": "/mnt/photos/trash"
  }
}
```

Deleted images move here with metadata file:
```
/mnt/photos/trash/
  photo1.webp
  photo1.webp.meta.json  // { "deletedAt": 1704384000000, "originalPath": "processed" }
```

---

## API Endpoints

### GET `/api/admin/images`

List all images with metadata and status.

**Query params:** `?filter=all|visible|excluded|trash&page=1&limit=50`

**Response:**
```json
{
  "images": [
    {
      "filename": "photo1.webp",
      "excluded": false,
      "deleted": false,
      "size": 245678,
      "modified": 1704384000000
    }
  ],
  "total": 50,
  "visible": 45,
  "excluded": 3,
  "trash": 2
}
```

### POST `/api/admin/images/:filename/exclude`

Toggle exclusion status.

**Request:** `{ "excluded": true }`

**Behavior:**
- Updates `.excluded-images.json` atomically
- Broadcasts SSE `remove` or `add` event to slideshow clients

### DELETE `/api/admin/images/:filename`

Soft delete - move to trash.

**Behavior:**
- Move from processed directory to `config.admin.trashPath`
- Create `.meta.json` file with deletion timestamp
- Remove from `.excluded-images.json` if present
- Attempt cleanup from raw/archive directories
- Broadcast SSE `remove` event

### POST `/api/admin/images/:filename/restore`

Restore from trash.

**Behavior:**
- Move from trash back to processed directory
- Delete `.meta.json` file
- Broadcast SSE `add` event

### DELETE `/api/admin/images/:filename/permanent`

Hard delete from trash (permanent).

**Behavior:**
- Remove file and `.meta.json` from trash
- No recovery possible

### POST `/api/admin/images/bulk`

Bulk operations.

**Request:**
```json
{
  "action": "exclude" | "include" | "delete" | "restore" | "permanent-delete",
  "filenames": ["photo1.webp", "photo2.webp"]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    { "filename": "photo1.webp", "success": true },
    { "filename": "photo2.webp", "success": false, "error": "File not found" }
  ]
}
```

---

## Server Modifications

### File: `server.js`

**New functions:**
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

**Modify GET `/api/images`:**
```javascript
// Filter out excluded images from slideshow
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

---

## UI Design

### New Section in `admin.html`

Add "Manage Images" card between "Upload Images" and "Slideshow Settings":

```
┌─────────────────────────────────────────────────────┐
│ Manage Images                                       │
├─────────────────────────────────────────────────────┤
│ [Search...________]  [Filter: All ▼]                │
│                                                     │
│ ☐ Select All    [Exclude] [Include] [Delete]       │
├─────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │ ☐  │ │ ☐  │ │ ☐  │ │ ☐  │ │ ☐  │ │ ☐  │    │
│ │ img │ │ img │ │ img │ │ img │ │ img │ │ img │    │
│ │     │ │ dim │ │     │ │     │ │     │ │     │    │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘    │
│ name.w  excl.w  name.w  name.w  name.w  name.w     │
│ [⊘][🗑] [⊘][🗑] [⊘][🗑] [⊘][🗑] [⊘][🗑] [⊘][🗑]     │
├─────────────────────────────────────────────────────┤
│              [< 1 2 3 4 5 >]                        │
└─────────────────────────────────────────────────────┘
```

**Visual states:**
- Normal: Full opacity
- Excluded: 50% opacity with "excluded" badge
- Selected: Blue border

**Filter dropdown options:**
- All Images
- Visible Only
- Excluded Only
- Trash

### Gallery Item Actions

Each thumbnail shows:
- Checkbox (top-left) for multi-select
- Filename (below image, truncated)
- Toggle exclude button (eye icon)
- Delete button (trash icon)

### Trash View

When filter = "Trash":
- Shows deleted images
- Actions change to: [Restore] [Permanent Delete]
- Warning banner: "Items in trash will be permanently deleted after 30 days" (optional auto-cleanup)

---

## CSS Additions

```css
.image-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.gallery-item {
  position: relative;
  aspect-ratio: 16/9;
  border: 2px solid transparent;
  border-radius: 4px;
  overflow: hidden;
}

.gallery-item.selected { border-color: #007bff; }
.gallery-item.excluded { opacity: 0.5; }

.gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-item .checkbox {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
}

.gallery-item .actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  padding: 0.5rem;
  display: flex;
  justify-content: space-between;
}

.btn-danger { background: #dc3545; }
```

---

## JavaScript Functions (`admin.js`)

```javascript
// State
let allImages = [];
let selectedImages = new Set();
let currentPage = 1;
let currentFilter = 'all';

// Core functions
async function loadImages() { /* GET /api/admin/images */ }
function renderGallery() { /* Build thumbnail grid */ }
function toggleSelection(filename) { /* Add/remove from set */ }
async function toggleExclusion(filename) { /* POST exclude */ }
async function deleteImage(filename) { /* DELETE with confirm */ }
async function restoreImage(filename) { /* POST restore */ }
async function bulkAction(action) { /* POST /api/admin/images/bulk */ }
function renderPagination() { /* Page controls */ }
```

---

## SSE Integration

Existing events used:
- `remove` - When image excluded or deleted
- `add` - When image included or restored

No new event types needed.

---

## Files to Modify

| File | Changes |
|------|---------|
| `server.js` | Add 6 new endpoints, modify `/api/images`, add exclusion file handling |
| `public/admin.html` | Add image management section HTML |
| `public/js/admin.js` | Add gallery rendering, selection, CRUD operations |
| `config.json` | Add `admin.trashPath` option |

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Image not found | 404 with message |
| Permission denied | 500 with error details |
| Bulk partial failure | 200 with per-item results |
| Trash directory missing | Create on first delete |

---

## Security Considerations

- All endpoints protected by existing `adminIPFilter` middleware
- Use `path.basename()` to prevent directory traversal
- Validate filename extensions against config
- Atomic file writes for `.excluded-images.json`

---

## Testing Checklist

- [ ] Exclude image removes from slideshow via SSE
- [ ] Include image adds back to slideshow
- [ ] Soft delete moves to trash, broadcasts remove
- [ ] Restore from trash moves back, broadcasts add
- [ ] Permanent delete removes file completely
- [ ] Bulk operations handle partial failures
- [ ] Pagination works with large image sets
- [ ] Search filters correctly
- [ ] IP filter protects all new endpoints
