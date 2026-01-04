# 06 - Image Preprocessing Workflow

Tests automatic image detection, conversion, and processing.

## Prerequisites

- Application running (both server and preprocessor)
- Access to raw image directory
- Access to processed image directory
- Sample test images: JPG, PNG, and unsupported format (e.g., BMP)

---

## Test 6.1: JPG to WebP Conversion

**Steps:**
1. Copy a JPG file to raw directory:
   ```bash
   cp test-photo.jpg /mnt/photos/raw/
   ```
2. Wait 3-5 seconds for processing
3. Check processed directory:
   ```bash
   ls /mnt/photos/processed/
   ```

**Expected:**
- New `test-photo.webp` file appears in processed directory
- Original JPG handled per config (kept, archived, or deleted)
- WebP file size smaller than original JPG

---

## Test 6.2: PNG to WebP Conversion

**Steps:**
1. Copy a PNG file to raw directory:
   ```bash
   cp test-image.png /mnt/photos/raw/
   ```
2. Wait 3-5 seconds
3. Check processed directory

**Expected:**
- New `test-image.webp` file appears
- PNG transparency may be flattened (verify visually)

---

## Test 6.3: JPEG Extension (Alternate)

**Steps:**
1. Copy a file with `.jpeg` extension:
   ```bash
   cp photo.jpeg /mnt/photos/raw/
   ```
2. Wait for processing
3. Verify output

**Expected:**
- Processed same as `.jpg` files
- Output file is `.webp`

---

## Test 6.4: Unsupported Format Ignored

**Steps:**
1. Copy a BMP or TXT file to raw directory:
   ```bash
   cp test.bmp /mnt/photos/raw/
   ```
2. Wait 5 seconds
3. Check processed directory
4. Check application logs

**Expected:**
- No corresponding file in processed directory
- Warning logged about unsupported format
- No crash or error

---

## Test 6.5: Aspect Ratio Preservation

**Steps:**
1. Use an image with non-16:9 ratio (e.g., 4:3 or 1:1)
2. Copy to raw directory
3. Wait for processing
4. Check output dimensions:
   ```bash
   identify /mnt/photos/processed/output.webp
   # or use any image viewer to check properties
   ```

**Expected:**
- Aspect ratio preserved (not stretched/squashed)
- Fits inside target dimensions (1920x1080 default)
- May have letterboxing space if aspect differs

---

## Test 6.6: No Enlargement of Small Images

**Steps:**
1. Use a small image (e.g., 640x480)
2. Copy to raw directory
3. Wait for processing
4. Check output dimensions

**Expected:**
- Output NOT enlarged beyond original size
- Image stays at 640x480 (or smaller)
- `withoutEnlargement: true` honored

---

## Test 6.7: Original File Handling - Keep

**Steps:**
1. Set config.json:
   ```json
   "keepOriginals": true,
   "archivePath": null
   ```
2. Process a new image
3. Check raw directory

**Expected:**
- Original file remains in raw directory
- Not deleted after processing

---

## Test 6.8: Original File Handling - Archive

**Steps:**
1. Set config.json:
   ```json
   "keepOriginals": true,
   "archivePath": "/mnt/photos/archive"
   ```
2. Create archive directory if needed
3. Process a new image
4. Check archive directory

**Expected:**
- Original moved to archive directory
- Not in raw directory anymore
- Processed WebP in processed directory

---

## Test 6.9: Original File Handling - Delete

**Steps:**
1. Set config.json:
   ```json
   "keepOriginals": false
   ```
2. Process a new image
3. Check raw directory

**Expected:**
- Original file deleted after processing
- Only WebP exists in processed directory

---

## Test 6.10: Batch Processing on Startup

**Steps:**
1. Stop application
2. Add 5 new images to raw directory
3. Start application
4. Watch logs and processed directory

**Expected:**
- All 5 images processed on startup
- `ignoreInitial: false` catches existing files
- Processed directory has 5 new WebP files

---

## Notes

- Supported input: `.jpg`, `.jpeg`, `.png`
- Output format: WebP always
- Chokidar uses polling (required for NAS)
- 2-second stability wait before processing (awaitWriteFinish)
