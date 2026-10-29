// Lightweight local dev server (replacement for `vercel dev`).
// Serves the static storefront + admin panel, routes /api/* to the
// serverless functions in api/, and emulates Vercel Blob with plain
// files on disk so saving/edits work locally without any cloud setup.
//
// Run:  node server.js   (then open http://localhost:3000/admin/login.html)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const STORE_DIR = path.join(ROOT, '.local-store');

// ---------------------------------------------------------------------------
// 1. Load environment (defaults for local dev; .env wins, real env wins above it)
// ---------------------------------------------------------------------------
function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadDotEnv();

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
  console.warn('[local-dev] ADMIN_USERNAME/ADMIN_PASSWORD missing in .env — using defaults (admin / admin123).');
}
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[local-dev] SESSION_SECRET missing in .env — generated a temporary one (sessions reset on restart).');
}

// ---------------------------------------------------------------------------
// 2. Emulate @vercel/blob with files under .local-store/
// ---------------------------------------------------------------------------
function safeStorePath(pathname) {
  const rel = path.normalize(String(pathname)).replace(/^([/\\])+/, '');
  const abs = path.join(STORE_DIR, rel);
  if (!abs.startsWith(STORE_DIR + path.sep)) throw new Error('Invalid blob pathname');
  return abs;
}

const blobShim = {
  async head(pathname) {
    const file = safeStorePath(pathname);
    if (!fs.existsSync(file)) throw new Error('blob: not found locally');
    return { url: `http://127.0.0.1:${PORT}/local-store/${String(pathname).split('/').map(encodeURIComponent).join('/')}` };
  },
  async put(pathname, value /* string|Buffer */, _opts = {}) {
    const file = safeStorePath(pathname);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.isBuffer(value) ? value : Buffer.from(String(value)));
    return { url: `/local-store/${pathname}` };
  },
};

// api/*.js call require('@vercel/blob') — intercept so they get the shim
// with no node_modules needed.
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === '@vercel/blob') return blobShim;
  return origLoad.call(this, request, ...rest);
};

// ---------------------------------------------------------------------------
// 3. API handlers
// ---------------------------------------------------------------------------
const routes = {
  '/api/login': require('./api/login'),
  '/api/logout': require('./api/logout'),
  '/api/session': require('./api/session'),
  '/api/products': require('./api/products'),
  '/api/categories': require('./api/categories'),
  '/api/coupons': require('./api/coupons'),
  '/api/settings': require('./api/settings'),
  '/api/upload': require('./api/upload'),
};

// The handlers use Express-style res.status().json() — add those helpers
// to plain http.ServerResponse.
function decorate(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    const body = JSON.stringify(obj);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.end(body);
  };
  return res;
}

// ---------------------------------------------------------------------------
// 4. Static files
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
};

function serveFile(res, absPath) {
  const ext = path.extname(absPath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const data = fs.readFileSync(absPath);
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', data.length);
  res.end(data);
}

function resolveStatic(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  let rel = path.normalize(decoded).replace(/^([/\\])+/, '');
  if (rel === '' || rel === '.') rel = 'index.html';
  if (rel === 'admin') rel = path.join('admin', 'index.html');
  const abs = path.join(ROOT, rel);
  if (!abs.startsWith(ROOT + path.sep)) return null;
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    const idx = path.join(abs, 'index.html');
    return fs.existsSync(idx) ? idx : null;
  }
  return fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null;
}

// ---------------------------------------------------------------------------
// 5. HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  decorate(res);
  const urlPath = (req.url || '/').split('?')[0].split('#')[0];

  try {
    // API routes
    if (routes[urlPath]) {
      await routes[urlPath](req, res);
      if (!res.writableEnded) res.status(500).json({ error: 'Handler did not respond' });
      return;
    }

    // Uploaded product images (stored locally under .local-store/product-images)
    if (urlPath.startsWith('/local-store/')) {
      let decoded;
      try { decoded = decodeURIComponent(urlPath.slice('/local-store/'.length)); } catch { }
      const file = decoded && path.join(STORE_DIR, path.normalize(decoded).replace(/^([/\\])+/, ''));
      if (file && fs.existsSync(file) && fs.statSync(file).isFile()) {
        serveFile(res, file);
      } else {
        res.status(404).json({ error: 'Not found' });
      }
      return;
    }

    // Everything else: static files (storefront + /admin)
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const file = resolveStatic(urlPath);
    if (!file) { res.status(404).end('Not found'); return; }
    serveFile(res, file);
  } catch (err) {
    console.error('[local-dev] error handling', req.method, urlPath, err);
    if (!res.writableEnded) res.status(500).json({ error: 'Internal error: ' + err.message });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  JF Fashion local server (admin + storefront)');
  console.log(`  Storefront : http://localhost:${PORT}/`);
  console.log(`  Admin panel: http://localhost:${PORT}/admin/login.html`);
  console.log(`  Username   : ${process.env.ADMIN_USERNAME}`);
  console.log(`  Password   : ${process.env.ADMIN_PASSWORD}`);
  console.log(`  Data saved to: ${STORE_DIR}`);
  console.log('  Press Ctrl+C to stop.');
});
