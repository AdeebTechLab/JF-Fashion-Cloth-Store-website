const { createSessionCookie, safeCompare, readJsonBody, isRateLimited } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Throttle repeated attempts from the same client on this warm instance.
  const clientKey = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
  if (isRateLimited(clientKey)) {
    res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
    return;
  }

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;

  if (!validUser || !validPass) {
    res.status(500).json({
      error:
        'Admin credentials are not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in your Vercel project environment variables.',
    });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const { username, password } = body || {};

  if (!username || !password || !safeCompare(username, validUser) || !safeCompare(password, validPass)) {
    // Same generic message either way, so failed attempts don't reveal
    // whether the username or password was the wrong part.
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  let cookie;
  try {
    cookie = createSessionCookie(username);
  } catch (err) {
    res.status(500).json({ error: err.message });
    return;
  }

  res.setHeader('Set-Cookie', cookie);
  res.status(200).json({ ok: true });
};
