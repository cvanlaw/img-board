---
id: 3
title: Upload UI Components
depends_on: []
status: pending
---

# Task 3: Upload UI Components

## Description

Add the HTML structure and CSS styling for the photo upload interface on the admin page. Includes a drag-and-drop zone, file preview area, upload controls, and progress bar.

## Deliverables

- `public/admin.html` - Add upload card HTML and inline CSS styles

## Acceptance Criteria

- [ ] Upload card appears after Image Statistics section
- [ ] Drop zone displays with dashed border and click-to-select functionality
- [ ] Hidden file input accepts `.jpg`, `.jpeg`, `.png` with multiple selection
- [ ] Preview container ready to display thumbnail grid
- [ ] Upload button initially disabled, Clear button always enabled
- [ ] Progress bar hidden by default, styled consistently with existing progress bar
- [ ] Message area for success/error feedback
- [ ] CSS provides hover/dragover states for drop zone
- [ ] Preview items styled as 80x80 thumbnails with remove buttons

## Implementation Details

### HTML Structure

Insert after Image Statistics card (around line 64):

```html
<div class="card">
  <h2>Upload Images</h2>
  <p>Supported formats: JPG, JPEG, PNG (max 50MB each, up to 10 files)</p>

  <div id="drop-zone" class="drop-zone">
    <p>Drag and drop images here, or click to select</p>
    <input type="file" id="file-input" multiple
           accept=".jpg,.jpeg,.png,image/jpeg,image/png"
           style="display: none;" />
  </div>

  <div id="upload-preview" class="upload-preview"></div>

  <button id="upload-btn" onclick="uploadFiles()" disabled>
    Upload Selected Files
  </button>
  <button onclick="clearUploadQueue()">Clear</button>

  <div id="upload-progress" class="progress-bar" style="display: none;">
    <div class="progress-fill" id="upload-progress-fill"></div>
  </div>
  <p id="upload-message"></p>
</div>
```

### CSS Styling

Add to inline `<style>` section:

```css
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 4px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  margin: 1rem 0;
}

.drop-zone:hover,
.drop-zone.dragover {
  border-color: #007bff;
  background: #f0f7ff;
}

.upload-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0;
}

.upload-preview-item {
  position: relative;
  width: 80px;
  height: 80px;
}

.upload-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.upload-preview-item .remove-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
  font-size: 12px;
}

.upload-preview-item .file-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.7);
  color: white;
  font-size: 10px;
  padding: 2px;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
```

## Testing Checklist

- [ ] Load admin page and verify upload card appears below Image Statistics
- [ ] Drop zone has dashed border and displays instructional text
- [ ] Hovering over drop zone changes border color to blue
- [ ] Clicking drop zone opens file picker dialog
- [ ] File picker filters to show only JPG/JPEG/PNG files
- [ ] Upload button shows as disabled initially
- [ ] Progress bar is not visible on page load
