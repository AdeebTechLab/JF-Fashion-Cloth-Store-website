(function () {
  'use strict';

  let productsData = [];
  let nextId = 1;
  let searchTerm = '';

  // Cover photo + up to 5 extra gallery photos per product — mirrors the
  // MAX_GALLERY_PHOTOS cap enforced server-side in api/products.js.
  const MAX_GALLERY_PHOTOS = 6;

  // Categories used to be a fixed set of 5 keys. They're now fully dynamic —
  // an admin can rename, add, or delete them via the Manage Categories modal
  // — so instead of a hardcoded list we track whatever keys are currently
  // loaded, in display order. categoryLabels below is just the built-in
  // fallback used until /api/categories responds.
  let categoryLabels = { 'summer-wear': 'Summer Wear', 'winter-wear': 'Winter Wear', 'ethnic-wear': 'Ethnic Wear', 'casual-wear': 'Casual Wear', 'party-wear': 'Party Wear' };
  let categoryOrder = Object.keys(categoryLabels);

  // Discount coupons, loaded from /api/coupons. Empty until an admin adds
  // some via the Manage Coupons modal.
  let coupons = [];

  // Flat delivery charge (Rs.), loaded from /api/settings. Defaults to 0
  // (free) until an admin sets one via the Delivery Charge modal.
  let deliveryCharge = 0;

  // Order-value threshold (Rs., post-discount) above which deliveryCharge
  // is waived automatically. `null` means the feature is off (delivery is
  // always charged). Loaded from /api/settings.
  let freeShippingThreshold = null;

  const authGate = document.getElementById('auth-gate');
  const app = document.getElementById('app');
  const usernameLabel = document.getElementById('username-label');
  const container = document.getElementById('products-container');
  const categorySectionTemplate = document.getElementById('category-section-template');
  const saveBtn = document.getElementById('save-btn');
  const saveStatus = document.getElementById('save-status');
  const banner = document.getElementById('banner');
  const productTemplate = document.getElementById('product-template');
  const productGalleryItemTemplate = document.getElementById('product-gallery-item-template');
  const editCategoriesBtn = document.getElementById('edit-categories-btn');
  const categoriesModal = document.getElementById('categories-modal');
  const categoriesFieldsContainer = document.getElementById('categories-fields');
  const categoriesAddBtn = document.getElementById('categories-add-btn');
  const categoriesCloseX = document.getElementById('categories-close-x');
  const categoriesCancelBtn = document.getElementById('categories-cancel-btn');
  const categoriesSaveBtn = document.getElementById('categories-save-btn');
  const editCouponsBtn = document.getElementById('edit-coupons-btn');
  const couponsModal = document.getElementById('coupons-modal');
  const couponsFieldsContainer = document.getElementById('coupons-fields');
  const couponsAddBtn = document.getElementById('coupons-add-btn');
  const couponsCloseX = document.getElementById('coupons-close-x');
  const couponsCancelBtn = document.getElementById('coupons-cancel-btn');
  const couponsSaveBtn = document.getElementById('coupons-save-btn');
  const editDeliveryBtn = document.getElementById('edit-delivery-btn');
  const deliveryModal = document.getElementById('delivery-modal');
  const deliveryChargeInput = document.getElementById('delivery-charge-input');
  const freeShippingThresholdInput = document.getElementById('free-shipping-threshold-input');
  const deliveryCloseX = document.getElementById('delivery-close-x');
  const deliveryCancelBtn = document.getElementById('delivery-cancel-btn');
  const deliverySaveBtn = document.getElementById('delivery-save-btn');
  const productSearchInput = document.getElementById('product-search-input');
  const productSearchClear = document.getElementById('product-search-clear');
  const searchNoResults = document.getElementById('search-no-results');
  const searchNoResultsTerm = document.getElementById('search-no-results-term');

  function showBanner(message, type) {
    banner.textContent = message;
    banner.className = 'banner ' + type;
    banner.classList.remove('hidden');
  }

  function hideBanner() {
    banner.classList.add('hidden');
  }

  function imageSrc(image) {
    if (!image) return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
    if (/^https?:\/\//i.test(image) || image.startsWith('data:')) return image;
    return '/images/' + image;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Turns a typed-in category label like "Kids Wear" into a URL/CSS-safe key
  // ("kids-wear"), matching the pattern the storefront and API expect.
  // Falls back to a generic key, and de-dupes against existing/other-new
  // keys so two categories never collide.
  function slugifyCategoryKey(label, takenKeys) {
    let base = String(label || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!base) base = 'category';
    let key = base;
    let n = 2;
    while (takenKeys.has(key)) {
      key = `${base}-${n}`;
      n++;
    }
    return key;
  }

  // --- Auth gate ---
  async function checkSession() {
    try {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (!data.authenticated) {
        window.location.href = '/admin/login.html';
        return;
      }
      usernameLabel.textContent = data.username || '';
      authGate.classList.add('hidden');
      app.classList.remove('hidden');
      await loadCategories();
      await loadProducts();
      await loadCoupons();
      await loadSettings();
    } catch (err) {
      authGate.textContent = 'Could not check your session. Please refresh.';
    }
  }

  // --- Load & apply category labels ---
  async function loadCategories() {
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load categories (status ' + res.status + ')');
      const data = await res.json();
      if (data && typeof data === 'object' && Object.keys(data).length) {
        categoryLabels = data;
        categoryOrder = Object.keys(data);
      }
    } catch (err) {
      // Non-fatal — keep the built-in default labels (Summer/Winter/Ethnic/Casual/Party Wear)
      // so the admin panel still works even if this fetch fails.
    }
    function applyCategoryLabels() {
    container.querySelectorAll('.category-section').forEach((section) => {
      const key = section.dataset.categoryKey;
      const title = section.querySelector('.category-section-title');
      if (key && title) title.textContent = categoryLabels[key];
    });
  }
  }

// Builds the checkbox list for categories in the current display order
  function categoryCheckboxesHtml(selectedKeys = []) {
    return categoryOrder.map((key) => `
      <label class="category-checkbox-label">
        <input type="checkbox" class="p-category-checkbox" value="${escapeHtml(key)}"
          ${selectedKeys.includes(key) ? 'checked' : ''}>
        ${escapeHtml(categoryLabels[key])}
      </label>`).join('');
  }
  // Pushes the current categoryLabels/categoryOrder into every place a
  // category is shown in the admin UI: the card template (so newly added
  // products get the right dropdown), every already-rendered product card's
  // category dropdown (preserving its current selection), and each category
  // section's heading.
  function applyCategoryLabels() {
    const optionsHtml = categoryOptionsHtml();
    const templateSelect = productTemplate.content.querySelector('.p-category-input');
    if (templateSelect) templateSelect.innerHTML = optionsHtml;

    container.querySelectorAll('.p-category-input').forEach((select) => {
      const current = select.value;
      select.innerHTML = optionsHtml;
      if (categoryOrder.includes(current)) select.value = current;
    });

    container.querySelectorAll('.category-section').forEach((section) => {
      const key = section.dataset.categoryKey;
      const title = section.querySelector('.category-section-title');
      if (key && title) title.textContent = categoryLabels[key];
    });
  }

  // --- Load product data ---
  async function loadProducts() {
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load products (status ' + res.status + ')');
      productsData = await res.json();
      productsData.forEach((p) => {
        if (!Array.isArray(p.categories)) {
          p.categories = p.category ? [p.category] : [categoryOrder[0]];
        }
        delete p.category;

        // Older saved products used a numeric `stock` quantity — migrate
        // that to the new simple inStock boolean the first time they're
        // loaded here, so they don't fail validation until someone happens
        // to touch the toggle.
        if (typeof p.inStock !== 'boolean') {
          p.inStock = typeof p.stock === 'number' ? p.stock > 0 : true;
        }
        delete p.stock;
        if (!Array.isArray(p.sizes)) p.sizes = [];
        if (!Array.isArray(p.colors)) p.colors = [];
        // Older saved products (and the bundled defaults) only ever had a
        // single cover `image` — migrate that into a one-photo `images`
        // gallery array the first time it's loaded here, so index 0 always
        // mirrors the cover and the gallery editor has something to show.
        if (!Array.isArray(p.images) || !p.images.length) {
          p.images = p.image ? [p.image] : [];
        }
      });
      computeNextId();
      renderAll();
    } catch (err) {
      showBanner('Could not load the products: ' + err.message, 'error');
    }
  }

  function computeNextId() {
    let max = 0;
    productsData.forEach((p) => {
      if (typeof p.id === 'number' && p.id > max) max = p.id;
    });
    nextId = max + 1;
  }

  // --- Load coupons ---
  async function loadCoupons() {
    try {
      const res = await fetch('/api/coupons', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load coupons (status ' + res.status + ')');
      coupons = await res.json();
    } catch (err) {
      showBanner('Could not load coupons: ' + err.message, 'error');
    }
  }

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load settings (status ' + res.status + ')');
      const data = await res.json();
      const val = Number(data.deliveryCharge);
      deliveryCharge = Number.isFinite(val) && val >= 0 ? val : 0;
      const thresholdVal = Number(data.freeShippingThreshold);
      freeShippingThreshold =
        data.freeShippingThreshold != null && Number.isFinite(thresholdVal) && thresholdVal >= 0
          ? thresholdVal
          : null;
    } catch (err) {
      showBanner('Could not load delivery charge: ' + err.message, 'error');
    }
  }

  // --- Rendering ---
  // Products are grouped into one section per fixed category (in
  // VALID_CATEGORY_KEYS order), mirroring how they're organized on the
  // live storefront. Empty categories still render with a friendly
  // placeholder so a manager can immediately add the first item to them.
  function matchesSearch(product) {
    if (!searchTerm) return true;
    return String(product.name || '').toLowerCase().includes(searchTerm);
  }

  function renderAll() {
    container.innerHTML = '';
    let totalVisible = 0;
    categoryOrder.forEach((key) => {
      const { node, visibleCount } = renderCategorySection(key);
      totalVisible += visibleCount;
      // While searching, skip categories with zero matches entirely
      // instead of showing an empty section for each one.
      if (!(searchTerm && visibleCount === 0)) {
        container.appendChild(node);
      }
    });

    if (searchTerm && totalVisible === 0) {
      searchNoResultsTerm.textContent = searchTerm;
      searchNoResults.classList.remove('hidden');
    } else {
      searchNoResults.classList.add('hidden');
    }
  }

  function renderCategorySection(categoryKey) {
    const node = categorySectionTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.categoryKey = categoryKey;
    const title = node.querySelector('.category-section-title');
    const count = node.querySelector('.category-section-count');
    const grid = node.querySelector('.category-products-grid');

    title.textContent = categoryLabels[categoryKey];

  const items = productsData.filter((p) => Array.isArray(p.categories) && p.categories.includes(categoryKey));
    const visibleItems = items.filter(matchesSearch);
    count.textContent = searchTerm
      ? (visibleItems.length === 1 ? '1 match' : `${visibleItems.length} matches`)
      : (items.length === 1 ? '1 item' : `${items.length} items`);

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'category-empty-hint';
      empty.textContent = 'No products in this category yet.';
      grid.appendChild(empty);
    } else {
      items.forEach((product, idx) => {
        if (!matchesSearch(product)) return;
        grid.appendChild(renderProduct(product, categoryKey, idx === 0, idx === items.length - 1));
      });
    }
    return { node, visibleCount: visibleItems.length };
  }

