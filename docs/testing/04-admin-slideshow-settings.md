# 04 - Admin Slideshow Settings

Tests slideshow interval configuration via admin interface.

## Prerequisites

- Application running
- Admin page accessible (`/admin`)
- Slideshow open in separate window for verification

---

## Test 4.1: Load Current Settings

**Steps:**
1. Navigate to `http://localhost:3000/admin`
2. Observe Slideshow Settings card

**Expected:**
- Current interval value displayed in input field
- Value matches config.json slideshowInterval
- Input field is editable

---

## Test 4.2: Update Interval - Valid Value

**Steps:**
1. Open admin page
2. Change interval to 8000 (8 seconds)
3. Click "Save Slideshow Settings"

**Expected:**
- Success message displayed
- No errors in console
- Setting persisted (reload page to verify)

---

## Test 4.3: Immediate Effect on Slideshow

**Steps:**
1. Open slideshow in one window
2. Open admin in another window
3. Change interval from 5000 to 10000
4. Click Save
5. Observe slideshow transition timing

**Expected:**
- Slideshow now waits 10 seconds between transitions
- No page refresh required
- Change takes effect on next transition

---

## Test 4.4: Validation - Below Minimum

**Steps:**
1. Open admin page
2. Enter interval value of 500 (below 1000ms minimum)
3. Click "Save Slideshow Settings"

**Expected:**
- Error message displayed
- Setting NOT saved
- Original value preserved

---

## Test 4.5: Validation - Non-Numeric Input

**Steps:**
1. Open admin page
2. Enter "abc" in interval field
3. Click "Save Slideshow Settings"

**Expected:**
- Error or validation message
- Setting NOT saved
- Form prevents invalid submission

---

## Test 4.6: Multiple Concurrent Viewers

**Steps:**
1. Open slideshow in 3 different browser windows
2. Open admin in another window
3. Change interval to 3000
4. Click Save
5. Observe all slideshow windows

**Expected:**
- All 3 slideshows update to new interval
- All receive SSE config-update event
- Synchronized behavior across clients

---

## Test 4.7: Persistence Across Restart

**Steps:**
1. Set interval to 7000 via admin
2. Restart application (docker compose restart)
3. Open admin page
4. Check interval value

**Expected:**
- Interval shows 7000
- Setting persisted in config.json
- Application starts with saved value

---

## Notes

- Minimum interval: 1000ms (1 second)
- Default interval: 5000ms (5 seconds)
- Changes broadcast via SSE `config-update` event
- Config.json updated via deep merge
