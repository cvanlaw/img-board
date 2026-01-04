# 08 - Batch Reprocessing Workflow

Tests manual reprocessing trigger and progress monitoring.

## Prerequisites

- Application running
- Multiple raw images available (10+ recommended)
- Admin page accessible
- Access to view file system for verification

---

## Test 8.1: Reprocess Now Button

**Steps:**
1. Navigate to admin page
2. Click "Reprocess Now" button
3. Confirm the dialog

**Expected:**
- Confirmation dialog appears
- After confirm, reprocessing starts
- Progress bar appears in Preprocessing Settings card

---

## Test 8.2: Progress Bar Updates

**Steps:**
1. Ensure 10+ raw images exist
2. Trigger reprocessing
3. Watch progress bar closely

**Expected:**
- Bar starts at 0%
- Fills progressively as images complete
- Text shows "Processing: X/Y" (e.g., "Processing: 5/12")

---

## Test 8.3: Progress Polling

**Steps:**
1. Open browser developer tools → Network tab
2. Trigger reprocessing
3. Watch network requests

**Expected:**
- Requests to `/api/admin/reprocess-status` every ~1 second
- Returns JSON with `completed`, `total`, `active` fields
- Polling stops when `active: false`

---

## Test 8.4: Trigger File Creation

**Steps:**
1. Before triggering reprocess, check for trigger file:
   ```bash
   ls -la .reprocess-trigger
   ```
2. Trigger reprocessing via admin
3. Check again quickly

**Expected:**
- `.reprocess-trigger` file created when admin triggers reprocess
- File consumed by preprocessor (may disappear quickly)

---

## Test 8.5: Progress File

**Steps:**
1. Trigger reprocessing with many images
2. During processing, check:
   ```bash
   cat .reprocess-progress.json
   ```

**Expected:**
- JSON file with `completed`, `total`, `failed`, `timestamp`
- Values update as processing continues
- Cleaned up after completion

---

## Test 8.6: Completion Cleanup

**Steps:**
1. Trigger reprocessing
2. Wait for completion
3. Check for leftover files:
   ```bash
   ls -la .reprocess-*
   ```

**Expected:**
- Both `.reprocess-trigger` and `.reprocess-progress.json` removed
- Clean state after processing complete

---

## Test 8.7: Partial Failure Handling

**Steps:**
1. Add a corrupted file to raw directory (e.g., empty .jpg)
2. Add several valid images
3. Trigger reprocessing
4. Watch progress

**Expected:**
- Processing continues despite single failure
- Failed count incremented
- Valid images still processed
- Final status shows failed count

---

## Test 8.8: UI Remains Responsive

**Steps:**
1. Trigger reprocessing with many images
2. While processing, try to navigate admin UI
3. Check stats, change other settings

**Expected:**
- UI remains responsive during processing
- Can view stats updates
- Processing is non-blocking

---

## Test 8.9: Double Trigger Prevention

**Steps:**
1. Trigger reprocessing
2. While still processing, click "Reprocess Now" again

**Expected:**
- Second trigger is handled gracefully
- No duplicate processing
- Either queued or ignored with message

---

## Test 8.10: Stats Update on Completion

**Steps:**
1. Note raw and processed image counts
2. Add new raw images
3. Trigger reprocessing
4. Wait for completion
5. Check stats card

**Expected:**
- Processed count increases
- Stats refresh after completion
- New images reflected in count

---

## Notes

- Progress file polled every 1 second by admin UI
- 5-second delay before progress file cleanup (allows final poll)
- Reprocessing re-reads config for latest settings
- All raw images reprocessed, not just new ones
