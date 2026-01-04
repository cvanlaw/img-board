---
id: 17
title: Bulk Actions UI
depends_on: [15, 16]
status: pending
---

# Task 17: Bulk Actions UI

## Description

Extend the image gallery with multi-select functionality and bulk action buttons. Users can select multiple images via checkboxes and perform batch exclude, include, delete, restore, or permanent delete operations.

## Deliverables

- `public/admin.html` - Add bulk action controls
- `public/js/admin.js` - Add multi-select state and bulk operation handlers

## Acceptance Criteria

- [ ] Each gallery item has a checkbox for selection
- [ ] "Select All" checkbox toggles all visible images
- [ ] Selected images show blue border highlight
- [ ] Bulk action buttons appear when images are selected
- [ ] Bulk actions show confirmation dialog before executing
- [ ] Progress/result feedback shown after bulk operations

## Implementation Details

### HTML Additions

```html
<div class="bulk-controls" id="bulk-controls" style="display: none;">
  <label>
    <input type="checkbox" id="select-all" onchange="toggleSelectAll()">
    Select All
  </label>
  <span id="selected-count">0 selected</span>
  <div class="bulk-buttons">
    <button onclick="bulkAction('exclude')">Exclude Selected</button>
    <button onclick="bulkAction('include')">Include Selected</button>
    <button class="btn-danger" onclick="bulkAction('delete')">Delete Selected</button>
  </div>
</div>

<!-- For trash view, different buttons -->
<div class="bulk-controls-trash" id="bulk-controls-trash" style="display: none;">
  <label>
    <input type="checkbox" id="select-all-trash" onchange="toggleSelectAll()">
    Select All
  </label>
  <span id="selected-count-trash">0 selected</span>
  <div class="bulk-buttons">
    <button onclick="bulkAction('restore')">Restore Selected</button>
    <button class="btn-danger" onclick="bulkAction('permanent-delete')">Permanently Delete</button>
  </div>
</div>
```

### CSS Additions

```css
.bulk-controls,
.bulk-controls-trash {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.bulk-buttons {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.gallery-item.selected {
  border-color: #007bff;
}

.gallery-item .checkbox {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  width: 20px;
  height: 20px;
  cursor: pointer;
}
```

### JavaScript Additions

```javascript
// Add to state
let selectedImages = new Set();

// Modify gallery item rendering to include checkbox
function renderGallery() {
  // ... existing filter logic ...

  gallery.innerHTML = pageImages.map(img => `
    <div class="gallery-item ${img.excluded ? 'excluded' : ''} ${selectedImages.has(img.filename) ? 'selected' : ''}"
         data-filename="${img.filename}">
      <input type="checkbox" class="checkbox"
             ${selectedImages.has(img.filename) ? 'checked' : ''}
             onchange="toggleSelection('${img.filename}')">
      <img src="/images/${img.filename}" loading="lazy" alt="${img.filename}">
      <div class="filename" title="${img.filename}">${img.filename}</div>
      <div class="actions">
        <button class="btn-icon" onclick="toggleExclusion('${img.filename}')" title="${img.excluded ? 'Include' : 'Exclude'}">
          ${img.excluded ? '👁' : '🚫'}
        </button>
        <button class="btn-icon btn-danger" onclick="deleteImage('${img.filename}')" title="Delete">
          🗑
        </button>
      </div>
    </div>
  `).join('');

  renderPagination(filtered.length);
  updateBulkControls();
}

function toggleSelection(filename) {
  if (selectedImages.has(filename)) {
    selectedImages.delete(filename);
  } else {
    selectedImages.add(filename);
  }
  renderGallery();
}

function toggleSelectAll() {
  const checkbox = document.getElementById('select-all') || document.getElementById('select-all-trash');
  const visibleFilenames = getVisibleFilenames();

  if (checkbox.checked) {
    visibleFilenames.forEach(f => selectedImages.add(f));
  } else {
    visibleFilenames.forEach(f => selectedImages.delete(f));
  }
  renderGallery();
}

function getVisibleFilenames() {
  let filtered = allImages;
  if (searchQuery) {
    filtered = allImages.filter(img =>
      img.filename.toLowerCase().includes(searchQuery)
    );
  }
  return filtered.map(img => img.filename);
}

function updateBulkControls() {
  const count = selectedImages.size;
  const isTrashView = currentFilter === 'trash';

  const bulkControls = document.getElementById('bulk-controls');
  const bulkControlsTrash = document.getElementById('bulk-controls-trash');

  if (isTrashView) {
    bulkControls.style.display = 'none';
    bulkControlsTrash.style.display = count > 0 ? 'flex' : 'none';
    document.getElementById('selected-count-trash').textContent = `${count} selected`;
  } else {
    bulkControlsTrash.style.display = 'none';
    bulkControls.style.display = count > 0 ? 'flex' : 'none';
    document.getElementById('selected-count').textContent = `${count} selected`;
  }
}

async function bulkAction(action) {
  const count = selectedImages.size;
  if (count === 0) return;

  const actionLabels = {
    'exclude': 'exclude',
    'include': 'include in slideshow',
    'delete': 'move to trash',
    'restore': 'restore from trash',
    'permanent-delete': 'PERMANENTLY DELETE'
  };

  const confirmed = confirm(
    `${actionLabels[action].toUpperCase()} ${count} image(s)?\n\n` +
    (action === 'permanent-delete' ? 'This cannot be undone!' : '')
  );

  if (!confirmed) return;

  try {
    const res = await fetch('/api/admin/images/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        filenames: Array.from(selectedImages)
      })
    });

    const result = await res.json();
    const successCount = result.results.filter(r => r.success).length;
    const failCount = result.results.filter(r => !r.success).length;

    // Clear selection
    selectedImages.clear();

    // Reload images
    await loadImages();

    // Show result
    if (failCount === 0) {
      showMessage('gallery-message', `${successCount} image(s) ${action}d successfully`, 'success');
    } else {
      showMessage('gallery-message', `${successCount} succeeded, ${failCount} failed`, 'warning');
    }
  } catch (err) {
    showMessage('gallery-message', 'Bulk operation failed', 'error');
  }
}

// Clear selection when filter changes
document.getElementById('image-filter').addEventListener('change', () => {
  selectedImages.clear();
});
```

## Testing Checklist

- [ ] Checkboxes appear on each gallery item
- [ ] Clicking checkbox toggles selection state
- [ ] Selected images show blue border
- [ ] "Select All" toggles all visible images
- [ ] Bulk controls appear only when images selected
- [ ] Bulk exclude/include updates all selected images
- [ ] Bulk delete moves all selected to trash
- [ ] Bulk restore (in trash view) restores selected images
- [ ] Bulk permanent delete removes selected from trash
- [ ] Confirmation dialogs appear for destructive actions
- [ ] Success/failure counts shown after bulk operations
