---
id: 5
title: Extract Admin Styles
depends_on: []
status: pending
---

# Task 5: Extract Admin Styles

## Description

Extract inline CSS from admin.html into a dedicated stylesheet file. This establishes a proper separation of concerns and creates the foundation for all subsequent CSS improvements in the admin interface.

## Deliverables

- `public/css/admin.css` - New file containing all admin interface styles
- `public/admin.html` - Updated to link external stylesheet, inline styles removed

## Acceptance Criteria

- [ ] Create `public/css/admin.css` containing all styles from admin.html `<style>` block
- [ ] Add `<link rel="stylesheet" href="/css/admin.css">` to admin.html `<head>`
- [ ] Remove inline `<style>` block from admin.html
- [ ] Admin interface renders identically before and after change
- [ ] No broken CSS references or missing styles

## Implementation Details

### Extract Current Styles

Move the entire contents of the `<style>` block (approximately 50 lines) from admin.html to the new file.

Current inline styles include:
- Body and container layout
- Card styling
- Button styling
- Progress bar styling
- Message styling (success/error)
- Form element styling

### Link Stylesheet

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Image Board Admin</title>
  <link rel="stylesheet" href="/css/admin.css">
</head>
```

## Testing Checklist

- [ ] Load admin page and verify all styles render correctly
- [ ] Compare visual appearance to pre-change screenshot
- [ ] Verify card borders, spacing, and shadows
- [ ] Verify button colors and hover states
- [ ] Verify progress bar appears correctly during reprocessing
- [ ] Verify success/error message colors
- [ ] Check browser dev tools for 404 errors on CSS file
