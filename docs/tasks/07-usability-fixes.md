---
id: 7
title: Usability Fixes
depends_on: []
status: pending
---

# Task 7: Usability Fixes

## Description

Implement critical usability improvements including preventing duplicate form submissions, optimizing polling behavior, and replacing blocking confirm dialogs with accessible alternatives.

## Deliverables

- `public/admin.html` - Add `<dialog>` element for confirmations
- `public/js/admin.js` - Button states, smart polling, dialog handling
- `public/css/admin.css` - Disabled button styling, dialog styling

## Acceptance Criteria

- [ ] Buttons disable during API operations with "Saving..." text
- [ ] Buttons re-enable after operation completes (success or failure)
- [ ] Disabled buttons show gray background and wait cursor
- [ ] Stats polling stops when browser tab is inactive
- [ ] Stats polling resumes immediately when tab becomes active
- [ ] Stats refresh immediately on tab return (before normal interval)
- [ ] Native `<dialog>` element replaces `window.confirm()` calls
- [ ] Confirmation dialog is keyboard accessible (Tab, Enter, Escape)

## Implementation Details

### Button States

```javascript
async function saveSlideshow() {
  const btn = document.getElementById('save-slideshow-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    // ... API call
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Slideshow Settings';
  }
}
```

```css
button:disabled {
  background-color: #6c757d;
  cursor: wait;
}
```

### Smart Polling

```javascript
let pollInterval;

function startPolling() {
  pollInterval = setInterval(updateStats, 5000);
}

function stopPolling() {
  clearInterval(pollInterval);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling();
  } else {
    updateStats(); // Immediate refresh on return
    startPolling();
  }
});
```

### Custom Confirmation Dialog

```html
<dialog id="confirm-dialog">
  <h3 id="confirm-title">Confirm Action</h3>
  <p id="confirm-message"></p>
  <div class="dialog-actions">
    <button id="confirm-cancel" class="btn-secondary">Cancel</button>
    <button id="confirm-ok" class="btn-danger">Confirm</button>
  </div>
</dialog>
```

```javascript
function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirm-dialog');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;

    const handleConfirm = () => {
      dialog.close();
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      dialog.close();
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      document.getElementById('confirm-ok').removeEventListener('click', handleConfirm);
      document.getElementById('confirm-cancel').removeEventListener('click', handleCancel);
    };

    document.getElementById('confirm-ok').addEventListener('click', handleConfirm);
    document.getElementById('confirm-cancel').addEventListener('click', handleCancel);

    dialog.showModal();
  });
}

// Usage
async function savePreprocessing() {
  const confirmed = await showConfirmDialog(
    'Confirm Reprocessing',
    'This will reprocess all images. Continue?'
  );
  if (!confirmed) return;
  // ... proceed
}
```

## Testing Checklist

- [ ] Click save button rapidly - only one request sent
- [ ] Button shows "Saving..." during API call
- [ ] Button returns to normal text after success
- [ ] Button returns to normal text after error
- [ ] Switch to another tab - verify polling stops (check network tab)
- [ ] Return to admin tab - verify immediate stats refresh
- [ ] Polling resumes at normal interval after tab return
- [ ] Confirmation dialog opens for reprocess actions
- [ ] Tab key moves focus between Cancel and Confirm buttons
- [ ] Escape key closes dialog (cancels action)
- [ ] Enter key on focused button activates it
- [ ] Dialog has visible backdrop overlay
