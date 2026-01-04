# 01 - Slideshow Basic Functionality

Tests core slideshow display and navigation behavior.

## Prerequisites

- Application running
- At least 3 images in processed directory
- Browser with developer tools open

---

## Test 1.1: Initial Page Load

**Steps:**
1. Navigate to `http://localhost:3000/`
2. Observe page load behavior

**Expected:**
- First image displays immediately
- No layout shift or flash of unstyled content
- Console shows no errors

---

## Test 1.2: Automatic Slide Advancement

**Steps:**
1. Open slideshow page
2. Note which image is displayed
3. Wait for configured interval (default 5 seconds)
4. Observe transition

**Expected:**
- Image transitions to next after interval
- Fade transition is smooth (not jarring cut)
- Continues cycling through all images

---

## Test 1.3: Loop/Rewind Behavior

**Steps:**
1. Open slideshow with known image count (e.g., 3 images)
2. Wait for full cycle through all images
3. Observe what happens after last image

**Expected:**
- After last image, loops back to first image
- Seamless transition, no pause or error

---

## Test 1.4: Keyboard Navigation

**Steps:**
1. Open slideshow page
2. Click on page to ensure focus
3. Press right arrow key
4. Press left arrow key

**Expected:**
- Right arrow advances to next image
- Left arrow goes to previous image
- Manual navigation doesn't break auto-advance

---

## Test 1.5: Empty State

**Steps:**
1. Remove all images from processed directory
2. Navigate to slideshow page
3. Observe display

**Expected:**
- No JavaScript errors in console
- Page loads without crashing
- Empty state is handled gracefully (blank or placeholder)

---

## Test 1.6: Lazy Loading

**Steps:**
1. Open browser developer tools → Network tab
2. Navigate to slideshow with many images (10+)
3. Observe image loading pattern

**Expected:**
- Not all images load immediately
- Adjacent images (1-2 ahead) preload before display
- Network requests spread out over time

---

## Notes

- Default interval is 5000ms (5 seconds)
- Splide library handles transitions
- Images served from `/images/{filename}` endpoint
