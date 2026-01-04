# 11 - End-to-End Workflow

Complete user journey from image upload through display and configuration.

## Prerequisites

- Application fully deployed (Docker or local)
- Empty or minimal initial state
- Sample images ready (JPG, PNG)
- Two browser windows

---

## Workflow A: First-Time Setup

### Step 1: Verify Initial State

**Actions:**
1. Open slideshow at `http://localhost:3000/`
2. Open admin at `http://localhost:3000/admin`

**Expected:**
- Slideshow may be empty or show existing images
- Admin loads and shows current stats
- No errors in console

### Step 2: Check Initial Configuration

**Actions:**
1. In admin, verify settings:
   - Slideshow interval (default 5000)
   - Preprocessing dimensions (default 1920x1080)
2. Note raw/processed image counts

**Expected:**
- Settings display correctly
- Stats show current file counts

---

## Workflow B: Add New Image

### Step 3: Add Image to Raw Directory

**Actions:**
1. Copy a JPG file to raw directory:
   ```bash
   cp vacation-photo.jpg /mnt/photos/raw/
   ```
2. Watch application logs or admin stats

**Expected:**
- Preprocessor detects new file
- Logs show processing activity

### Step 4: Verify WebP Conversion

**Actions:**
1. Check processed directory:
   ```bash
   ls /mnt/photos/processed/
   ```
2. Verify file is WebP format

**Expected:**
- `vacation-photo.webp` exists
- File size smaller than original JPG

### Step 5: Verify Image Appears in Slideshow

**Actions:**
1. Return to slideshow window
2. Wait for reshuffle interval OR check image list

**Expected:**
- New image appears in slideshow rotation
- No page refresh needed
- Image displays correctly

---

## Workflow C: Modify Configuration

### Step 6: Change Slideshow Interval

**Actions:**
1. In admin, change interval to 3000 (3 seconds)
2. Click "Save Slideshow Settings"
3. Switch to slideshow window

**Expected:**
- Success message in admin
- Slideshow now advances every 3 seconds
- Change immediate, no restart

### Step 7: Change Image Dimensions

**Actions:**
1. In admin, change dimensions to 1280x720
2. Click "Save & Reprocess All Images"
3. Confirm the dialog
4. Watch progress bar

**Expected:**
- Progress bar appears
- All images reprocessed
- Completes successfully

### Step 8: Verify Reprocessed Images

**Actions:**
1. Check a processed image dimensions:
   ```bash
   identify /mnt/photos/processed/vacation-photo.webp
   ```

**Expected:**
- Image now fits within 1280x720
- Aspect ratio preserved

---

## Workflow D: Multiple Images

### Step 9: Batch Add Images

**Actions:**
1. Copy multiple images at once:
   ```bash
   cp photo1.jpg photo2.png photo3.jpg /mnt/photos/raw/
   ```
2. Watch processing

**Expected:**
- All images processed sequentially
- All appear as WebP in processed directory
- Stats update in admin

### Step 10: Verify All in Slideshow

**Actions:**
1. Check slideshow displays all images
2. Count images or wait for full rotation

**Expected:**
- All new images in rotation
- Total matches processed count

---

## Workflow E: Remove Image

### Step 11: Delete Processed Image

**Actions:**
1. Delete an image from processed directory:
   ```bash
   rm /mnt/photos/processed/photo2.webp
   ```
2. Watch slideshow

**Expected:**
- Image removed from rotation
- No error if it was currently displayed
- Slideshow continues with remaining images

---

## Workflow F: Configuration via File

### Step 12: Edit config.json Directly

**Actions:**
1. Edit config.json, set `slideshowInterval: 8000`
2. Save file
3. Observe slideshow

**Expected:**
- Config hot-reloaded
- Slideshow interval updates to 8 seconds
- No restart required

---

## Workflow G: Full Cycle Verification

### Step 13: Stop and Restart Application

**Actions:**
1. Stop application:
   ```bash
   docker compose down
   ```
2. Restart:
   ```bash
   docker compose up -d
   ```
3. Open slideshow and admin

**Expected:**
- All settings preserved
- All images still present
- Application resumes normally

### Step 14: Final Verification

**Actions:**
1. Add one more image to raw directory
2. Verify it appears in slideshow
3. Check admin stats reflect correct counts

**Expected:**
- Complete workflow still functions
- New images detected
- Real-time updates working

---

## Success Criteria

All workflows complete without:
- Application crashes
- Lost images
- Broken real-time updates
- Persistent errors in logs

Application is production-ready when all end-to-end tests pass.