function moveProduct(product, categoryKey, direction) {
    const sameCategory = productsData.filter((p) => Array.isArray(p.categories) && p.categories.includes(categoryKey));
    const posInCategory = sameCategory.indexOf(product);
    const swapWith = sameCategory[posInCategory + direction];
    if (!swapWith) return;
    const idxA = productsData.indexOf(product);
    const idxB = productsData.indexOf(swapWith);
    productsData[idxA] = swapWith;
    productsData[idxB] = product;
    renderAll();
  }

  // Drives one of a product card's Sizes / Colors chip editors. `field` is
  // 'sizes' or 'colors' on the product object (an array of strings). Renders
  // the current values as removable chips and wires the adjacent text
  // input + "+ Add" button (plus Enter-to-add) to push new values in,
  // de-duping case-insensitively so "Red" and "red" don't both get added.
  const variantChipTemplate = document.getElementById('variant-chip-template');

  function wireVariantList(node, product, field, listSelector, addInputSelector, addBtnSelector) {
    const list = node.querySelector(listSelector);
    const addInput = node.querySelector(addInputSelector);
    const addBtn = node.querySelector(addBtnSelector);
    if (!Array.isArray(product[field])) product[field] = [];

    function renderChips() {
      list.innerHTML = '';
      if (!product[field].length) {
        const empty = document.createElement('span');
        empty.className = 'variant-chip-empty';
        empty.textContent = 'None added yet';
        list.appendChild(empty);
        return;
      }
      product[field].forEach((value, idx) => {
        const chip = variantChipTemplate.content.firstElementChild.cloneNode(true);
        chip.querySelector('.variant-chip-label').textContent = value;
        chip.querySelector('.variant-chip-remove').addEventListener('click', () => {
          product[field].splice(idx, 1);
          renderChips();
        });
        list.appendChild(chip);
      });
    }

    function addValue() {
      const raw = addInput.value.trim();
      if (!raw) return;
      // Support comma-separated bulk entry (e.g. "S, M, L") in one go.
      const incoming = raw.split(',').map((v) => v.trim()).filter(Boolean);
      incoming.forEach((value) => {
        const exists = product[field].some((v) => v.toLowerCase() === value.toLowerCase());
        if (!exists) product[field].push(value);
      });
      addInput.value = '';
      renderChips();
      addInput.focus();
    }

    addBtn.addEventListener('click', addValue);
    addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addValue();
      }
    });

    renderChips();
  }

  function renderProduct(product, categoryKey, isFirst, isLast) {
    
    const node = productTemplate.content.firstElementChild.cloneNode(true);
    const img = node.querySelector('.product-photo-img');
    const galleryGrid = node.querySelector('.product-gallery-grid');
    const galleryAddInput = node.querySelector('.product-gallery-add-input');
    const galleryAddLabelText = node.querySelector('.product-gallery-add-label-text');
    const nameInput = node.querySelector('.p-name-input');
    const descInput = node.querySelector('.p-desc-input');
    const categoryBox = node.querySelector('.p-category-checkboxes');
    const priceInput = node.querySelector('.p-price-input');
    const inStockInput = node.querySelector('.p-instock-input');
    const discountInput = node.querySelector('.p-discount-input');
    const discountRow = node.querySelector('.discount-row');
    const oldPriceInput = node.querySelector('.p-oldprice-input');
    const saleTagInput = node.querySelector('.p-saletag-input');
    const deleteBtn = node.querySelector('.delete-product-btn');
    const moveUpBtn = node.querySelector('.move-up-btn');
    const moveDownBtn = node.querySelector('.move-down-btn');

    if (!Array.isArray(product.images) || !product.images.length) {
      product.images = product.image ? [product.image] : [];
    }

    moveUpBtn.disabled = !!isFirst;
    moveDownBtn.disabled = !!isLast;
    moveUpBtn.addEventListener('click', () => moveProduct(product, categoryKey, -1));
    moveDownBtn.addEventListener('click', () => moveProduct(product, categoryKey, 1));
    img.src = imageSrc(product.image);
    img.alt = product.name || '';
    nameInput.value = product.name || '';
    descInput.value = product.description || '';
    categoryBox.innerHTML = categoryCheckboxesHtml(product.categories);
    priceInput.value = product.price != null ? product.price : '';
    inStockInput.checked = product.inStock !== false;
    discountInput.checked = product.oldPrice != null;
    oldPriceInput.value = product.oldPrice != null ? product.oldPrice : '';
    saleTagInput.value = product.saleTag || '';
    discountRow.classList.toggle('hidden', !discountInput.checked);

    // Shows a live "Auto: X% Off" placeholder in the Badge Text field,
    // computed from Old Price vs Price, so a manager can see exactly what
    // badge will appear on the storefront without typing anything. Typing
    // a value into the field still overrides it with custom wording.
    function updateAutoBadgePlaceholder() {
      const oldP = parseFloat(oldPriceInput.value);
      const newP = parseFloat(priceInput.value);
      if (!Number.isNaN(oldP) && !Number.isNaN(newP) && oldP > newP && newP >= 0) {
        const pct = Math.round((1 - newP / oldP) * 100);
        saleTagInput.placeholder = `Auto: ${pct}% Off`;
      } else {
        saleTagInput.placeholder = 'e.g. 10% Off';
      }
    }
    updateAutoBadgePlaceholder();

    nameInput.addEventListener('input', () => { product.name = nameInput.value; });
    descInput.addEventListener('input', () => { product.description = descInput.value; });
    categoryBox.querySelectorAll('.p-category-checkbox').forEach((cb) => {
      cb.addEventListener('change', () => {
        product.categories = Array.from(categoryBox.querySelectorAll('.p-category-checkbox:checked')).map((c) => c.value);
        renderAll();
      });
    });
    priceInput.addEventListener('input', () => {
      const v = parseFloat(priceInput.value);
      product.price = Number.isNaN(v) ? 0 : v;
      updateAutoBadgePlaceholder();
    });
    inStockInput.addEventListener('change', () => {
      product.inStock = !!inStockInput.checked;
    });
    discountInput.addEventListener('change', () => {
      discountRow.classList.toggle('hidden', !discountInput.checked);
      if (discountInput.checked) {
        if (product.oldPrice == null) product.oldPrice = product.price || 0;
        oldPriceInput.value = product.oldPrice;
      } else {
        delete product.oldPrice;
        oldPriceInput.value = '';
        delete product.saleTag;
        saleTagInput.value = '';
      }
      updateAutoBadgePlaceholder();
    });
    oldPriceInput.addEventListener('input', () => {
      const v = parseFloat(oldPriceInput.value);
      product.oldPrice = Number.isNaN(v) ? 0 : v;
      updateAutoBadgePlaceholder();
    });
    // Left blank, the storefront falls back to an auto-computed "X% Off"
    // badge (see js/flash-sales-render.js) — this field just lets a manager
    // override that with custom wording (e.g. "Deal Of The Week", "BOGO").
    saleTagInput.addEventListener('input', () => {
      product.saleTag = saleTagInput.value.trim() || null;
    });

    wireVariantList(node, product, 'sizes', '.p-size-list', '.p-size-add-input', '.p-size-add-btn');
    wireVariantList(node, product, 'colors', '.p-color-list', '.p-color-add-input', '.p-color-add-btn');

    // Keeps the big cover preview and product.image in sync with whatever
    // is currently first in product.images — the same rule api/products.js
    // enforces server-side, so this can never drift from what gets saved.
    function syncCover() {
      const cover = product.images[0] || '';
      product.image = cover;
      img.src = imageSrc(cover);
    }

    function renderGalleryGrid() {
      galleryGrid.innerHTML = '';
      product.images.forEach((photo, idx) => {
        const node2 = productGalleryItemTemplate.content.firstElementChild.cloneNode(true);
        const photoImg = node2.querySelector('.product-gallery-img');
        const removeBtn = node2.querySelector('.product-gallery-remove');
        const moveLeftBtn = node2.querySelector('.product-gallery-move-left');
        const moveRightBtn = node2.querySelector('.product-gallery-move-right');
        const featureBtn = node2.querySelector('.product-gallery-feature');

        photoImg.src = imageSrc(photo);
        photoImg.alt = product.name || '';

        // At least one photo is required (every product needs a cover), so
        // the last remaining photo can't be removed.
        removeBtn.disabled = product.images.length <= 1;
        removeBtn.addEventListener('click', () => {
          if (product.images.length <= 1) return;
          if (!confirm('Remove this photo?')) return;
          product.images.splice(idx, 1);
          syncCover();
          renderGalleryGrid();
        });

        moveLeftBtn.disabled = idx === 0;
        moveRightBtn.disabled = idx === product.images.length - 1;
        moveLeftBtn.addEventListener('click', () => {
          [product.images[idx - 1], product.images[idx]] = [product.images[idx], product.images[idx - 1]];
          syncCover();
          renderGalleryGrid();
        });
        moveRightBtn.addEventListener('click', () => {
          [product.images[idx], product.images[idx + 1]] = [product.images[idx + 1], product.images[idx]];
          syncCover();
          renderGalleryGrid();
        });

        // The cover (index 0) is what shows on listing cards, the cart, and
        // wishlist — "making a photo the cover" just moves it to the front
        // of this product's own gallery, same pattern as reordering.
        node2.querySelector('.product-gallery-photo').classList.toggle('is-cover', idx === 0);
        featureBtn.disabled = idx === 0;
        featureBtn.title = idx === 0 ? 'This is the cover photo' : 'Make this the cover photo';
        featureBtn.addEventListener('click', () => {
          product.images.splice(idx, 1);
          product.images.unshift(photo);
          syncCover();
          renderGalleryGrid();
        });

        galleryGrid.appendChild(node2);
      });

      if (!product.images.length) {
        const empty = document.createElement('p');
        empty.className = 'product-gallery-hint';
        empty.textContent = 'No photos yet — click "+ Add Photo" below.';
        galleryGrid.appendChild(empty);
      }
    }
    renderGalleryGrid();

    galleryAddInput.addEventListener('change', async () => {
      // Supports selecting multiple photos at once (see `multiple` on the
      // input). The crop tool only handles one image at a time, so we walk
      // through the batch sequentially — crop, upload, append.
      const files = Array.from(galleryAddInput.files || []);
      galleryAddInput.value = ''; // allow re-selecting the same file(s) later
      if (!files.length) return;

      for (let i = 0; i < files.length; i++) {
        if (product.images.length >= MAX_GALLERY_PHOTOS) {
          showBanner(`Each product can have at most ${MAX_GALLERY_PHOTOS} photos.`, 'error');
          break;
        }
        const file = files[i];
        if (files.length > 1) {
          galleryAddLabelText.textContent = `Cropping ${i + 1} of ${files.length}…`;
        }
        const dataUrl = await openCropper(file);
        if (!dataUrl) continue; // manager cancelled the crop for this one — skip it, keep going

        try {
          if (files.length > 1) {
            galleryAddLabelText.textContent = `Uploading ${i + 1} of ${files.length}…`;
          }
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, dataUrl }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload failed');
          product.images.push(data.url);
          syncCover();
          renderGalleryGrid();
        } catch (err) {
          showBanner(`"${file.name}" failed to upload: ${err.message}`, 'error');
        }
      }

      galleryAddLabelText.textContent = '+ Add Photo';
    });

    deleteBtn.addEventListener('click', () => {
      if (!confirm(`Delete "${product.name || 'this product'}"?`)) return;
      const idx = productsData.indexOf(product);
      if (idx !== -1) productsData.splice(idx, 1);
      renderAll();
    });

    return node;
  }

  // Resizes/re-encodes an image client-side so uploads stay well under
  // Vercel's request body limit, before sending it to /api/upload.
  function compressImage(file, maxDimension, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the file'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Could not read the image'));
        image.onload = () => {
          let { width, height } = image;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height / width) * maxDimension);
              width = maxDimension;
            } else {
              width = Math.round((width / height) * maxDimension);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // --- Photo cropper ---
  // A small dependency-free crop tool: shows the picked photo in a modal
  // with a draggable/resizable crop box (default 3:4, matching the product
  // card aspect ratio). The manager can drag the box, drag a corner to
  // resize, or type exact width/height in pixels. Resolves to a cropped +
  // compressed JPEG data URL, or null if the manager cancels.
  const cropModal = document.getElementById('crop-modal');
  const cropStage = document.getElementById('crop-stage');
  const cropImageEl = document.getElementById('crop-image');
  const cropBoxEl = document.getElementById('crop-box');
  const cropHandles = Array.from(cropBoxEl.querySelectorAll('.crop-handle'));
  const cropWidthInput = document.getElementById('crop-width-input');
  const cropHeightInput = document.getElementById('crop-height-input');
  const cropLockAspect = document.getElementById('crop-lock-aspect');
  const cropApplyBtn = document.getElementById('crop-apply-btn');
  const cropCancelBtn = document.getElementById('crop-cancel-btn');
  const cropCloseX = document.getElementById('crop-close-x');

  const ASPECT_RATIO = 3 / 4; // width / height, matches .product-photo's aspect-ratio
  const MIN_BOX = 20; // minimum crop box size in *display* px
  const MAX_OUTPUT = 1000; // cap the longer output side, same limit the old compressor used

  let cropResolveFn = null;
  let cropView = null; // { scale, dispW, dispH }
  let cropBox = null; // { left, top, width, height } in display px
  let dragMode = null; // 'move' | 'nw' | 'ne' | 'sw' | 'se'
  let dragStart = null; // { x, y, box }

  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

  function openCropper(file) {
    return new Promise((resolve) => {
      cropResolveFn = resolve;
      const reader = new FileReader();
      reader.onerror = () => { cropResolveFn = null; resolve(null); };
      reader.onload = () => {
        cropImageEl.onload = () => {
          cropModal.classList.remove('hidden');
          document.body.style.overflow = 'hidden';
          initCropStage();
        };
        cropImageEl.onerror = () => { cropResolveFn = null; resolve(null); };
        cropImageEl.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function initCropStage() {
    const stageWrap = cropStage.parentElement;
    const maxW = Math.max(stageWrap.clientWidth - 24, 200);
    const maxH = window.innerWidth <= 480 ? window.innerHeight * 0.42 : 420;
    const nw = cropImageEl.naturalWidth;
    const nh = cropImageEl.naturalHeight;

    let scale = Math.min(maxW / nw, maxH / nh);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    if (scale > 2) scale = 2; // don't blow up tiny images too much

    const dispW = Math.round(nw * scale);
    const dispH = Math.round(nh * scale);
    cropView = { scale, dispW, dispH };

    cropStage.style.width = dispW + 'px';
    cropStage.style.height = dispH + 'px';
    cropImageEl.style.width = dispW + 'px';
    cropImageEl.style.height = dispH + 'px';

    // Default crop box: as large as possible at the target ratio, centered.
    let boxH = dispH * 0.9;
    let boxW = boxH * ASPECT_RATIO;
    if (boxW > dispW * 0.9) {
      boxW = dispW * 0.9;
      boxH = boxW / ASPECT_RATIO;
    }
    cropBox = { left: (dispW - boxW) / 2, top: (dispH - boxH) / 2, width: boxW, height: boxH };
    cropLockAspect.checked = true;
    renderCropBox();
  }

  function renderCropBox() {
    cropBoxEl.style.left = cropBox.left + 'px';
    cropBoxEl.style.top = cropBox.top + 'px';
    cropBoxEl.style.width = cropBox.width + 'px';
    cropBoxEl.style.height = cropBox.height + 'px';
    cropWidthInput.value = Math.round(cropBox.width / cropView.scale);
    cropHeightInput.value = Math.round(cropBox.height / cropView.scale);
  }

  // Corner drag: keep the opposite corner fixed as an anchor and move the
  // dragged corner, clamped to the image bounds and (optionally) the ratio.
  const ANCHOR_OF = {
    nw: (b) => ({ x: b.left + b.width, y: b.top + b.height }),
    ne: (b) => ({ x: b.left, y: b.top + b.height }),
    sw: (b) => ({ x: b.left + b.width, y: b.top }),
    se: (b) => ({ x: b.left, y: b.top }),
  };
  const MOVING_OF = {
    nw: (b) => ({ x: b.left, y: b.top }),
    ne: (b) => ({ x: b.left + b.width, y: b.top }),
    sw: (b) => ({ x: b.left, y: b.top + b.height }),
    se: (b) => ({ x: b.left + b.width, y: b.top + b.height }),
  };

  function resizeFromCorner(corner, dx, dy) {
    const anchor = ANCHOR_OF[corner](dragStart.box);
    const moving0 = MOVING_OF[corner](dragStart.box);
    const lock = cropLockAspect.checked;

    let movingX = clamp(moving0.x + dx, 0, cropView.dispW);
    let movingY = clamp(moving0.y + dy, 0, cropView.dispH);

    const signX = movingX >= anchor.x ? 1 : -1;
    const signY = movingY >= anchor.y ? 1 : -1;
    const maxRawW = signX > 0 ? cropView.dispW - anchor.x : anchor.x;
    const maxRawH = signY > 0 ? cropView.dispH - anchor.y : anchor.y;

    let rawW = clamp(Math.abs(movingX - anchor.x), MIN_BOX, maxRawW);
    let rawH;
    if (lock) {
      rawH = rawW / ASPECT_RATIO;
      if (rawH > maxRawH) {
        rawH = maxRawH;
        rawW = rawH * ASPECT_RATIO;
      }
      if (rawW > maxRawW) { rawW = maxRawW; rawH = rawW / ASPECT_RATIO; }
    } else {
      rawH = clamp(Math.abs(movingY - anchor.y), MIN_BOX, maxRawH);
    }

    const finalX = anchor.x + signX * rawW;
    const finalY = anchor.y + signY * rawH;

    cropBox = {
      left: Math.min(anchor.x, finalX),
      top: Math.min(anchor.y, finalY),
      width: rawW,
      height: rawH,
    };
  }

  cropBoxEl.addEventListener('pointerdown', (e) => {
    if (e.target !== cropBoxEl) return; // let handles handle their own drags
    dragMode = 'move';
    dragStart = { x: e.clientX, y: e.clientY, box: { ...cropBox } };
    cropBoxEl.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  cropHandles.forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
      dragMode = handle.dataset.corner;
      dragStart = { x: e.clientX, y: e.clientY, box: { ...cropBox } };
      handle.setPointerCapture(e.pointerId);
      e.stopPropagation();
      e.preventDefault();
    });
  });

  cropStage.addEventListener('pointermove', (e) => {
    if (!dragMode || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (dragMode === 'move') {
      const left = clamp(dragStart.box.left + dx, 0, cropView.dispW - dragStart.box.width);
      const top = clamp(dragStart.box.top + dy, 0, cropView.dispH - dragStart.box.height);
      cropBox = { ...dragStart.box, left, top };
    } else {
      resizeFromCorner(dragMode, dx, dy);
    }
    renderCropBox();
  });

  window.addEventListener('pointerup', () => { dragMode = null; dragStart = null; });

  // Typing exact width/height keeps the top-left corner anchored.
  cropWidthInput.addEventListener('input', () => {
    if (!cropView || !cropBox) return;
    let natW = parseInt(cropWidthInput.value, 10);
    if (Number.isNaN(natW)) return;
    let width = clamp(natW * cropView.scale, MIN_BOX, cropView.dispW - cropBox.left);
    let height = cropLockAspect.checked ? width / ASPECT_RATIO : cropBox.height;
    if (cropLockAspect.checked && height > cropView.dispH - cropBox.top) {
      height = cropView.dispH - cropBox.top;
      width = height * ASPECT_RATIO;
    }
    cropBox = { ...cropBox, width, height };
    renderCropBox();
  });

  cropHeightInput.addEventListener('input', () => {
    if (!cropView || !cropBox) return;
    let natH = parseInt(cropHeightInput.value, 10);
    if (Number.isNaN(natH)) return;
    let height = clamp(natH * cropView.scale, MIN_BOX, cropView.dispH - cropBox.top);
    let width = cropLockAspect.checked ? height * ASPECT_RATIO : cropBox.width;
    if (cropLockAspect.checked && width > cropView.dispW - cropBox.left) {
      width = cropView.dispW - cropBox.left;
      height = width / ASPECT_RATIO;
    }
    cropBox = { ...cropBox, width, height };
    renderCropBox();
  });

  cropLockAspect.addEventListener('change', () => {
    if (!cropLockAspect.checked || !cropView || !cropBox) return;
    // Snap the current box back to the target ratio, anchored top-left.
    let width = cropBox.width;
    let height = width / ASPECT_RATIO;
    if (cropBox.top + height > cropView.dispH) {
      height = cropView.dispH - cropBox.top;
      width = height * ASPECT_RATIO;
    }
    cropBox = { ...cropBox, width, height };
    renderCropBox();
  });

  function closeCropper() {
    cropModal.classList.add('hidden');
    document.body.style.overflow = '';
    cropImageEl.src = '';
    dragMode = null;
    dragStart = null;
  }

  function applyCrop() {
    if (!cropView || !cropBox) return;
    const sx = Math.round(cropBox.left / cropView.scale);
    const sy = Math.round(cropBox.top / cropView.scale);
    const sw = Math.round(cropBox.width / cropView.scale);
    const sh = Math.round(cropBox.height / cropView.scale);

    let outW = sw;
    let outH = sh;
    if (Math.max(outW, outH) > MAX_OUTPUT) {
      const s = MAX_OUTPUT / Math.max(outW, outH);
      outW = Math.round(outW * s);
      outH = Math.round(outH * s);
    }

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cropImageEl, sx, sy, sw, sh, 0, 0, outW, outH);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    const resolve = cropResolveFn;
    cropResolveFn = null;
    closeCropper();
    if (resolve) resolve(dataUrl);
  }

  function cancelCropper() {
    const resolve = cropResolveFn;
    cropResolveFn = null;
    closeCropper();
    if (resolve) resolve(null);
  }

  cropApplyBtn.addEventListener('click', applyCrop);
  cropCancelBtn.addEventListener('click', cancelCropper);
  cropCloseX.addEventListener('click', cancelCropper);
  cropModal.addEventListener('click', (e) => { if (e.target === cropModal) cancelCropper(); });

  // --- Manage Categories modal ---
  // Each row in the list is either an existing category (data-original-key
  // set to its real, unchangeable key — only its label can be edited) or a
  // brand-new one added this session (data-original-key="" — a key is
  // slugified from its label only once Save Categories is clicked).

  function buildCategoryRow(originalKey, label) {
    const row = document.createElement('div');
    row.className = 'category-row';
    row.dataset.originalKey = originalKey || '';

    const reorder = document.createElement('div');
    reorder.className = 'category-row-reorder';
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'btn-icon-light category-move-up-btn';
    upBtn.title = 'Move up';
    upBtn.setAttribute('aria-label', 'Move category up');
    upBtn.innerHTML = '&#9650;';
    upBtn.addEventListener('click', () => moveCategoryRow(row, -1));
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn-icon-light category-move-down-btn';
    downBtn.title = 'Move down';
    downBtn.setAttribute('aria-label', 'Move category down');
    downBtn.innerHTML = '&#9660;';
    downBtn.addEventListener('click', () => moveCategoryRow(row, 1));
    reorder.appendChild(upBtn);
    reorder.appendChild(downBtn);

    const field = document.createElement('label');
    field.className = 'crop-field';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'category-label-input';
    input.placeholder = 'e.g. Kids Wear';
    input.value = label || '';
    field.appendChild(input);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger btn-sm category-row-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => startDeleteConfirm(row));

    row.appendChild(reorder);
    row.appendChild(field);
    row.appendChild(deleteBtn);
    return row;
  }

  // Moves a category row up/down in the DOM (direction -1 = up, +1 = down).
  // The Save Categories handler reads rows in their current DOM order, so
  // reordering here is all that's needed to change the saved/published order.
  function moveCategoryRow(row, direction) {
    if (direction === -1) {
      const prev = row.previousElementSibling;
      if (prev) categoriesFieldsContainer.insertBefore(row, prev);
    } else {
      const next = row.nextElementSibling;
      if (next) categoriesFieldsContainer.insertBefore(next, row);
    }
    refreshCategoryRowStates();
  }

  // Disables the up arrow on the first row and the down arrow on the last
  // row. Call after anything that adds, removes, or reorders rows.
  function refreshCategoryRowStates() {
    const rows = Array.from(categoriesFieldsContainer.querySelectorAll('.category-row'));
    rows.forEach((row, idx) => {
      const upBtn = row.querySelector('.category-move-up-btn');
      const downBtn = row.querySelector('.category-move-down-btn');
      if (upBtn) upBtn.disabled = idx === 0;
      if (downBtn) downBtn.disabled = idx === rows.length - 1;
    });
  }

  function startDeleteConfirm(row) {
    if (categoriesFieldsContainer.querySelectorAll('.category-row').length <= 1) {
      showBanner('You need at least one category — add another before deleting this one.', 'error');
      return;
    }

    const savedReorder = row.querySelector('.category-row-reorder');
    const savedField = row.querySelector('.crop-field');
    const savedDeleteBtn = row.querySelector('.category-row-delete-btn');
    row.innerHTML = '';

    const confirmWrap = document.createElement('div');
    confirmWrap.className = 'category-delete-confirm';

    const span = document.createElement('span');
    span.textContent = 'Type DELETE to confirm:';

    const confirmInput = document.createElement('input');
    confirmInput.type = 'text';
    confirmInput.placeholder = 'DELETE';
    confirmInput.autocomplete = 'off';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-danger btn-sm';
    confirmBtn.textContent = 'Confirm Delete';
    confirmBtn.disabled = true;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-ghost btn-sm';
    cancelBtn.textContent = 'Cancel';

    confirmInput.addEventListener('input', () => {
      confirmBtn.disabled = confirmInput.value.trim().toUpperCase() !== 'DELETE';
    });
    confirmBtn.addEventListener('click', () => {
      if (confirmInput.value.trim().toUpperCase() !== 'DELETE') return;
      row.remove();
      refreshCategoryRowStates();
    });
    cancelBtn.addEventListener('click', () => {
      row.innerHTML = '';
      row.appendChild(savedReorder);
      row.appendChild(savedField);
      row.appendChild(savedDeleteBtn);
    });

    confirmWrap.appendChild(span);
    confirmWrap.appendChild(confirmInput);
    confirmWrap.appendChild(confirmBtn);
    confirmWrap.appendChild(cancelBtn);
    row.appendChild(confirmWrap);
    confirmInput.focus();
  }

  function addCategoryRow() {
    const row = buildCategoryRow('', '');
    categoriesFieldsContainer.appendChild(row);
    refreshCategoryRowStates();
    const input = row.querySelector('.category-label-input');
    if (input) input.focus();
  }

  function openCategoriesModal() {
    categoriesFieldsContainer.innerHTML = '';
    categoryOrder.forEach((key) => {
      categoriesFieldsContainer.appendChild(buildCategoryRow(key, categoryLabels[key]));
    });
    refreshCategoryRowStates();
    categoriesModal.classList.remove('hidden');
  }

  function closeCategoriesModal() {
    categoriesModal.classList.add('hidden');
  }

  categoriesAddBtn.addEventListener('click', addCategoryRow);
  editCategoriesBtn.addEventListener('click', openCategoriesModal);
  categoriesCloseX.addEventListener('click', closeCategoriesModal);
  categoriesCancelBtn.addEventListener('click', closeCategoriesModal);
  categoriesModal.addEventListener('click', (e) => {
    if (e.target === categoriesModal) closeCategoriesModal();
  });

  categoriesSaveBtn.addEventListener('click', async () => {
    const rows = Array.from(categoriesFieldsContainer.querySelectorAll('.category-row'));
    if (!rows.length) {
      showBanner('At least one category is required.', 'error');
      return;
    }

    const updated = {};
    const keptOriginalKeys = new Set();
    const takenKeys = new Set();
    let hasError = false;

    // First pass: keep every existing category's key stable and reserve it,
    // so a new category's generated slug can never collide with one.
    rows.forEach((row) => {
      const originalKey = row.dataset.originalKey;
      if (originalKey) takenKeys.add(originalKey);
    });

    rows.forEach((row) => {
      const input = row.querySelector('.category-label-input');
      const label = input ? input.value.trim() : '';
      if (!label) { hasError = true; return; }

      const originalKey = row.dataset.originalKey;
      if (originalKey) {
        updated[originalKey] = label;
        keptOriginalKeys.add(originalKey);
      } else {
        const key = slugifyCategoryKey(label, takenKeys);
        takenKeys.add(key);
        updated[key] = label;
      }
    });

    if (hasError) {
      showBanner('Every category needs a label.', 'error');
      return;
    }

    const removedKeys = categoryOrder.filter((key) => !keptOriginalKeys.has(key));
    const fallbackKey = Object.keys(updated)[0];

    categoriesSaveBtn.disabled = true;
    categoriesSaveBtn.textContent = 'Saving…';
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save categories');

      categoryLabels = updated;
      categoryOrder = Object.keys(updated);

      // Any products that were sitting in a now-deleted category get moved
      // into the first remaining category instead of silently disappearing.
      let reassignedCount = 0;
      if (removedKeys.length) {
        productsData.forEach((product) => {
          if (Array.isArray(product.categories) && product.categories.some((c) => removedKeys.includes(c))) {
            product.categories = product.categories.filter((c) => !removedKeys.includes(c));
            if (product.categories.length === 0) product.categories = [fallbackKey];
            reassignedCount++;
          }
        });
        if (reassignedCount) {
          const prodRes = await fetch('/api/products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productsData),
          });
          if (!prodRes.ok) {
            const prodData = await prodRes.json().catch(() => ({}));
            throw new Error(
              'Categories saved, but moving ' + reassignedCount +
              ' product(s) out of the deleted categor' + (reassignedCount === 1 ? 'y' : 'ies') +
              ' failed: ' + (prodData.error || 'unknown error')
            );
          }
        }
      }

      applyCategoryLabels();
      renderAll();
      closeCategoriesModal();
      showBanner(
        reassignedCount
          ? `Categories updated — ${reassignedCount} product(s) moved into "${categoryLabels[fallbackKey]}". Changes are live now.`
          : 'Categories updated — changes are live on the site now.',
        'success'
      );
    } catch (err) {
      showBanner('Could not save categories: ' + err.message, 'error');
    } finally {
      categoriesSaveBtn.disabled = false;
      categoriesSaveBtn.textContent = 'Save Categories';
    }
  });

  // --- Manage Coupons modal ---
  // Each row is a code + a discount percent + an Active toggle. Deleting a
  // row is a plain confirm() (unlike categories, deleting a coupon has no
  // knock-on effect on products, so the heavier DELETE-to-confirm flow
  // isn't needed here).

  function buildCouponRow(code, percent, active) {
    const row = document.createElement('div');
    row.className = 'coupon-row';

    const codeField = document.createElement('label');
    codeField.className = 'crop-field coupon-code-field';
    const codeSpan = document.createElement('span');
    codeSpan.textContent = 'Code';
    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.className = 'coupon-code-input';
    codeInput.placeholder = 'e.g. SAVE10';
    codeInput.autocomplete = 'off';
    codeInput.value = code || '';
    codeField.appendChild(codeSpan);
    codeField.appendChild(codeInput);

    const percentField = document.createElement('label');
    percentField.className = 'crop-field coupon-percent-field';
    const percentSpan = document.createElement('span');
    percentSpan.textContent = 'Discount %';
    const percentInput = document.createElement('input');
    percentInput.type = 'number';
    percentInput.className = 'coupon-percent-input';
    percentInput.min = '1';
    percentInput.max = '100';
    percentInput.step = '1';
    percentInput.placeholder = '10';
    percentInput.value = percent != null ? percent : '';
    percentField.appendChild(percentSpan);
    percentField.appendChild(percentInput);

    const activeLabel = document.createElement('label');
    activeLabel.className = 'checkbox-label coupon-active-label';
    const activeInput = document.createElement('input');
    activeInput.type = 'checkbox';
    activeInput.className = 'coupon-active-input';
    activeInput.checked = active !== false;
    activeLabel.appendChild(activeInput);
    activeLabel.appendChild(document.createTextNode(' Active'));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger btn-sm coupon-row-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      if (!confirm(`Delete coupon "${codeInput.value.trim() || 'this coupon'}"?`)) return;
      row.remove();
    });

    row.appendChild(codeField);
    row.appendChild(percentField);
    row.appendChild(activeLabel);
    row.appendChild(deleteBtn);
    return row;
  }

  function addCouponRow() {
    const row = buildCouponRow('', '', true);
    couponsFieldsContainer.appendChild(row);
    const input = row.querySelector('.coupon-code-input');
    if (input) input.focus();
  }

  function openCouponsModal() {
    couponsFieldsContainer.innerHTML = '';
    if (!coupons.length) {
      couponsFieldsContainer.appendChild(buildCouponRow('', '', true));
    } else {
      coupons.forEach((c) => {
        couponsFieldsContainer.appendChild(buildCouponRow(c.code, c.percent, c.active !== false));
      });
    }
    couponsModal.classList.remove('hidden');
  }

  function closeCouponsModal() {
    couponsModal.classList.add('hidden');
  }

  couponsAddBtn.addEventListener('click', addCouponRow);
  editCouponsBtn.addEventListener('click', openCouponsModal);
  couponsCloseX.addEventListener('click', closeCouponsModal);
  couponsCancelBtn.addEventListener('click', closeCouponsModal);
  couponsModal.addEventListener('click', (e) => {
    if (e.target === couponsModal) closeCouponsModal();
  });

  couponsSaveBtn.addEventListener('click', async () => {
    const rows = Array.from(couponsFieldsContainer.querySelectorAll('.coupon-row'));
    const updated = [];
    const seenCodes = new Set();
    let errorMsg = null;

    for (const row of rows) {
      const codeInput = row.querySelector('.coupon-code-input');
      const percentInput = row.querySelector('.coupon-percent-input');
      const activeInput = row.querySelector('.coupon-active-input');
      const codeRaw = codeInput ? codeInput.value.trim() : '';
      const percentRaw = percentInput ? percentInput.value.trim() : '';

      // Skip a completely empty leftover row (e.g. "+ Add Coupon" clicked
      // then left blank) instead of erroring on it.
      if (!codeRaw && !percentRaw) continue;

      if (!codeRaw) { errorMsg = 'Every coupon needs a code.'; break; }
      const code = codeRaw.toUpperCase();
      if (!/^[A-Z0-9-]+$/.test(code)) {
        errorMsg = `Coupon code "${codeRaw}" can only contain letters, numbers, and dashes.`;
        break;
      }
      if (seenCodes.has(code)) { errorMsg = `Duplicate coupon code: ${code}`; break; }
      seenCodes.add(code);

      const percent = Number(percentRaw);
      if (!percentRaw || Number.isNaN(percent) || percent <= 0 || percent > 100) {
        errorMsg = `Coupon "${code}" needs a discount percent between 1 and 100.`;
        break;
      }

      updated.push({ code, percent, active: !!(activeInput && activeInput.checked) });
    }

    if (errorMsg) {
      showBanner(errorMsg, 'error');
      return;
    }

    couponsSaveBtn.disabled = true;
    couponsSaveBtn.textContent = 'Saving…';
    try {
      const res = await fetch('/api/coupons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save coupons');

      coupons = updated;
      closeCouponsModal();
      showBanner('Coupons updated — changes are live on the site now.', 'success');
    } catch (err) {
      showBanner('Could not save coupons: ' + err.message, 'error');
    } finally {
      couponsSaveBtn.disabled = false;
      couponsSaveBtn.textContent = 'Save Coupons';
    }
  });

  // --- Manage Delivery Charge modal ---
  // A single store-wide flat delivery fee (Rs.), added on top of the cart
  // subtotal at checkout. Simple single-field modal, saved straight to
  // /api/settings — no product/category save needed alongside it.

  function openDeliveryModal() {
    deliveryChargeInput.value = deliveryCharge || 0;
    freeShippingThresholdInput.value = freeShippingThreshold != null ? freeShippingThreshold : '';
    deliveryModal.classList.remove('hidden');
    deliveryChargeInput.focus();
  }

  function closeDeliveryModal() {
    deliveryModal.classList.add('hidden');
  }

  editDeliveryBtn.addEventListener('click', openDeliveryModal);
  deliveryCloseX.addEventListener('click', closeDeliveryModal);
  deliveryCancelBtn.addEventListener('click', closeDeliveryModal);
  deliveryModal.addEventListener('click', (e) => {
    if (e.target === deliveryModal) closeDeliveryModal();
  });

  deliverySaveBtn.addEventListener('click', async () => {
    const raw = deliveryChargeInput.value.trim();
    const value = Number(raw);
    if (!raw || Number.isNaN(value) || !Number.isFinite(value) || value < 0) {
      showBanner('Delivery charge must be a non-negative number.', 'error');
      return;
    }

    const thresholdRaw = freeShippingThresholdInput.value.trim();
    let thresholdValue = null;
    if (thresholdRaw) {
      thresholdValue = Number(thresholdRaw);
      if (Number.isNaN(thresholdValue) || !Number.isFinite(thresholdValue) || thresholdValue < 0) {
        showBanner('Free shipping threshold must be a non-negative number (or left empty to disable it).', 'error');
        return;
      }
    }

    deliverySaveBtn.disabled = true;
    deliverySaveBtn.textContent = 'Saving…';
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryCharge: value, freeShippingThreshold: thresholdValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save delivery charge');

      deliveryCharge = value;
      freeShippingThreshold = thresholdValue;
      closeDeliveryModal();
      showBanner('Delivery settings updated — changes are live on the site now.', 'success');
    } catch (err) {
      showBanner('Could not save delivery settings: ' + err.message, 'error');
    } finally {
      deliverySaveBtn.disabled = false;
      deliverySaveBtn.textContent = 'Save Delivery Charge';
    }
  });

  // --- Add product ---
  document.getElementById('add-product-btn').addEventListener('click', () => {
    const defaultCategory = categoryOrder[0];
    const newProduct = {
      id: nextId++,
      name: '',
      categories: [defaultCategory],
      price: 0,
      oldPrice: null,
      saleTag: null,
      inStock: true,
      sizes: [],
      colors: [],
      image: '',
      images: [],
    };
    productsData.push(newProduct);
    renderAll();
    const section = container.querySelector(`.category-section[data-category-key="${defaultCategory}"]`);
    const lastCard = section && section.querySelector('.product-card:last-of-type');
    if (lastCard) {
      lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const nameField = lastCard.querySelector('.p-name-input');
      if (nameField) nameField.focus();
    }
  });

  // --- Save ---
  saveBtn.addEventListener('click', async () => {
    hideBanner();
    const validationError = validate();
    if (validationError) {
      showBanner(validationError, 'error');
      return;
    }
    saveBtn.disabled = true;
    saveStatus.textContent = 'Saving…';
    saveStatus.className = 'save-status';
    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productsData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      saveStatus.textContent = 'Saved ✓';
      saveStatus.className = 'save-status ok';
      showBanner('Products saved. Changes are live on the site now.', 'success');
    } catch (err) {
      saveStatus.textContent = 'Save failed';
      saveStatus.className = 'save-status err';
      showBanner('Could not save: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      setTimeout(() => { saveStatus.textContent = ''; }, 4000);
    }
  });

  function validate() {
    const seenIds = new Set();
    for (const product of productsData) {
      if (!product.name || !product.name.trim()) {
        return 'Every product needs a name.';
      }
      if (!product.image) {
        return `"${product.name}" needs a photo.`;
      }
      if (Array.isArray(product.images) && product.images.length > MAX_GALLERY_PHOTOS) {
        return `"${product.name}" can have at most ${MAX_GALLERY_PHOTOS} photos (cover + ${MAX_GALLERY_PHOTOS - 1} extra).`;
      }
      if (product.price == null || Number.isNaN(product.price) || product.price < 0) {
        return `"${product.name}" needs a valid price.`;
      }
      if (typeof product.inStock !== 'boolean') {
        return `"${product.name}" needs a valid stock status.`;
      }
      if (product.oldPrice != null) {
        if (Number.isNaN(product.oldPrice) || product.oldPrice < 0) {
          return `"${product.name}" needs a valid old price for its discount.`;
        }
        if (product.oldPrice <= product.price) {
          return `"${product.name}"'s old price must be higher than its current price for the discount to show.`;
        }
      }
      if (product.saleTag != null && typeof product.saleTag !== 'string') {
        return `"${product.name}" has an invalid badge text.`;
      }
      if (seenIds.has(product.id)) {
        return `Duplicate product id detected for "${product.name}". Please refresh and try again.`;
      }
      seenIds.add(product.id);
    }
    return null;
  }

  // --- Logout ---
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/admin/login.html';
  });

  // --- Product search ---
  productSearchInput.addEventListener('input', () => {
    searchTerm = productSearchInput.value.trim().toLowerCase();
    renderAll();
  });
  productSearchClear.addEventListener('click', () => {
    productSearchInput.value = '';
    searchTerm = '';
    renderAll();
    productSearchInput.focus();
  });

  checkSession();
})();