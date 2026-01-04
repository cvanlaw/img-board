# 07 - Configuration Hot Reload

Tests live configuration changes without restart.

## Prerequisites

- Application running
- Access to edit config.json
- Slideshow open in browser
- Terminal for log monitoring

---

## Test 7.1: Edit config.json Directly

**Steps:**
1. Open config.json in editor
2. Change `slideshowInterval` from 5000 to 12000
3. Save the file
4. Watch application logs

**Expected:**
- Log message indicates config reload
- Both processes (server + preprocessor) reload
- No restart required

---

## Test 7.2: Slideshow Interval via Config

**Steps:**
1. Open slideshow in browser
2. Edit config.json, set `slideshowInterval: 3000`
3. Save file
4. Observe slideshow timing

**Expected:**
- Slideshow updates to 3-second interval
- SSE `config-update` event sent
- Immediate effect on next transition

---

## Test 7.3: Preprocessing Settings via Config

**Steps:**
1. Edit config.json:
   ```json
   "preprocessing": {
     "targetWidth": 1280,
     "targetHeight": 720
   }
   ```
2. Save file
3. Add new image to raw directory
4. Check processed image dimensions

**Expected:**
- New image processed at 1280x720
- Previously processed images unchanged
- Setting applied to new processing only

---

## Test 7.4: Invalid JSON Handling

**Steps:**
1. Edit config.json with syntax error:
   ```json
   {
     "slideshowInterval": 5000,
     // missing comma, extra bracket
   }
   ```
2. Save file
3. Watch application logs
4. Check if application still works

**Expected:**
- Error logged about invalid JSON
- Application continues with previous valid config
- No crash

---

## Test 7.5: Config Watcher Stability Threshold

**Steps:**
1. Make rapid successive edits to config.json (save 3 times in 1 second)
2. Watch logs

**Expected:**
- Only processes after write stabilizes (500ms threshold)
- Doesn't reload multiple times for quick edits

---

## Test 7.6: Random Order Toggle

**Steps:**
1. Set `randomOrder: false` in config.json
2. Save and observe slideshow
3. Set `randomOrder: true`
4. Wait for reshuffle interval

**Expected:**
- With false: images in consistent order
- With true: images shuffled on reshuffle
- Takes effect on next reshuffle event

---

## Test 7.7: Image Extensions Change

**Steps:**
1. Add `.gif` to `imageExtensions` array
2. Save config
3. Add a GIF file to processed directory
4. Check if it appears in slideshow

**Expected:**
- GIF now included in image list
- New extension recognized after reload
- Displayed in slideshow (if format supported by browser)

---

## Notes

- Config watcher uses 500ms stability threshold
- Requires clearing Node.js require cache before reload
- Both server.js and preprocessor.js watch config.json
- Invalid JSON doesn't crash, falls back to previous config
