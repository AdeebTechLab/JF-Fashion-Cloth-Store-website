/* Renders the homepage "Flash Sales" carousel from /api/products, showing
   only products that currently have a discount (oldPrice set) — set via
   the admin panel's "Apply a discount" checkbox. If nothing is on sale,
   the whole section hides itself rather than showing an empty gap. */
(function () {
  'use strict';

  // A single flaky/slow request (common on mobile data) used to permanently
  // fall back to the static demo slides, even though a retry a moment
  // later would have succeeded. Retry with a short backoff first.
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
    if (!image) return 'images/embroidered-lawn-kurti.webp';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:')) return image;
    return 'images/' + image;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function buildSlide(product) {
    const pct = Math.round((1 - product.price / product.oldPrice) * 100);
    const badgeText = (product.saleTag && String(product.saleTag).trim()) || (pct + '% Off');
    const div = document.createElement('div');
    div.className = 'flash-sale-item';
    div.innerHTML = `
      <div class="flash-sale-pic">
        <a href="product-detail.html?id=${product.id}">
          <img src="${imageSrc(product.image)}" alt="${escapeHtml(product.name)}">
          <span class="flash-sale-badge">${escapeHtml(badgeText)}</span>
        </a>
        <a href="#" class="block2-btn flex-c-m stext-103 cl2 size-102 bg0 bor2 hov-btn1 p-lr-15 trans-04 js-show-modal1-flash">
          Quick View
        </a>
      </div>
      <a href="product-detail.html?id=${product.id}" class="flash-sale-name">${escapeHtml(product.name)}</a>
      <div class="flash-sale-price">
        <span class="flash-sale-oldprice">${money(product.oldPrice)}</span>
        <span class="flash-sale-newprice">${money(product.price)}</span>
      </div>
    `;

    // Quick View here opens the same shared modal the main product grid
    // uses, pre-filled with this exact product (including its sale price),
    // so Add to Cart inside it works the same way for every card on the page.
    const quickViewLink = div.querySelector('.js-show-modal1-flash');
    quickViewLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.ZazQuickView) window.ZazQuickView.open(product);
    });

    return div;
  }

  // The static fallback markup baked into the page (shown when /api/products
  // can't be reached) has its own Quick View buttons too, with the product
  // details stashed in data-attributes on each .flash-sale-item. Wire those
  // up the same way so Quick View / Add to Cart work even without the API.
  function bindStaticQuickView(track) {
    const items = track.querySelectorAll('.flash-sale-item[data-id]');
    items.forEach((item) => {
      const btn = item.querySelector('.js-show-modal1-flash');
      if (!btn) return;
      const product = {
        id: Number(item.getAttribute('data-id')),
        name: item.getAttribute('data-name'),
        price: Number(item.getAttribute('data-price')),
        oldPrice: Number(item.getAttribute('data-old-price')),
        image: item.getAttribute('data-image'),
        inStock: item.getAttribute('data-in-stock') !== 'false',
      };
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.ZazQuickView) window.ZazQuickView.open(product);
      });
    });
  }

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

  function initSlick(track) {
    if (typeof jQuery === 'undefined' || !jQuery.fn.slick) return;
    const $track = jQuery(track);
    if ($track.hasClass('slick-initialized')) $track.slick('unslick');
    $track.slick({
      infinite: false,
      slidesToShow: 4,
      slidesToScroll: 4,
      dots: true,
      arrows: false,
      responsive: [
        { breakpoint: 992, settings: { slidesToShow: 2, slidesToScroll: 2 } },
        { breakpoint: 576, settings: { slidesToShow: 1, slidesToScroll: 1 } },
      ],
    });
  }

  async function render() {
    const section = document.querySelector('[data-flash-sales-section]');
    const track = document.querySelector('[data-flash-sales]');
    if (!section || !track) return;

    let products;
    try {
      products = await fetchJsonWithRetry('/api/products');
    } catch {
      // API unavailable even after retries (e.g. the page opened as a local
      // file) — leave the static fallback slides
      // already baked into the page rather than hiding the section, just
      // make sure they're wired up as a carousel and their Quick View
      // buttons work.
      bindStaticQuickView(track);
      initSlick(track);
      return;
    }

    // The "% Off" badge is a sale promotion for something a customer can
    // actually buy right now, so an out-of-stock product — even with a
    // discount configured — is left out of this carousel entirely instead
    // of showing a misleading "X% Off" badge on something they can't order.
    const onSale = products.filter((p) => p.oldPrice != null && p.oldPrice > p.price && p.inStock !== false);
    if (!onSale.length) {
      section.style.display = 'none';
      return;
    }

    track.innerHTML = '';
    onSale.forEach((product) => track.appendChild(buildSlide(product)));
    await waitForImages(track);
    initSlick(track);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
