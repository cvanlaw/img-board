---
id: 16
title: Image Gallery UI
depends_on: [11]
status: pending
---

# Task 16: Image Gallery UI

## Description

Create the image management gallery interface in the admin panel. Add HTML structure for the gallery section, CSS for grid layout and visual states, and JavaScript for loading images, rendering thumbnails, and handling single-image actions.

## Deliverables

- `public/admin.html` - Add "Manage Images" card section
- `public/admin.html` or separate CSS - Add gallery grid styles
- `public/js/admin.js` - Add image loading, rendering, and single-item actions

## Acceptance Criteria

- [ ] Gallery card appears between "Upload Images" and "Slideshow Settings"
- [ ] Search input filters images by filename in real-time
- [ ] Filter dropdown shows: All, Visible, Excluded, Trash
- [ ] Images display in responsive grid with thumbnails
- [ ] Excluded images shown at 50% opacity with visual indicator
- [ ] Each image shows toggle exclude and delete buttons
- [ ] Pagination controls appear when image count exceeds page limit

## Implementation Details

### HTML Structure

```html
<div class="card">
  <h2>Manage Images</h2>

  <div class="image-controls">
    <input type="text" id="image-search" placeholder="Search by filename...">
    <select id="image-filter">
      <option value="all">All Images</option>
      <option value="visible">Visible Only</option>
      <option value="excluded">Excluded Only</option>
      <option value="trash">Trash</option>
    </select>
  </div>

  <div id="image-gallery" class="image-gallery"></div>

  <div id="pagination" class="pagination"></div>

  <div id="gallery-message" class="message" style="display: none;"></div>
</div>
```

### CSS Styles

```css
.image-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.image-controls input,
.image-controls select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.image-controls input {
  flex: 1;
}

.image-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  min-height: 200px;
}

.gallery-item {
  position: relative;
  aspect-ratio: 16/9;
  border: 2px solid transparent;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
}

.gallery-item.excluded {
  opacity: 0.5;
}

.gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-item .filename {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.7);
  color: white;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gallery-item .actions {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  display: flex;
  gap: 0.25rem;
}

.gallery-item .actions button {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  margin: 0;
  opacity: 0.8;
}

.gallery-item .actions button:hover {
  opacity: 1;
}

.btn-icon {
  background: rgba(0,0,0,0.6);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-danger {
  background: #dc3545;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.pagination button.active {
  background: #0056b3;
}

.empty-message {
  grid-column: 1 / -1;
  text-align: center;
  color: #666;
  padding: 2rem;
}
```

### JavaScript State and Core Functions

```javascript
// Image management state
let allImages = [];
let currentPage = 1;
let currentFilter = 'all';
let searchQuery = '';
const imagesPerPage = 24;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // ... existing init code ...
  loadImages();

  document.getElementById('image-search').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    currentPage = 1;
    renderGallery();
  });

  document.getElementById('image-filter').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    currentPage = 1;
    loadImages();
  });
});

async function loadImages() {
  try {
    const res = await fetch(`/api/admin/images?filter=${currentFilter}&limit=1000`);
    const data = await res.json();
    allImages = data.images;
    renderGallery();
  } catch (err) {
    showMessage('gallery-message', 'Failed to load images', 'error');
  }
}

function renderGallery() {
  const gallery = document.getElementById('image-gallery');

  // Apply search filter
  let filtered = allImages;
  if (searchQuery) {
    filtered = allImages.filter(img =>
      img.filename.toLowerCase().includes(searchQuery)
    );
  }

  if (filtered.length === 0) {
    gallery.innerHTML = '<div class="empty-message">No images found</div>';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  // Paginate
  const start = (currentPage - 1) * imagesPerPage;
  const pageImages = filtered.slice(start, start + imagesPerPage);

  gallery.innerHTML = pageImages.map(img => `
    <div class="gallery-item ${img.excluded ? 'excluded' : ''}" data-filename="${img.filename}">
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
}

function renderPagination(total) {
  const pages = Math.ceil(total / imagesPerPage);
  const pagination = document.getElementById('pagination');

  if (pages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }
  pagination.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  renderGallery();
}

async function toggleExclusion(filename) {
  const img = allImages.find(i => i.filename === filename);
  if (!img) return;

  try {
    const res = await fetch(`/api/admin/images/${filename}/exclude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excluded: !img.excluded })
    });

    if (res.ok) {
      img.excluded = !img.excluded;
      renderGallery();
    }
  } catch (err) {
    showMessage('gallery-message', 'Failed to toggle exclusion', 'error');
  }
}

async function deleteImage(filename) {
  if (!confirm(`Delete "${filename}"? It will be moved to trash.`)) return;

  try {
    const res = await fetch(`/api/admin/images/${filename}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      allImages = allImages.filter(i => i.filename !== filename);
      renderGallery();
      showMessage('gallery-message', 'Image moved to trash', 'success');
    }
  } catch (err) {
    showMessage('gallery-message', 'Failed to delete image', 'error');
  }
}
```

## Testing Checklist

- [ ] Gallery loads and displays all images as thumbnails
- [ ] Search filters images by filename as you type
- [ ] Filter dropdown changes displayed images correctly
- [ ] Excluded images appear dimmed
- [ ] Toggle exclude button updates image state
- [ ] Delete button shows confirmation and moves to trash
- [ ] Pagination appears for large image collections
- [ ] Empty state message shown when no images match filter
