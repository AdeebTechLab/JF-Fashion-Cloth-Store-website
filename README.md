# JF-Fashion-Store-website

JF Fashion clothing store (static storefront + admin panel) with Vercel Functions and Vercel Blob storage.

## Local development

```bash
npm install
npm run dev
```

- Storefront: http://localhost:3000/
- Admin panel: http://localhost:3000/admin/login.html

The local dev server lives in `scripts/dev-server.js`. **Keep it inside `scripts/`** — Vercel
auto-detects a root-level `server.js` / `index.js` / `app.js` and deploys it as a Node backend,
which makes the storefront's static files (`css/`, `js/`, `images/`, `fonts/`, `vendor/`) return
404. Keeping the dev server out of the project root lets Vercel deploy this repo as a normal
static site with the `api/` folder as serverless functions.

## Deploying to Vercel

1. Import the GitHub repo in Vercel (Framework Preset: **Other**).
2. Leave **Build Command** empty and **Output Directory** empty.
3. Add the environment variables used by the admin panel (see `ADMIN-SETUP.md`).
