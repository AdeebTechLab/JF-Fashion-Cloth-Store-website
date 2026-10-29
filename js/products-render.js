/* Renders the product grid (.isotope-grid) on index.html / product.html from
   /api/products instead of hardcoded HTML, so the admin panel's edits show
   up on the live site without touching any page markup. Falls back to
   whatever static markup is already in the page if the fetch fails. */
(function () {
  'use strict';

  // A single flaky/slow request (common on mobile data) used to permanently
  // fall back to the stale product list baked into the HTML at build time —
  // even though a retry a moment later would have succeeded. Retry a couple
  // of times with a short backoff before giving up for real.
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

  function imageSrc(image) {
    if (!image) return 'images/embroidered-lawn-kurti.webp';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:')) return image;
    return 'images/' + image;
  }

  function money(n) {
    return 'Rs. ' + Math.round(Number(n)).toLocaleString('en-US');
  }

  function buildCard(product) {
    const col = document.createElement('div');
    const catClasses = Array.isArray(product.categories) ? product.categories.join(' ') : '';
    col.className = 'col-sm-6 col-md-4 col-lg-3 p-b-35 isotope-item ' + catClasses;
    const outOfStock = product.inStock === false;
    const priceHtml = product.oldPrice != null
      ? `<span class="stext-105 cl3">${money(product.price)}</span> ` +
        `<span class="stext-105" style="color:#999;text-decoration:line-through;margin-left:6px;">${money(product.oldPrice)}</span>`
      : `<span class="stext-105 cl3">${money(product.price)}</span>`;

    const photos = galleryImages(product);
    const hasGallery = photos.length > 1;
    const galleryNavHtml = hasGallery
      ? `
          <button type="button" class="card-gallery-arrow card-gallery-prev" aria-label="Previous photo"><i class="fa fa-angle-left" aria-hidden="true"></i></button>
          <button type="button" class="card-gallery-arrow card-gallery-next" aria-label="Next photo"><i class="fa fa-angle-right" aria-hidden="true"></i></button>
          <div class="card-gallery-dots">${photos.map((_, i) => `<span class="card-gallery-dot${i === 0 ? ' is-active' : ''}"></span>`).join('')}</div>
        `
      : '';

    col.innerHTML = `
      <div class="block2">
        <div class="block2-pic hov-img0">
          <img class="card-gallery-img" src="${photos[0]}" alt="IMG-PRODUCT">
          ${outOfStock ? '<span class="out-of-stock-badge">Out of Stock</span>' : ''}
          ${galleryNavHtml}
          <a href="#" class="block2-btn flex-c-m stext-103 cl2 size-102 bg0 bor2 hov-btn1 p-lr-15 trans-04 js-show-modal1">
            Quick View
          </a>
        </div>

        <div class="block2-txt flex-w flex-t p-t-14">
          <div class="block2-txt-child1 flex-col-l ">
            <a href="product-detail.html?id=${product.id}" class="stext-104 cl4 hov-cl1 trans-04 js-name-b2 p-b-6">
              ${escapeHtml(product.name)}
            </a>
            ${priceHtml}
          </div>

          <div class="block2-txt-child2 flex-r p-t-3">
            <a href="#" class="btn-addwish-b2 dis-block pos-relative js-addwish-b2">
              <img class="icon-heart1 dis-block trans-04" src="images/icons/icon-heart-01.png" alt="ICON">
              <img class="icon-heart2 dis-block trans-04 ab-t-l" src="images/icons/icon-heart-02.png" alt="ICON">
            </a>
          </div>
        </div>
      </div>
    `;

    // Lets a shopper flip through a product's extra photos right on its
    // grid card (prev/next arrows + dots), without needing to open Quick
    // View first. Swaps the single <img>'s src rather than keeping every
    // photo in the DOM at once, so a page of 20+ cards doesn't eagerly
    // load 100+ images just for the ones nobody clicks through.
    if (hasGallery) {
      const imgEl = col.querySelector('.card-gallery-img');
      const dots = Array.from(col.querySelectorAll('.card-gallery-dot'));
      let photoIdx = 0;
      function showPhoto(i) {
        photoIdx = (i + photos.length) % photos.length;
        imgEl.src = photos[photoIdx];
        dots.forEach((dot, di) => dot.classList.toggle('is-active', di === photoIdx));
      }
      col.querySelector('.card-gallery-prev').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showPhoto(photoIdx - 1);
      });
      col.querySelector('.card-gallery-next').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showPhoto(photoIdx + 1);
      });
    }

    // "Add to Cart" now lives inside Quick View (and the full product page)
    // instead of sitting under every card, so wire the Quick View trigger to
    // open the shared modal pre-filled with this exact product's data.
    const quickViewLink = col.querySelector('.js-show-modal1');
    quickViewLink.addEventListener('click', (e) => {
      e.preventDefault();
      openQuickView(product);
    });

    return col;
  }


  // --- Quick View modal (shared markup already in the page; we just
  // populate it per-product and show/hide it ourselves, since the theme's
  // own main.js only binds .js-show-modal1 clicks on whatever was in the
  // DOM at page load — not the cards we render here afterwards). ---
  let quickViewProduct = null;

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

  // Rebuilds the Quick View gallery (photo carousel + thumbnail dots +
  // prev/next arrows) from the clicked product's actual photo list. The
  // theme's static markup ships with 3 demo slides and Slick renders its
  // dots/arrows once at page load from whatever was there then, so simply
  // overwriting the <img> tags afterwards wouldn't update the slide count.
  // Instead: tear down any existing Slick instance, replace the slides to
  // match this product's real photos, and re-init Slick only if there's
  // more than one (a single photo has nothing to navigate between, so the
  // dots/arrows stay hidden and it just fills the row).
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
      // asNavFor in both directions.
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

  // Rebuilds a Size/Color <select>'s <option> list from the product's own
  // admin-managed sizes/colors array. If the product has none defined for
  // that variant type, the whole field (label + select) is hidden instead
  // of showing an empty/meaningless dropdown, and it's no longer required
  // before adding to cart.
  // Rebuilds a Size/Color picker's list of clickable chips from the
  // product's own admin-managed sizes/colors array. If the product has
  // none defined for that variant type, the whole column is hidden
  // instead of showing an empty/meaningless list, and it's no longer
  // required before adding to cart.
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
      // "default" variant) instead of being blocked by the "please select"
      // validation the first time they hit Add to Cart.
      if (index === 0) {
        chip.classList.add('is-selected');
        optionsBox.dataset.value = value;
      }
    });
  }

  // Reads the current Size/Color pick out of a Quick View (or product
  // detail) container and validates both are actually picked. A variant is
  // only required if the product actually has options for it (its column
  // is visible). Shows/hides the inline error message and highlights
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

  function getQuickViewModal() {
    return document.querySelector('.js-modal1');
  }

  // Resets the Size/Color pickers back to unpicked and hides any leftover
  // validation message from a previous product.
  function resetVariantSelects(modal) {
    modal.querySelectorAll('.js-variant-options').forEach((box) => {
      box.dataset.value = '';
      box.querySelectorAll('.variant-chip').forEach((c) => c.classList.remove('is-selected'));
    });
    modal.querySelectorAll('.js-variant-wrap').forEach((col) => col.classList.remove('is-invalid'));
    const errorBox = modal.querySelector('.js-variant-error');
    if (errorBox) errorBox.style.display = 'none';
  }

  function openQuickView(product) {
    const modal = getQuickViewModal();
    if (!modal) return;
    quickViewProduct = product;
    const descEl = modal.querySelector('.js-desc-detail');
if (descEl) {
  descEl.textContent = product.description && product.description.trim()
    ? product.description
    : '';
  descEl.style.display = descEl.textContent ? '' : 'none';
}

    const nameEl = modal.querySelector('.js-name-detail');
    const priceEl = modal.querySelector('.js-price-detail');
    const oldPriceEl = modal.querySelector('.js-oldprice-detail');
    const saleTagEl = modal.querySelector('.js-saletag-detail');
    const qtyInput = modal.querySelector('.num-product');
    const addBtn = modal.querySelector('.js-addcart-detail');

    if (nameEl) nameEl.textContent = product.name;
    if (priceEl) priceEl.textContent = money(product.price);

    // Show the crossed-out original price + discount badge when the product
    // is on sale, matching how the grid cards present a discount.
    const onSale = product.oldPrice != null && Number(product.oldPrice) > Number(product.price);
    if (oldPriceEl) {
      oldPriceEl.textContent = onSale ? money(product.oldPrice) : '';
      oldPriceEl.style.display = onSale ? '' : 'none';
    }
    if (saleTagEl) {
      let tag = '';
      if (onSale) {
        tag = product.saleTag && String(product.saleTag).trim()
          ? product.saleTag
          : Math.round((1 - Number(product.price) / Number(product.oldPrice)) * 100) + '% Off';
      }
      saleTagEl.textContent = tag;
      saleTagEl.style.display = tag ? '' : 'none';
    }
    if (qtyInput) qtyInput.value = 1;
    resetVariantSelects(modal);
    populateVariantOptions(modal, 'size', product.sizes);
    populateVariantOptions(modal, 'color', product.colors);

    renderGallery(modal.querySelector('.wrap-slick3'), galleryImages(product));

    const outOfStock = product.inStock === false;
    if (addBtn) {
      addBtn.disabled = outOfStock;
      addBtn.classList.toggle('is-disabled', outOfStock);
      addBtn.textContent = outOfStock ? 'Out of Stock' : 'Add to cart';
    }

    modal.classList.add('show-modal1');
  }

  // Exposed so other renderers on the same page (e.g. the Flash Sales
  // carousel) can open the same shared Quick View modal for their own
  // product cards, instead of duplicating the modal-population logic.
  window.ZazQuickView = { open: openQuickView };

  // Add-to-cart button inside Quick View is wired once; it always acts on
  // whichever product is currently loaded into the modal.
  function bindQuickViewAddToCart() {
    const modal = getQuickViewModal();
    if (!modal) return;
    const addBtn = modal.querySelector('.js-addcart-detail');
    const qtyInput = modal.querySelector('.num-product');
    if (!addBtn) return;

    addBtn.addEventListener('click', () => {
      if (!quickViewProduct || !window.ZazCart) return;
      if (quickViewProduct.inStock === false) return;

      const variant = readAndValidateVariant(modal);
      if (!variant) return; // error message is now visible; don't add or close

      const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
      window.ZazCart.add(quickViewProduct, qty, variant);
      const original = addBtn.textContent;
      addBtn.textContent = 'Added ✓';
      setTimeout(() => {
        if (!addBtn.disabled) addBtn.textContent = original;
      }, 1200);
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function initIsotope() {
    if (typeof jQuery === 'undefined' || !jQuery.fn.isotope) return;
    jQuery('.isotope-grid').each(function () {
      const $grid = jQuery(this);
      if ($grid.data('isotope')) {
        $grid.isotope('reloadItems').isotope('layout');
      } else {
        $grid.isotope({
          itemSelector: '.isotope-item',
          layoutMode: 'fitRows',
          percentPosition: true,
          masonry: { columnWidth: '.isotope-item' },
        });
      }
    });
  }

  // Isotope measures each item's height to lay out the grid. If we call it
  // before the freshly-injected <img> elements have actually finished
  // loading, it measures them at ~0px and stacks/overlaps everything. So we
  // wait for every image in the grid to load (or fail) first.
  function waitForImages(container) {
    const imgs = Array.from(container.querySelectorAll('img'));
    return Promise.all(
      imgs.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        });
      })
    );
  }

  async function renderGrids() {
    const grids = document.querySelectorAll('.isotope-grid[data-dynamic-products]');
    if (!grids.length) return;

    let products;
    try {
      products = await fetchJsonWithRetry('/api/products');
    } catch {
      // Leave whatever static fallback markup is already in the page —
      // only after retrying, so a single dropped request on a weak mobile
      // connection doesn't hide newly-added products.
      return;
    }

    for (const grid of grids) {
      let list = grid.hasAttribute('data-sale-only')
        ? products.filter((p) => p.oldPrice != null && Number(p.oldPrice) > Number(p.price))
        : products;

      const limit = grid.getAttribute('data-limit');
      if (limit) list = list.slice(0, Number(limit));

      grid.innerHTML = '';

      if (!list.length && grid.hasAttribute('data-sale-only')) {
        grid.innerHTML = '<div class="col-md-12 txt-center stext-107 cl6 p-tb-40">' +
          'No items on sale right now — check back soon!</div>';
        continue;
      }

      list.forEach((product) => grid.appendChild(buildCard(product)));
      await waitForImages(grid);
    }

    initIsotope();
    document.dispatchEvent(new CustomEvent('zaz:products-rendered'));
  }

  function init() {
    bindQuickViewAddToCart();
    renderGrids();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
