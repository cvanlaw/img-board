# Admin Route Redirect Design

## Problem

Users must access the admin interface via `/admin.html`. The more intuitive `/admin` path returns a 404 since Express static middleware only serves files with their exact names.

## Solution

Add an Express route that redirects `/admin` to `/admin.html`.

## Implementation

Add a single route in `server.js` after the static middleware and IP filter:

```javascript
app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});
```

### Placement

Insert after line 84 (after the IP filter middleware declarations):

```javascript
app.use('/admin', adminIPFilter);
app.use('/api/admin', adminIPFilter);

// Redirect /admin to /admin.html for user convenience
app.get('/admin', (req, res) => {
  res.redirect('/admin.html');
});
```

### Why This Works

1. **IP filter still applies** - The `app.use('/admin', adminIPFilter)` middleware runs first on any `/admin` request, blocking unauthorized IPs before the redirect executes
2. **Redirect type** - Uses 302 (temporary) redirect by default, which is appropriate since the canonical URL is `/admin.html`
3. **No trailing slash issues** - Express handles `/admin` and `/admin/` identically with this pattern

## Testing

1. Access `/admin` from allowed IP → redirects to `/admin.html`
2. Access `/admin` from blocked IP → returns 403 (no redirect occurs)
3. Access `/admin.html` directly → still works unchanged

## Files Modified

- `server.js` - Add one route (3 lines)
