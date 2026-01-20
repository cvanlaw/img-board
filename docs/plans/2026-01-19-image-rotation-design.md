# Image Rotation Feature Design

## Overview

Allow users to rotate images 90° at a time from the admin gallery. Rotations are applied permanently to the processed WebP file using Sharp, with immediate SSE updates to the slideshow.

## Design Decisions

| Decision         | Choice                      | Rationale                                           |
| ---------------- | --------------------------- | --------------------------------------------------- |
| Rotation storage | Permanent file modification | Simpler architecture, consistent display everywhere |
| UI controls      | Always-visible icon buttons | Accessible for mouse, keyboard, and touch           |
| Direction        | Two buttons (CW/CCW)        | Fastest path to any orientation                     |
| Bulk support     | Yes                         | Efficient for batches of similarly-oriented photos  |
| Slideshow update | Immediate SSE               | Viewers see corrections right away                  |

## API Design

### Single Image Rotation

```
POST /api/admin/images/:filename/rotate
Body: { "direction": "cw" | "ccw" }
Response: { "success": true, "filename": "image.webp" }
```

**Implementation:**

1. Validate filename exists in processed directory
2. Create temp file path: `${filename}.rotating.webp`
3. Use Sharp to rotate 90° (cw) or -90° (ccw)
4. Atomic replace: write to temp, rename over original
5. Delete temp file on error
6. Broadcast SSE event: `{ type: 'update', filename }`

### Bulk Rotation

```
POST /api/admin/images/bulk
Body: { "action": "rotate-cw" | "rotate-ccw", "filenames": [...] }
Response: { "results": [{ "filename": "...", "success": true/false }] }
```

Extends existing bulk endpoint. Processes sequentially to avoid disk contention; broadcasts SSE event after each successful rotation.

### Error Handling

- 404 if image doesn't exist
- 500 if Sharp operation fails
- Individual failures in bulk don't stop remaining operations
- Toast notification shows success/failure count

## UI Components

### Thumbnail Rotation Buttons

Each image card gets two rotation icons in the top-right corner:

```html
<div class="image-card">
  <img src="..." alt="..." />
  <div class="rotation-controls">
    <button
      class="rotate-btn"
      data-direction="ccw"
      aria-label="Rotate counter-clockwise"
    >
      ↺
    </button>
    <button
      class="rotate-btn"
      data-direction="cw"
      aria-label="Rotate clockwise"
    >
      ↻
    </button>
  </div>
</div>
```

**Styling requirements:**

- Small icon buttons (24x24px visible, 44x44px touch target)
- Semi-transparent background for visibility over images
- High contrast icons (white on dark background)
- Keyboard focusable with visible focus ring

### Bulk Action Bar

Add rotation buttons to existing bulk action bar:

```html
<div class="bulk-actions">
  <button id="bulkRotateCCW">↺ Rotate CCW</button>
  <button id="bulkRotateCW">↻ Rotate CW</button>
  <!-- existing buttons -->
</div>
```

### Loading State

- Disable rotation buttons on affected thumbnail
- Show spinner overlay on the image
- Re-enable and remove spinner on completion/error

## SSE Integration

### Server Event

```javascript
{
  type: 'update',
  filename: 'image.webp',
  timestamp: Date.now()
}
```

### Slideshow Client Handler

```javascript
eventSource.addEventListener('update', (event) => {
  const data = JSON.parse(event.data);
  const slide = findSlideByFilename(data.filename);
  if (slide) {
    const img = slide.querySelector('img');
    const url = new URL(img.src);
    url.searchParams.set('t', data.timestamp);
    img.src = url.toString();
  }
});
```

### Admin Gallery Update

After rotation, refresh thumbnail with cache-busting timestamp:

```javascript
img.src = `/api/admin/images/${filename}/thumbnail?t=${Date.now()}`;
```

## Files to Modify

| File                     | Changes                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `server.js`              | Add rotate endpoint; extend bulk endpoint; add SSE broadcast |
| `public/admin.html`      | Add rotation buttons to image cards and bulk action bar      |
| `public/js/admin.js`     | Add `rotateImage()` function and handlers                    |
| `public/js/slideshow.js` | Add `update` event listener                                  |
| `public/admin.css`       | Style rotation buttons with proper touch targets             |

## Testing

### Unit Tests

- Rotation angle calculation (cw = 90, ccw = -90)
- Error handling for missing files

### Integration Tests

- `POST /api/admin/images/:filename/rotate` - verify file is rotated
- Bulk rotation with mixed success/failure
- SSE `update` event broadcast
- 404 for non-existent image

### Manual Testing

1. Rotate single image → slideshow updates immediately
2. Bulk rotate multiple images → all update
3. Keyboard: Tab to button, Enter to activate
4. Touch device: tap button works
5. Error case: rotate while deleting
