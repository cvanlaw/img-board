# Task 04: Slideshow Frontend

## Description
Create the frontend slideshow using Splide.js with auto-rotation, lazy loading, and full-screen display optimized for DAKboard embedding.

## Dependencies
- Task 03: Express Server Core (to serve files and API)

## Deliverables
- `public/index.html` - Main slideshow page
- `public/js/slideshow.js` - Splide initialization and image loading
- `public/css/style.css` - Full-screen slideshow styling

## Acceptance Criteria
- [ ] Fetches image list from `/api/images` on page load
- [ ] Displays images in Splide carousel with fade transition
- [ ] Auto-rotates at configured interval
- [ ] Implements lazy loading for large image sets (200-1000 images)
- [ ] Full-screen layout (no margins, scrollbars, or UI chrome)
- [ ] Images scale with `object-fit: contain` to preserve aspect ratio
- [ ] Works in iframe context (for DAKboard)
- [ ] No navigation arrows or pagination dots (clean display)

## Implementation Details

### index.html Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Image Slideshow</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@splidejs/splide@4/dist/css/splide-core.min.css">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div id="slideshow" class="splide">
    <div class="splide__track">
      <ul class="splide__list">
        <!-- Slides inserted dynamically -->
      </ul>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@splidejs/splide@4/dist/js/splide.min.js"></script>
  <script src="/js/slideshow.js"></script>
</body>
</html>
```

### style.css
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

#slideshow {
  width: 100%;
  height: 100%;
}

.splide__slide {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.splide__slide img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
```

### slideshow.js
```javascript
let splide;
let config = { slideshowInterval: 5000 };

async function init() {
  // Fetch config (interval)
  try {
    const configRes = await fetch('/api/admin/config');
    if (configRes.ok) {
      config = await configRes.json();
    }
  } catch (e) {
    // Use defaults
  }

  // Fetch images
  const res = await fetch('/api/images');
  const images = await res.json();

  // Build slides
  const list = document.querySelector('.splide__list');
  images.forEach(filename => {
    const li = document.createElement('li');
    li.className = 'splide__slide';
    li.dataset.filename = filename;
    li.innerHTML = `<img src="/images/${filename}" loading="lazy" alt="">`;
    list.appendChild(li);
  });

  // Initialize Splide
  splide = new Splide('#slideshow', {
    type: 'fade',
    autoplay: true,
    interval: config.slideshowInterval,
    pauseOnHover: false,
    pauseOnFocus: false,
    rewind: true,
    lazyLoad: 'nearby',
    preloadPages: 1,
    keyboard: true,
    arrows: false,
    pagination: false,
  });

  splide.mount();
}

init();
```

### Lazy Loading Strategy
- `lazyLoad: 'nearby'` - Only loads adjacent slides
- `preloadPages: 1` - Minimal preloading
- `loading="lazy"` on img elements - Browser-level lazy loading
- Critical for 200-1000 image sets to prevent memory issues

## Testing Checklist
- [ ] Page loads and displays first image
- [ ] Slideshow auto-rotates through images
- [ ] Fade transition between slides is smooth
- [ ] Images centered and scaled correctly
- [ ] No scrollbars visible
- [ ] Works in Chrome/Firefox/Safari
- [ ] Works when embedded in iframe
- [ ] Large image set (100+ images) loads without performance issues
- [ ] Memory usage remains stable during long viewing sessions
