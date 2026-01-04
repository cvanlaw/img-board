---
id: 6
title: Critical Accessibility
depends_on: [5]
status: pending
---

# Task 6: Critical Accessibility

## Description

Implement high-impact accessibility improvements to make the admin interface usable with screen readers and keyboard navigation. This addresses WCAG compliance for dynamic content updates and visual feedback.

## Deliverables

- `public/admin.html` - Semantic structure, ARIA attributes, validation hints
- `public/css/admin.css` - Focus indicators, validation states

## Acceptance Criteria

- [ ] Add `lang="en"` attribute to `<html>` element
- [ ] Convert card `<div>` elements to `<section>` with `aria-labelledby` linking to headings
- [ ] Add `aria-live="polite"` to statistics container for screen reader announcements
- [ ] Add `role="status"` and `aria-live="polite"` to message elements
- [ ] Add `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` to progress bars
- [ ] Add visible focus indicators (outline) for inputs and buttons
- [ ] Add non-color status indicators (✓ for success, ⚠ for error) to messages
- [ ] Add `aria-describedby` linking inputs to validation hint text

## Implementation Details

### Document Structure

```html
<html lang="en">
...
<section class="card" aria-labelledby="stats-heading">
  <h2 id="stats-heading">Image Statistics</h2>
  ...
</section>
```

### ARIA Live Regions

```html
<!-- Statistics updates -->
<div id="stats-container" aria-live="polite" aria-atomic="true">
  <p><span id="raw-count">0</span> raw images</p>
  <p><span id="processed-count">0</span> processed images</p>
</div>

<!-- Status messages -->
<p id="slideshow-message" role="status" aria-live="polite"></p>

<!-- Progress updates -->
<div id="progress-container" role="progressbar"
     aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"
     aria-label="Reprocessing progress">
```

### Focus Indicators

```css
input:focus,
button:focus {
  outline: 2px solid #0056b3;
  outline-offset: 2px;
}

button:focus-visible {
  outline: 3px solid #0056b3;
}
```

### Non-Color Indicators

```css
.message.success::before {
  content: "✓ ";
}

.message.error::before {
  content: "⚠ ";
}
```

### Input Validation

```html
<label for="interval">Interval (minutes)</label>
<input type="number" id="interval" aria-describedby="interval-hint">
<small id="interval-hint">Minimum: 0.1 minutes</small>
```

```css
input:invalid {
  border-color: #dc3545;
  background-color: #fff5f5;
}

input:invalid:focus {
  outline-color: #dc3545;
}
```

## Testing Checklist

- [ ] Screen reader announces stats updates when values change
- [ ] Screen reader announces success/error messages
- [ ] Screen reader announces progress percentage during reprocessing
- [ ] Tab key navigates through all interactive elements in logical order
- [ ] Focus ring visible on all focused inputs and buttons
- [ ] Success messages show checkmark icon regardless of color perception
- [ ] Error messages show warning icon regardless of color perception
- [ ] Validation hints are read when input is focused
