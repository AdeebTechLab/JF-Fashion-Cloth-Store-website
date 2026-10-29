const { getSessionFromRequest, readJsonBody } = require('../lib/auth');

// Vercel Functions cap request bodies at 4.5MB. The admin panel compresses
// photos client-side before sending them, but we double-check here too.
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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

  const { filename, dataUrl } = body || {};
  if (!filename || !dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    res.status(400).json({ error: 'Missing filename or image data' });
    return;
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!match) {
    res.status(400).json({ error: 'Invalid image data URL' });
    return;
  }
  const contentType = match[1];
  if (!contentType.startsWith('image/')) {
    res.status(400).json({ error: 'Only image uploads are allowed' });
    return;
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) {
    res.status(400).json({ error: 'Image is too large after compression. Please use a smaller photo.' });
    return;
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);

  try {
    const { put } = require('@vercel/blob');
    const blob = await put(`product-images/${Date.now()}-${safeName}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
    });
    res.status(200).json({ url: blob.url });
  } catch (err) {
    res.status(500).json({
      error:
        'Upload failed. Make sure Vercel Blob storage is connected to this project (' + err.message + ')',
    });
  }
};
