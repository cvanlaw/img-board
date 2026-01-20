/* global Splide */
let splide;
let config = { slideshowInterval: 5000 };

async function init() {
  try {
    const configRes = await fetch('/api/admin/config');
    if (configRes.ok) {
      config = await configRes.json();
    }
  } catch {
    console.log('Using default config');
  }

  const res = await fetch('/api/images');
  const images = await res.json();

  const list = document.querySelector('.splide__list');
  images.forEach((filename) => {
    const li = document.createElement('li');
    li.className = 'splide__slide';
    li.dataset.filename = filename;
    li.innerHTML = `<img src="/images/${filename}" loading="lazy" alt="">`;
    list.appendChild(li);
  });

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
  connectSSE();
}

function addSlide(filename) {
  const slide = document.createElement('li');
  slide.className = 'splide__slide';
  slide.dataset.filename = filename;
  slide.innerHTML = `<img src="/images/${filename}" loading="lazy" alt="">`;
  splide.add(slide);
}

function removeSlide(filename) {
  const slides = splide.Components.Elements.slides;
  for (let i = 0; i < slides.length; i++) {
    if (slides[i].dataset.filename === filename) {
      splide.remove(i);
      break;
    }
  }
}

function rebuildSlideshow(images) {
  while (splide.length > 0) {
    splide.remove(0);
  }
  images.forEach((filename) => addSlide(filename));
}

function updateSlide(filename, timestamp) {
  const slides = splide.Components.Elements.slides;
  for (let i = 0; i < slides.length; i++) {
    if (slides[i].dataset.filename === filename) {
      const img = slides[i].querySelector('img');
      if (img) {
        // Add cache-busting timestamp to force reload
        const url = new URL(img.src, window.location.origin);
        url.searchParams.set('t', timestamp);
        img.src = url.toString();
      }
      break;
    }
  }
}

function connectSSE() {
  const eventSource = new EventSource('/api/events');

  eventSource.onerror = () => {
    eventSource.close();
    setTimeout(connectSSE, 5000);
  };

  eventSource.addEventListener('add', (e) => {
    const { filename } = JSON.parse(e.data);
    addSlide(filename);
  });

  eventSource.addEventListener('remove', (e) => {
    const { filename } = JSON.parse(e.data);
    removeSlide(filename);
  });

  eventSource.addEventListener('reshuffle', (e) => {
    const { images } = JSON.parse(e.data);
    rebuildSlideshow(images);
  });

  eventSource.addEventListener('config-update', (e) => {
    const update = JSON.parse(e.data);

    if (update.slideshowInterval) {
      splide.options.interval = update.slideshowInterval;
      console.log('Slideshow interval updated to', update.slideshowInterval);
    }
  });

  eventSource.addEventListener('update', (e) => {
    const { filename, timestamp } = JSON.parse(e.data);
    updateSlide(filename, timestamp);
  });
}

init();
