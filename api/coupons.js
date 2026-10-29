const fs = require('fs');
const path = require('path');
const { getSessionFromRequest, readJsonBody } = require('../lib/auth');

const COUPONS_PATHNAME = 'coupons-data.json';

// Codes are normalized to uppercase letters/numbers/dashes so "save10",
// "Save10", and "SAVE10" all match the same coupon on the storefront.
const CODE_PATTERN = /^[A-Z0-9-]+$/;

function loadBundledDefault() {
  const filePath = path.join(__dirname, '..', 'data', 'coupons-data.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

// Validates the list in place and normalizes each coupon's `code` to
// uppercase and `active` to a boolean, so what gets saved is always clean
// even if the admin UI ever sends something slightly off.
function validateCoupons(data) {
  if (!Array.isArray(data)) return 'Coupon data must be an array';
  const seenCodes = new Set();
  for (const coupon of data) {
    if (!coupon || typeof coupon !== 'object') return 'Each coupon must be an object';
    if (typeof coupon.code !== 'string' || !coupon.code.trim()) {
      return 'Every coupon needs a code';
    }
    const code = coupon.code.trim().toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      return `Coupon code "${coupon.code}" can only contain letters, numbers, and dashes`;
    }
    if (seenCodes.has(code)) return `Duplicate coupon code: ${code}`;
    seenCodes.add(code);
    coupon.code = code;

    if (typeof coupon.percent !== 'number' || Number.isNaN(coupon.percent) || coupon.percent <= 0 || coupon.percent > 100) {
      return `Coupon "${code}" needs a discount percent between 1 and 100`;
    }
    coupon.active = coupon.active !== false;
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Try the live, admin-edited copy in Vercel Blob first. Fall back to the
    // JSON file bundled in the deployment so the site keeps working even
    // before Blob storage has been set up or before any coupons exist yet.
    try {
      const { head } = require('@vercel/blob');
      const blob = await head(COUPONS_PATHNAME);
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
        res.status(500).json({ error: 'Could not load coupon data: ' + err.message });
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

    const validationError = validateCoupons(body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    try {
      const { put } = require('@vercel/blob');
      await put(COUPONS_PATHNAME, JSON.stringify(body, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error:
          'Failed to save coupons. Make sure Vercel Blob storage is connected to this project (' +
          err.message +
          ')',
      });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
