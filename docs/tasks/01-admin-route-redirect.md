---
id: 1
title: Admin Route Redirect
depends_on: []
status: pending
---

# Task 1: Admin Route Redirect

## Description

Add a route that redirects `/admin` to `/admin.html` so users can access the admin interface with a cleaner URL. The existing IP filter middleware will continue to protect the endpoint.

## Deliverables

- `server.js` - Add redirect route after IP filter middleware

## Acceptance Criteria

- [ ] GET `/admin` redirects to `/admin.html` with 302 status
- [ ] IP filter middleware blocks unauthorized IPs before redirect executes
- [ ] Direct access to `/admin.html` continues to work unchanged
- [ ] Route placed after `adminIPFilter` middleware declarations

## Implementation Details

### Route Addition

Insert after line 84 in `server.js` (after IP filter middleware):

```javascript
app.use('/admin', adminIPFilter);
app.use('/api/admin', adminIPFilter);

// Redirect /admin to /admin.html for user convenience
app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});
```

## Testing Checklist

- [ ] Access `/admin` from allowed IP → redirects to `/admin.html`
- [ ] Access `/admin` from blocked IP → returns 403 (no redirect)
- [ ] Access `/admin.html` directly → loads admin interface
