const fs = require('fs');
const path = require('path');
const { getSessionFromRequest, readJsonBody } = require('../lib/auth');

const PRODUCTS_PATHNAME = 'products-data.json';
// Categories are now a dynamic, admin-editable set (see api/categories.js),
// so we can't check product.category against a fixed list here. Just make
// sure it's a non-empty slug-shaped string; api/categories.js is the single
// source of truth for which categories actually exist.
const CATEGORY_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Cover photo + up to 5 extra gallery photos per product.
const MAX_GALLERY_PHOTOS = 6;

function loadBundledDefault() {
  const filePath = path.join(__dirname, '..', 'data', 'products-data.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function validateProducts(data) {
  if (!Array.isArray(data)) return 'Product data must be an array';
  const seenIds = new Set();
  for (const product of data) {
    if (!product || typeof product !== 'object') return 'Each product must be an object';
    if (typeof product.id !== 'number' || Number.isNaN(product.id)) {
      return 'Every product needs a numeric id';
    }
    if (seenIds.has(product.id)) return `Duplicate product id: ${product.id}`;
    seenIds.add(product.id);

    if (typeof product.name !== 'string' || !product.name.trim()) {
      return `Product ${product.id} needs a non-empty name`;
    }
    if (!Array.isArray(product.categories) || product.categories.length === 0 ||
        product.categories.some((c) => typeof c !== 'string' || !CATEGORY_KEY_PATTERN.test(c))) {
      return `Product "${product.name}" needs at least one valid category`;
    }
    if (typeof product.price !== 'number' || Number.isNaN(product.price) || product.price < 0) {
      return `Product "${product.name}" needs a valid non-negative price`;
    }
    if (product.oldPrice != null) {
      if (typeof product.oldPrice !== 'number' || Number.isNaN(product.oldPrice) || product.oldPrice < 0) {
        return `Product "${product.name}" has an invalid old price for its discount`;
      }
      if (product.oldPrice <= product.price) {
        return `Product "${product.name}"'s old price must be higher than its current price`;
      }
    }
    if (product.saleTag != null && typeof product.saleTag !== 'string') {
      return `Product "${product.name}" has an invalid badge text`;
    }
    if (product.description != null && typeof product.description !== 'string') {
  return `Product "${product.name}" has an invalid description`;
}
    if (typeof product.inStock !== 'boolean') {
      return `Product "${product.name}" needs a valid stock status (in stock or out of stock)`;
    }
    if (product.sizes != null) {
      if (!Array.isArray(product.sizes) || product.sizes.some((s) => typeof s !== 'string')) {
        return `Product "${product.name}" has invalid sizes`;
      }
    }
    if (product.colors != null) {
      if (!Array.isArray(product.colors) || product.colors.some((c) => typeof c !== 'string')) {
        return `Product "${product.name}" has invalid colors`;
      }
    }
    if (typeof product.image !== 'string' || !product.image.trim()) {
      return `Product "${product.name}" needs an image`;
    }
    // `images` is the optional multi-photo gallery shown on the product
    // detail page (index 0 is always kept in sync with `image`, the cover
    // used on listing cards). Absent/empty means "just the cover photo".
    if (product.images != null) {
      if (!Array.isArray(product.images) || product.images.length === 0) {
        return `Product "${product.name}" has invalid gallery photos`;
      }
      if (product.images.length > MAX_GALLERY_PHOTOS) {
        return `Product "${product.name}" can have at most ${MAX_GALLERY_PHOTOS} gallery photos`;
      }
      if (product.images.some((s) => typeof s !== 'string' || !s.trim())) {
        return `Product "${product.name}" has an invalid gallery photo`;
      }
    }
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Try the live, admin-edited copy in Vercel Blob first. Fall back to the
    // JSON file bundled in the deployment so the site keeps working even
    // before Blob storage has been set up or before any edits have been saved.
    try {
      const { head } = require('@vercel/blob');
      const blob = await head(PRODUCTS_PATHNAME);
      const response = await fetch(blob.url, { cache: 'no-store' });
      if (!response.ok) throw new Error('blob fetch failed');
      const data = await response.json();
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(data);
    } catch {
      try {
        const data = loadBundledDefault();
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json(data);
      } catch (err) {
        res.status(500).json({ error: 'Could not load product data: ' + err.message });
      }
    }
    return;
  }

  if (req.method === 'PUT') {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const validationError = validateProducts(body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    // Keep the cover (`image`, used on listing cards/cart/wishlist) in sync
    // with the first gallery photo whenever a gallery is present, so the
    // two can never drift apart even if a client sent them out of sync.
    const normalized = body.map((product) =>
      Array.isArray(product.images) && product.images.length
        ? { ...product, image: product.images[0] }
        : product
    );

    try {
      const { put } = require('@vercel/blob');
      await put(PRODUCTS_PATHNAME, JSON.stringify(normalized, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error:
          'Failed to save products. Make sure Vercel Blob storage is connected to this project (' +
          err.message +
          ')',
      });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
