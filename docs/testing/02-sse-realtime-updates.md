# 02 - Server-Sent Events Real-Time Updates

Tests real-time image synchronization without page refresh.

## Prerequisites

- Application running
- Slideshow open in browser
- Terminal access to image directories
- Developer tools open → Network tab

---

## Test 2.1: SSE Connection Established

**Steps:**
1. Open slideshow page
2. Open developer tools → Network tab
3. Filter by "EventStream" or look for `/api/events`

**Expected:**
- SSE connection shows as pending/open
- Connection type shows as `text/event-stream`
- Initial `connected` event received

---

## Test 2.2: Image Addition Detection

**Steps:**
1. Open slideshow page
2. Note current image count
3. Copy a new WebP image to processed directory:
   ```bash
   cp test-image.webp /mnt/photos/processed/
   ```
4. Wait for reshuffle interval (or check immediate if configured)

**Expected:**
- New image appears in slideshow rotation
- No page refresh required
- Console may show "add" event

---

## Test 2.3: Image Removal Detection

**Steps:**
1. Open slideshow with multiple images
2. Note a specific image filename
3. Delete that image from processed directory:
   ```bash
   rm /mnt/photos/processed/test-image.webp
   ```
4. Wait for reshuffle interval

**Expected:**
- Deleted image removed from rotation
- Slideshow continues with remaining images
- No error if currently-displayed image is deleted

---

## Test 2.4: Reshuffle Event

**Steps:**
1. Configure short reshuffle interval in config.json (e.g., 30000ms)
2. Open slideshow and observe image order
3. Wait for reshuffle interval to pass
4. Observe if order changes (if randomOrder: true)

**Expected:**
- After interval, reshuffle event triggers
- Image order may change (if random enabled)
- All images still present

---

## Test 2.5: Multiple Clients Sync

**Steps:**
1. Open slideshow in two browser windows
2. Add new image to processed directory
3. Wait for update
4. Compare both windows

**Expected:**
- Both windows receive the same update
- New image appears in both slideshows
- No desync between clients

---

## Test 2.6: Reconnection After Disconnect

**Steps:**
1. Open slideshow page
2. Stop the server temporarily (Ctrl+C or docker compose stop)
3. Wait 10 seconds
4. Restart server
5. Observe browser behavior

**Expected:**
- SSE reconnects automatically after server restart
- Slideshow resumes normal operation
- May see brief connection error in console

---

## Notes

- SSE endpoint: `/api/events`
- Events: `add`, `remove`, `reshuffle`, `config-update`, `connected`
- Reshuffle batches changes to avoid interrupting viewing
- Default reshuffle interval: 3,600,000ms (1 hour)
