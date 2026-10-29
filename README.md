# JF-Fashion-Store-website

JF Fashion clothing store (static storefront + admin panel) with Vercel Functions and Vercel Blob storage.

## Folder layout

```
public/        storefront pages, admin panel, css/, js/, images/, fonts/, vendor/
api/           Vercel Functions (products, categories, coupons, settings, auth, upload)
data/          JSON data used by the functions (not publicly served)
lib/           shared server-side helpers (auth)
server.js      local dev server (also detected by Vercel as the Node backend)
```

Static files **must stay inside `public/`**. Vercel detects a `server.js` at the project root and
deploys it as a Node backend; in that mode Vercel only serves static assets from the `public/**`
folder from its CDN. If the pages or folders (`css/`, `js/`, `images/`, `fonts/`, `vendor/`) are
placed in the project root instead of `public/`, they are bundled with the function and every
stylesheet/script request returns `404 Not found` (the page loads unstyled).

## Local development

```bash
npm install
npm run dev
```

- Storefront: http://localhost:3000/
- Admin panel: http://localhost:3000/admin/login.html

## Deploying to Vercel

1. Import the GitHub repo in Vercel (Framework Preset: **Other**).
2. Leave **Build Command** and **Output Directory** empty.
3. Add the environment variables used by the admin panel (see `ADMIN-SETUP.md`).
