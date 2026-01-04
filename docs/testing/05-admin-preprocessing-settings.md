# 05 - Admin Preprocessing Settings

Tests image dimension and quality configuration.

## Prerequisites

- Application running
- Admin page accessible
- Raw images available for reprocessing tests
- Access to processed directory for verification

---

## Test 5.1: Load Current Dimensions

**Steps:**
1. Navigate to `http://localhost:3000/admin`
2. Observe Preprocessing Settings card

**Expected:**
- Target Width field shows current value (default 1920)
- Target Height field shows current value (default 1080)
- Fields are editable

---

## Test 5.2: View Image Statistics

**Steps:**
1. Open admin page
2. Observe Image Statistics card

**Expected:**
- Raw image count displayed
- Processed image count displayed
- Last updated timestamp shown
- Stats refresh every 5 seconds

---

## Test 5.3: Update Dimensions - Valid Values

**Steps:**
1. Open admin page
2. Change width to 1280
3. Change height to 720
4. Click "Save & Reprocess All Images"
5. Confirm the dialog

**Expected:**
- Confirmation dialog appears
- After confirm, progress bar appears
- Settings saved successfully

---

## Test 5.4: Validation - Zero or Negative

**Steps:**
1. Open admin page
2. Enter 0 for width
3. Click Save

**Expected:**
- Error message displayed
- Setting NOT saved
- Must be at least 1 pixel

---

## Test 5.5: Progress Bar During Reprocessing

**Steps:**
1. Ensure multiple raw images exist (10+)
2. Change dimensions and click "Save & Reprocess All Images"
3. Observe progress bar

**Expected:**
- Progress bar appears
- Shows "Processing: X/Y" text
- Bar fills as images complete
- Disappears after completion

---

## Test 5.6: Stats Update After Reprocessing

**Steps:**
1. Note current processed count in stats
2. Trigger reprocessing
3. Wait for completion
4. Observe stats card

**Expected:**
- Stats refresh after reprocessing completes
- Processed count may change if new raw images existed
- Timestamp updates

---

## Test 5.7: Reprocess Now (Without Settings Change)

**Steps:**
1. Open admin page
2. Don't change any settings
3. Click "Reprocess Now" button
4. Confirm the dialog

**Expected:**
- Reprocessing triggers with current settings
- Progress bar shows
- All raw images reprocessed

---

## Test 5.8: Failed Image Handling

**Steps:**
1. Add a corrupted/invalid file to raw directory (e.g., rename .txt to .jpg)
2. Trigger reprocessing
3. Observe progress

**Expected:**
- Progress continues despite failure
- Failed count shown (if any)
- Other images still processed successfully

---

## Notes

- Default dimensions: 1920x1080
- Quality setting (1-100) affects WebP compression
- Reprocessing is non-blocking (UI remains responsive)
- Progress file: `.reprocess-progress.json`
