---
id: 9
title: UX Polish
depends_on: [5, 7]
status: pending
---

# Task 9: UX Polish

## Description

Add polish features to enhance the overall user experience including toast notifications for feedback, estimated time remaining during reprocessing, contextual help tooltips, and unsaved changes warnings.

## Deliverables

- `public/admin.html` - Toast container, tooltip markup
- `public/css/admin.css` - Toast styling, tooltip styling, animations
- `public/js/admin.js` - Toast functions, ETA calculation, unsaved changes tracking

## Acceptance Criteria

- [ ] Toast notifications appear for success/error feedback
- [ ] Toasts auto-dismiss after 4 seconds with slide-out animation
- [ ] Toasts stack vertically when multiple appear
- [ ] Reprocessing progress shows estimated time remaining
- [ ] Help icons (?) next to settings show tooltips on hover
- [ ] Unsaved changes trigger browser warning on page leave
- [ ] Unsaved changes flag clears after successful save

## Implementation Details

### Toast Notifications

```html
<div id="toast-container" aria-live="polite"></div>
```

```javascript
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : '⚠'}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
```

```css
#toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  animation: slideIn 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.toast-success {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.toast-error {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.toast-exit {
  animation: slideOut 0.3s ease forwards;
}

@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}
```

### ETA Calculation

```javascript
let processingStartTime;

function updateProgressWithETA(status) {
  const { completed, total } = status;
  const remaining = total - completed;

  if (completed > 0) {
    const elapsed = Date.now() - processingStartTime;
    const rate = completed / (elapsed / 1000); // images per second
    const etaSeconds = remaining / rate;

    document.getElementById('eta').textContent = formatTime(etaSeconds);
  }
}

function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function startReprocessingMonitor() {
  processingStartTime = Date.now();
  // ... existing polling code
}
```

### Contextual Help

```html
<label for="interval">
  Slideshow Interval
  <button type="button" class="help-btn" aria-label="Help for interval setting"
          data-tooltip="Time each image displays before transitioning to the next">
    ?
  </button>
</label>
```

```css
.help-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid #6c757d;
  background: transparent;
  font-size: 0.75rem;
  color: #6c757d;
  cursor: help;
  margin-left: 0.25rem;
  position: relative;
}

.help-btn:hover::after,
.help-btn:focus::after {
  content: attr(data-tooltip);
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #212529;
  color: white;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  white-space: nowrap;
  z-index: 10;
  margin-top: 0.25rem;
}
```

### Unsaved Changes Warning

```javascript
let hasUnsavedChanges = false;

document.querySelectorAll('input').forEach(input => {
  input.addEventListener('change', () => {
    hasUnsavedChanges = true;
  });
});

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Clear flag after successful save
function onSaveSuccess() {
  hasUnsavedChanges = false;
}
```

## Testing Checklist

- [ ] Save settings - success toast appears in top-right
- [ ] Trigger error - error toast appears with warning icon
- [ ] Toast slides in from right, disappears after 4 seconds
- [ ] Multiple toasts stack vertically without overlap
- [ ] Start reprocessing - ETA appears and updates
- [ ] ETA shows reasonable estimate based on processing rate
- [ ] Hover over help icon - tooltip shows description
- [ ] Tab to help icon - tooltip shows on focus
- [ ] Change input value, then close tab - browser warns
- [ ] Save successfully, then close tab - no warning
- [ ] Reload page with unsaved changes - browser warns
