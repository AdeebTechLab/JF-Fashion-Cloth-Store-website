/* Makes product-detail.html show the actual product that was clicked
   (via a ?id= query param) instead of always showing the same static
   "Lightweight Jacket" demo content, and wires its "Add to cart" button
   to the real cart instead of just a cosmetic toast. */
(function () {
  'use strict';

  // A single flaky/slow request (common on mobile data) used to permanently
  // leave the page on its default demo content, even though a retry a
  // moment later would have succeeded. Retry with a short backoff first.
  async function fetchJsonWithRetry(url, attempts = 3, delayMs = 700) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('bad response: ' + res.status);
        return await res.json();
      } catch (err) {
        lastErr = err;
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
    throw lastErr;
  }

  function money(n) {
    return 'Rs. ' + Math.round(Number(n)).toLocaleString('en-US');
  }

  function imageSrc(image) {
    if (!image) return 'images/product-detail-01.webp';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:')) return image;
    return 'images/' + image;
  }

  // Builds one <div class="item-slick3"> gallery slide (photo + expand-to-
  // lightbox link) for a given image src. Built with DOM APIs rather than
  // innerHTML so an image URL can never be interpreted as markup.
  function buildGallerySlide(src) {
    const slide = document.createElement('div');
    slide.className = 'item-slick3';
    slide.setAttribute('data-thumb', src);

    const picWrap = document.createElement('div');
    picWrap.className = 'wrap-pic-w pos-relative';

    const img = document.createElement('img');
    img.src = src;
    img.alt = 'IMG-PRODUCT';

    const lightboxLink = document.createElement('a');
    lightboxLink.className = 'flex-c-m size-108 how-pos1 bor0 fs-16 cl10 bg0 hov-btn3 trans-04';
    lightboxLink.href = src;
    const icon = document.createElement('i');
    icon.className = 'fa fa-expand';
    lightboxLink.appendChild(icon);

    picWrap.appendChild(img);
    picWrap.appendChild(lightboxLink);
    slide.appendChild(picWrap);
    return slide;
  }

  // Rebuilds a product's gallery (photo carousel + thumbnail dots +
  // prev/next arrows) from its actual photo list. The theme's static
  // markup ships with 3 demo slides and Slick renders its dots/arrows once
  // at page load from whatever was there then, so simply overwriting the
  // <img> tags afterwards wouldn't update the slide count. Instead: tear
  // down any existing Slick instance, replace the slides to match this
  // product's real photos, and re-init Slick only if there's more than one
  // (a single photo has nothing to navigate between, so the dots/arrows
  // stay hidden and it just fills the row).
  function renderGallery(wrap, images) {
    if (!wrap) return;
    const track = wrap.querySelector('.slick3');
    if (!track) return;
    const dotsBox = wrap.querySelector('.wrap-slick3-dots');
    const arrowsBox = wrap.querySelector('.wrap-slick3-arrows');

    if (window.jQuery && window.jQuery(track).hasClass('slick-initialized')) {
      window.jQuery(track).slick('unslick');
    }
    if (dotsBox) {
      const $existingThumbs = window.jQuery(dotsBox).find('.slick3-thumbs.slick-initialized');
      if ($existingThumbs.length) $existingThumbs.slick('unslick');
    }

    track.innerHTML = '';
    images.forEach((src) => track.appendChild(buildGallerySlide(src)));

    const multi = images.length > 1;
    if (dotsBox) {
      dotsBox.style.display = multi ? '' : 'none';
      dotsBox.innerHTML = '';
    }
    if (arrowsBox) arrowsBox.style.display = multi ? '' : 'none';
    // .slick3 is normally 83.33% wide to leave room for the dots column -
    // reclaim that space when there's only one photo to show.
    track.style.width = multi ? '' : '100%';

    if (multi && window.jQuery && window.jQuery.fn.slick) {
      const $track = window.jQuery(track);
      const $dotsBox = window.jQuery(dotsBox);

      // Build the thumbnail strip ourselves (one slide per photo) instead
      // of using Slick's built-in dots, so it can be its own coverflow-
      // style carousel — center thumb clear/larger, the rest dimmed and
      // blurred to either side — with its own prev/next buttons to scroll
      // through any thumbs that don't fit, synced to the main photo via
      // asNavFor in both directions (click a thumb -> main photo jumps to
      // it; move the main photo -> the strip re-centers on it).
      $dotsBox.empty();
      const $thumbs = window.jQuery('<div class="slick3-thumbs"></div>');
      images.forEach((src) => {
        $thumbs.append('<div class="slick3-thumb-item"><img src="' + src + '" alt=""></div>');
      });
      $dotsBox.append($thumbs);

      $track.slick({
        slidesToShow: 1,
        slidesToScroll: 1,
        fade: false,
        infinite: true,
        autoplay: false,
        autoplaySpeed: 6000,
        asNavFor: $thumbs,

        arrows: true,
        appendArrows: window.jQuery(wrap).find('.wrap-slick3-arrows'),
        prevArrow: '<button class="arrow-slick3 prev-slick3"><i class="fa fa-angle-left" aria-hidden="true"></i></button>',
        nextArrow: '<button class="arrow-slick3 next-slick3"><i class="fa fa-angle-right" aria-hidden="true"></i></button>',

        dots: false,
      });

      $thumbs.slick({
        slidesToShow: Math.min(3, images.length),
        slidesToScroll: 1,
        centerMode: true,
        centerPadding: '0px',
        fade: false,
        infinite: true,
        autoplay: false,
        asNavFor: $track,
        focusOnSelect: true,

        arrows: true,
        prevArrow: '<button type="button" class="slick3-thumb-arrow slick3-thumb-prev" aria-label="Previous photos"><i class="fa fa-angle-left" aria-hidden="true"></i></button>',
        nextArrow: '<button type="button" class="slick3-thumb-arrow slick3-thumb-next" aria-label="More photos"><i class="fa fa-angle-right" aria-hidden="true"></i></button>',

        responsive: [
          {
            breakpoint: 767,
            settings: {
              slidesToShow: Math.min(3, images.length),
              centerMode: true,
            },
          },
        ],
      });
    }
  }

  // A product's full photo list: the admin-managed `images` gallery array
  // if it has one, otherwise just its single cover `image`.
  function galleryImages(product) {
    const list = Array.isArray(product.images) && product.images.length
      ? product.images
      : [product.image];
    return list.map(imageSrc);
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    const id = Number(params.get('id'));
    if (!id) return; // no id in the link — leave the theme's default demo content as-is

    let products;
    try {
      products = await fetchJsonWithRetry('/api/products');
    } catch {
      return; // API unavailable even after retries — leave default content rather than break the page
    }

    const product = products.find((p) => p.id === id);
    if (!product) return;

    document.title = product.name + ' — JF Fashion';

    // Breadcrumb: the markup ships with a placeholder ("Winter Wear / Quilted
    // Chiffon Jacket"), so point it at the product actually being viewed.
    const crumbLink = document.querySelector('.js-crumb-category');
    const crumbLabel = document.querySelector('.js-crumb-category-label');
    const crumbName = document.querySelector('.js-crumb-name');
    if (crumbName) crumbName.textContent = product.name;
    const categoryKey = Array.isArray(product.categories) && product.categories.length
      ? String(product.categories[0])
      : '';
    if (categoryKey) {
      if (crumbLink) crumbLink.href = 'product.html?category=' + encodeURIComponent(categoryKey);
      if (crumbLabel) {
        let categoryLabels = null;
        try {
          const res = await fetch('/api/categories', { cache: 'no-store' });
          if (res.ok) categoryLabels = await res.json();
        } catch {
          // Labels unavailable — fall back to a prettified slug below.
        }
        const pretty = categoryKey.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        crumbLabel.textContent = (categoryLabels && categoryLabels[categoryKey]) || pretty;
      }
    }

    document.querySelectorAll('.js-name-detail').forEach((el) => {
      el.textContent = product.name;
    });
    document.querySelectorAll('.js-price-detail').forEach((el) => {
      el.textContent = money(product.price);
    });

    // Crossed-out original price + discount badge for on-sale products, so
    // the product page and its Quick View match the grid cards.
    const onSale = product.oldPrice != null && Number(product.oldPrice) > Number(product.price);
    let saleTag = '';
    if (onSale) {
      saleTag = product.saleTag && String(product.saleTag).trim()
        ? product.saleTag
        : Math.round((1 - Number(product.price) / Number(product.oldPrice)) * 100) + '% Off';
    }
    document.querySelectorAll('.js-oldprice-detail').forEach((el) => {
      el.textContent = onSale ? money(product.oldPrice) : '';
      el.style.display = onSale ? '' : 'none';
    });
    document.querySelectorAll('.js-saletag-detail').forEach((el) => {
      el.textContent = saleTag;
      el.style.display = saleTag ? '' : 'none';
    });
    document.querySelectorAll('.js-desc-full, .js-desc-detail').forEach((el) => {
  el.textContent = product.description && product.description.trim()
    ? product.description
    : 'No description available for this product yet.';
});

    const images = galleryImages(product);
    document.querySelectorAll('.wrap-slick3').forEach((wrap) => {
      renderGallery(wrap, images);
    });

    // Rebuilds a Size/Color picker's list of clickable chips from the
    // product's own admin-managed sizes/colors array. If the product has
    // none defined for that variant type, the whole column is hidden
    // instead of showing an empty/meaningless list, and it's no longer
    // required before adding to cart. Mirrors the same helper in
    // js/products-render.js since this file has no shared module to
    // import it from.
    function populateVariantOptions(container, kind, values) {
      const col = container.querySelector(`.js-variant-wrap[data-variant="${kind}"]`);
      if (!col) return;
      const optionsBox = col.querySelector('.js-variant-options');
      if (!optionsBox) return;
      const list = Array.isArray(values) ? values.filter((v) => v && String(v).trim()) : [];

      optionsBox.innerHTML = '';
      optionsBox.dataset.value = '';
      col.classList.remove('is-invalid');

      if (!list.length) {
        col.style.display = 'none';
        return;
      }

      col.style.display = '';
      list.forEach((value, index) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'variant-chip';
        chip.textContent = value;
        chip.dataset.value = value;
        chip.addEventListener('click', () => {
          optionsBox.querySelectorAll('.variant-chip').forEach((c) => c.classList.remove('is-selected'));
          chip.classList.add('is-selected');
          optionsBox.dataset.value = value;
          col.classList.remove('is-invalid');
          const errorBox = container.querySelector('.js-variant-error');
          if (errorBox) errorBox.style.display = 'none';
        });
        optionsBox.appendChild(chip);

        // Pre-select the first option so a shopper who doesn't touch the
        // Size/Color pickers at all still has a valid pick (the product's
        // "default" variant) instead of being blocked by the "please
        // select" validation the first time they hit Add to Cart.
        if (index === 0) {
          chip.classList.add('is-selected');
          optionsBox.dataset.value = value;
        }
      });
    }

    // Both the main product section and the Quick View modal on this page
    // wrap their Size/Color pickers in a ".p-t-33" block — populate each
    // one from this product's own admin-managed sizes/colors.
    document.querySelectorAll('.p-t-33').forEach((container) => {
      if (!container.querySelector('.js-variant-options')) return;
      populateVariantOptions(container, 'size', product.sizes);
      populateVariantOptions(container, 'color', product.colors);
    });

    // Reads the current Size/Color pick out of an Add to Cart button's own
    // container and validates both are actually picked. A variant is only
    // required if the product actually has options for it (its column is
    // visible). Shows/hides the inline error message and highlights
    // whichever column(s) are still unpicked.
    function readAndValidateVariant(container) {
      const sizeCol = container.querySelector('.js-variant-wrap[data-variant="size"]');
      const colorCol = container.querySelector('.js-variant-wrap[data-variant="color"]');
      const errorBox = container.querySelector('.js-variant-error');

      function isRequired(col) {
        return !!col && col.style.display !== 'none';
      }
      function selectedValue(col) {
        const box = col && col.querySelector('.js-variant-options');
        return box ? (box.dataset.value || '') : '';
      }

      const sizeNeeded = isRequired(sizeCol);
      const colorNeeded = isRequired(colorCol);
      const size = selectedValue(sizeCol);
      const color = selectedValue(colorCol);

      [sizeCol, colorCol].forEach((col) => col && col.classList.remove('is-invalid'));

      if ((sizeNeeded && !size) || (colorNeeded && !color)) {
        if (sizeNeeded && !size) sizeCol.classList.add('is-invalid');
        if (colorNeeded && !color) colorCol.classList.add('is-invalid');
        if (errorBox) errorBox.style.display = 'block';
        return null;
      }

      if (errorBox) errorBox.style.display = 'none';
      return { size, color };
    }

    const outOfStock = product.inStock === false;
    document.querySelectorAll('.js-addcart-detail').forEach((btn) => {
      btn.disabled = outOfStock;
      btn.classList.toggle('is-disabled', outOfStock);
      if (outOfStock) btn.textContent = 'Out of Stock';
    });

    document.querySelectorAll('.js-addcart-detail').forEach((btn) => {
      if (outOfStock) return; // leave disabled, no click handler needed
      // Each Add to Cart button lives inside its own ".p-t-33" block, which
      // also contains that same block's Size/Color selects and error
      // message — this is true both for the main product section and for
      // the page's (separate) Quick View modal, so this works for both.
      const container = btn.closest('.p-t-33') || btn.closest('.flex-w') || document;

      btn.addEventListener('click', () => {
        if (!window.ZazCart) return;

        const variant = readAndValidateVariant(container);
        if (!variant) return; // error message is now visible; don't add to cart

        const wrap = btn.closest('.flex-w');
        const qtyInput = wrap ? wrap.querySelector('.num-product') : null;
        const qty = qtyInput ? Number(qtyInput.value) || 1 : 1;
        window.ZazCart.add(product, qty, variant);

        const original = btn.textContent;
        btn.textContent = 'Added ✓';
        setTimeout(() => { btn.textContent = original; }, 1200);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
