/* Real wishlist, backed by localStorage so it persists per-browser —
   mirrors js/cart.js. Runs on every page: keeps the header heart badge
   (.js-wishlist-icon) in sync everywhere, and toggles the filled-heart
   state on every "Add to Wishlist" button (grid cards, Quick View modal,
   and the standalone product-detail page).

   Products here don't always come with a reliable numeric id in the DOM
   (the static fallback markup used when /api/products can't be reached —
   e.g. opening the file directly instead of via a server — has none), so
   items are keyed by a slug of their name instead. That's enough to tell
   two different products apart and to recognise "the same product" no
   matter which card/page it was wishlisted from. */
(function () {
  'use strict';

  const STORAGE_KEY = 'zaz_wishlist_v1';

  function readWishlist() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function writeWishlist(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage unavailable (private browsing quota, etc.) — wishlist
      // just won't persist this session.
    }
  }

  function slugify(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, '-');
  }

  // Unlike js/cart.js — which stores the bare filename straight from the
  // product API (e.g. "embroidered-lawn-kurti.webp") — wishlist items are
  // built from extractFromCard()/extractFromDetail() below, which read the
  // *already-rendered* <img src> straight out of the DOM. That src is
  // already a full, resolved path (e.g. "images/embroidered-lawn-kurti.webp",
  // or a full https:// URL for an admin-uploaded photo), so re-prepending
  // "images/" here — like cart.js's version does — would double it up into
  // a broken "images/images/..." path. Only add the prefix for a bare
  // filename that doesn't have one yet.
  function imageSrc(image) {
    if (!image) return 'images/embroidered-lawn-kurti.webp';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:') || image.startsWith('images/')) {
      return image;
    }
    return 'images/' + image;
  }

  // Wishlist rows store price as the display string already shown on the
  // card (e.g. "Rs. 7,000"). Cart.add() needs a plain number. Strip every
  // non-digit character — including the period after "Rs" and the comma —
  // rather than just non-digit/dot, otherwise "Rs. 7,000" becomes ".7000"
  // (≈0.7) instead of 7000.
  function priceToNumber(priceStr) {
    const digits = String(priceStr || '').replace(/[^0-9]/g, '');
    return Number(digits) || 0;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const Wishlist = {
    getItems() {
      return readWishlist();
    },
    getCount() {
      return readWishlist().length;
    },
    has(key) {
      return readWishlist().some((i) => i.key === key);
    },
    add(item) {
      if (!item || !item.key) return;
      const items = readWishlist();
      if (!items.some((i) => i.key === item.key)) {
        items.push(item);
        writeWishlist(items);
      }
      renderHeaderWishlist();
      renderWishlistPage();
    },
    remove(key) {
      const items = readWishlist().filter((i) => i.key !== key);
      writeWishlist(items);
      renderHeaderWishlist();
      renderWishlistPage();
    },
    // Returns true if the item ended up wishlisted, false if it was removed.
    toggle(item) {
      if (!item || !item.key) return false;
      if (this.has(item.key)) {
        this.remove(item.key);
        return false;
      }
      this.add(item);
      return true;
    },
  };

  window.ZazWishlist = Wishlist;

  // --- Header heart badge, present on every page ---
  function renderHeaderWishlist() {
    const count = Wishlist.getCount();
    document.querySelectorAll('.js-wishlist-icon').forEach((el) => {
      el.setAttribute('data-notify', String(count));
    });
  }

  // --- Full wishlist page (wishlist.html) ---
  function renderWishlistPage() {
    const tbody = document.getElementById('wishlist-rows');
    if (!tbody) return; // not on the wishlist page

    const items = readWishlist();
    tbody.innerHTML = '';

    if (!items.length) {
      const tr = document.createElement('tr');
      tr.className = 'wishlist-empty-row';
      tr.innerHTML = '<td colspan="4" class="p-tb-30 stext-107 cl6">Your wishlist is empty. <a href="product.html" class="cl1 hov-cl1">Continue shopping →</a></td>';
      tbody.appendChild(tr);
      return;
    }

    items.forEach((item) => {
      const tr = document.createElement('tr');
      tr.className = 'table_row';
      tr.dataset.key = item.key;
      tr.innerHTML = `
        <td class="column-1">
          <div class="how-itemcart1 pos-relative">
            <img src="${imageSrc(item.image)}" alt="IMG">
          </div>
        </td>
        <td class="column-2">${escapeHtml(item.name)}</td>
        <td class="column-3">${escapeHtml(item.price) || '&mdash;'}</td>
        <td class="column-5">
          <div class="flex-w flex-r-m">
            <div class="flex-c-m stext-101 cl0 size-118 bg3 bor13 hov-btn1 p-lr-15 trans-04 pointer js-wishlist-addcart">
              Add to Cart
            </div>
            <div class="flex-c-m stext-101 cl2 size-118 bg8 bor13 hov-btn3 p-lr-15 trans-04 pointer js-wishlist-remove m-l-10">
              Remove
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.js-wishlist-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const key = e.target.closest('tr').dataset.key;
        Wishlist.remove(key);
        renderWishlistPage();
      });
    });

    tbody.querySelectorAll('.js-wishlist-addcart').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (!window.ZazCart) return;
        const key = e.target.closest('tr').dataset.key;
        const item = readWishlist().find((i) => i.key === key);
        if (!item) return;

        window.ZazCart.add(
          {
            id: item.id || item.key,
            name: item.name,
            price: priceToNumber(item.price),
            // item.image is already a resolved path (e.g. "images/foo.webp")
            // straight from the DOM. cart.js's own imageSrc() always
            // prepends "images/" to whatever it's given (it expects a bare
            // filename, matching what the product API returns), so passing
            // the already-resolved path through unchanged would double it
            // into "images/images/foo.webp". Strip the prefix back off
            // here — full https:// URLs (admin-uploaded photos) are left
            // alone since they don't have it.
            image: (item.image || '').replace(/^images\//i, ''),
          },
          1,
          {} // no size/color captured from the wishlist card — Cart.add
             // accepts blank variants, they just won't show a size/color
             // on that cart line
        );

        const original = e.target.textContent;
        e.target.textContent = 'Added ✓';
        setTimeout(() => { e.target.textContent = original; }, 1200);
      });
    });
  }

  // --- Grid / carousel product cards (.block2) ---
  function extractFromCard(anchor) {
    const card = anchor.closest('.block2');
    if (!card) return null;
    const nameEl = card.querySelector('.js-name-b2');
    const priceEl = card.querySelector('.block2-txt-child1 .stext-105');
    const imgEl = card.querySelector('.block2-pic img');
    const name = nameEl ? nameEl.textContent.trim() : '';
    if (!name) return null;
    // nameEl's href is "product-detail.html?id=123" — pull the id out of it
    // so wishlist items can later be added straight to the cart.
    let id = null;
    if (nameEl && nameEl.getAttribute('href')) {
      const match = nameEl.getAttribute('href').match(/[?&]id=([^&]+)/);
      if (match) id = match[1];
    }
    return {
      key: slugify(name),
      id,
      name,
      price: priceEl ? priceEl.textContent.trim() : '',
      image: imgEl ? imgEl.getAttribute('src') || '' : '',
    };
  }

  function syncButtonState(anchor, key) {
    anchor.classList.toggle('js-addedwish-b2', Wishlist.has(key));
  }

  // Every card for the same product (it can appear in more than one
  // carousel/grid on a page) should flip together, not just the one clicked.
  function syncAllCardsForKey(key) {
    document.querySelectorAll('.js-addwish-b2').forEach((anchor) => {
      const item = extractFromCard(anchor);
      if (item && item.key === key) syncButtonState(anchor, key);
    });
  }

  function markInitialCardStates() {
    document.querySelectorAll('.js-addwish-b2').forEach((anchor) => {
      const item = extractFromCard(anchor);
      if (item) syncButtonState(anchor, item.key);
    });
  }

  // --- Quick View modal + standalone product-detail page ---
  function extractFromDetail(anchor) {
    const scope = anchor.closest('.js-modal1') || document;
    const nameEl = scope.querySelector('.js-name-detail');
    const priceEl = scope.querySelector('.js-price-detail');
    const imgEl = scope.querySelector('.item-slick3 img, .item-slick2 img');
    const name = nameEl ? nameEl.textContent.trim() : '';
    if (!name) return null;
    // On the standalone product-detail page the id is in the page's own
    // URL (product-detail.html?id=123). Inside the Quick View modal there's
    // no such URL to read, so id stays null there — the wishlist item still
    // works, it just falls back to its slug when added to cart later.
    const urlId = new URLSearchParams(window.location.search).get('id');
    return {
      key: slugify(name),
      id: urlId || null,
      name,
      price: priceEl ? priceEl.textContent.trim() : '',
      image: imgEl ? imgEl.getAttribute('src') || '' : '',
    };
  }

  function syncDetailButtonState(anchor, key) {
    anchor.classList.toggle('is-added-wish', Wishlist.has(key));
  }

  function bindClicks() {
    document.addEventListener('click', (e) => {
      const gridAnchor = e.target.closest('.js-addwish-b2');
      if (gridAnchor) {
        e.preventDefault();
        const item = extractFromCard(gridAnchor);
        if (!item) return;
        Wishlist.toggle(item);
        syncAllCardsForKey(item.key);
        return;
      }

      const detailAnchor = e.target.closest('.js-addwish-detail');
      if (detailAnchor) {
        e.preventDefault();
        const item = extractFromDetail(detailAnchor);
        if (!item) return;
        Wishlist.toggle(item);
        syncDetailButtonState(detailAnchor, item.key);
        syncAllCardsForKey(item.key);
      }
    });
  }

  function init() {
    renderHeaderWishlist();
    renderWishlistPage();
    bindClicks();
    markInitialCardStates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-sync heart states whenever the grid re-renders (async product
  // fetch, or "Load More" appending fresh cards).
  document.addEventListener('zaz:products-rendered', markInitialCardStates);
})();