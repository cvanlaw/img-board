let splide;
let config = { slideshowInterval: 5000 };

async function init() {
  try {
    const configRes = await fetch('/api/admin/config');
    if (configRes.ok) {
      config = await configRes.json();
    }
  } catch (e) {
    console.log('Using default config');
  }

  const res = await fetch('/api/images');
  const images = await res.json();

  const list = document.querySelector('.splide__list');
  images.forEach(filename => {
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
}

init();
