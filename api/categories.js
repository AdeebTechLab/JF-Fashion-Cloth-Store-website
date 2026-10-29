const fs = require('fs');
const path = require('path');
const { getSessionFromRequest, readJsonBody } = require('../lib/auth');

const CATEGORIES_PATHNAME = 'categories-data.json';

// Category keys used to be a fixed set of 5. Categories are now fully
// dynamic — an admin can add or delete them from the Manage Categories
// modal — so this just validates shape/content generically instead of
// checking against a hardcoded list.
const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function loadBundledDefault() {
  const filePath = path.join(__dirname, '..', 'data', 'categories-data.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function validateCategories(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Category data must be an object';
  }
  const keys = Object.keys(data);
  if (keys.length === 0) {
    return 'At least one category is required';
  }
  for (const key of keys) {
    if (!KEY_PATTERN.test(key)) {
      return `Invalid category key "${key}"`;
    }
    if (typeof data[key] !== 'string' || !data[key].trim()) {
      return `Category "${key}" needs a non-empty label`;
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
      const blob = await head(CATEGORIES_PATHNAME);
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
        res.status(500).json({ error: 'Could not load category data: ' + err.message });
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

    const validationError = validateCategories(body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    try {
      const { put } = require('@vercel/blob');
      await put(CATEGORIES_PATHNAME, JSON.stringify(body, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({
        error:
          'Failed to save categories. Make sure Vercel Blob storage is connected to this project (' +
          err.message +
          ')',
      });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
