# Product Admin Panel — Setup Guide

Your site now has a password-protected admin panel at **`/admin`** for
managing products (name, category, price, discounts, sizes, colors,
availability, and photos) without touching any code. Changes made in the
panel go live on the site immediately after you click **Save Changes** —
no redeploy needed.

## How it works

- `/admin/login.html` — login screen
- `/admin/index.html` — the product editor
- `/api/*` — small serverless functions (already included, run automatically
  on Vercel) that handle login and reading/writing product data
- Product data is stored in **Vercel Blob** storage, so edits persist across
  deployments. Photos you upload in the panel are also stored there.
- If Blob storage isn't set up yet, or nothing has been saved yet, the site
  falls back to the products bundled in `data/products-data.json` (the
  20 products the theme ships with today), so the public site never breaks.
- The homepage ("Product Overview") and the `product.html` shop page both
  pull from the same product list, so you only manage products in one
  place.

## One-time setup on Vercel

### 1. Add environment variables
In your Vercel project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `ADMIN_USERNAME` | the login username you want, e.g. `admin` |
| `ADMIN_PASSWORD` | a strong password |
| `SESSION_SECRET` | any long random string (e.g. generate one at randomkeygen.com) — this signs the login session, keep it secret |

The Contact page's map is a plain iframe embed, so it needs no API key or extra setup.

Apply them to the **Production** environment (and Preview if you want admin
access on preview deployments too).

### 2. Add Vercel Blob storage
1. In your Vercel project, go to the **Storage** tab.
2. Click **Create Database → Blob**.
3. Connect it to this project.

Vercel automatically adds the required token to your project — no extra
env var needed on your end.

### 3. Redeploy
Trigger a new deployment (push a commit, or click **Redeploy** in Vercel) so
the new environment variables and the `/api` and `/admin` folders take
effect.

## Using the panel

1. Go to `https://yourdomain.com/admin` (or `/admin/login.html`).
2. Log in with the username/password you set above.
3. Products are grouped into a section per category automatically. Use
   **+ Add Product** to add a new item, or edit any existing card's name,
   category, price, sizes, colors, and availability directly in the fields.
4. Each product has its own **Photos** grid — click **+ Add Photo** to
   upload one or more photos (up to 6 total per product; each is resized
   automatically so uploads stay small and fast). They show up together as
   a swipeable, slide-through photo gallery (with a zoom/lightbox) on that
   product's page. Click **&#9733;** on any photo to make it the cover —
   the one shown on listing cards and in the cart — use the **&#8249; &#8250;**
   arrows to reorder the rest, or click the **×** on a photo to remove it
   (every product needs at least one).
5. Toggle **Apply a discount** to show a crossed-out old price next to the
   current price on the storefront.
6. Toggle **In Stock** off to automatically show an "Out of Stock" badge on
   the product photo on the live site, hide it from sale/discount badges,
   and stop customers from adding it to their cart or checking out with it.
7. Use the **Sizes** and **Colors** fields to add or remove which options
   show up in that product's Size/Color dropdowns on the storefront — type
   a value and click **+ Add** (or press Enter), click the **×** on a chip
   to remove it. Leave a field empty to hide that dropdown for the product.
8. Use the search box at the top to quickly find a product by name instead
   of scrolling — categories themselves are managed separately via
   **+ Manage Categories** (rename, add, delete, or reorder them; the
   default set is Summer Wear / Winter Wear / Ethnic Wear / Casual Wear /
   Party Wear, but this is fully editable).
9. Use **+ Delivery Charge** to set a single flat delivery fee (in Rs.)
   added to every order's total on the cart page and in the WhatsApp
   checkout message — leave it at 0 for free delivery.
10. Click **Delete** on a product card to remove it.
11. Click **Save Changes** at the top. The public site updates right away.

## Notes & limits

- Sessions last 12 hours, then you'll need to log in again.
- Login attempts are throttled (max ~8 tries per 10 minutes per warm
  server instance) to slow down password guessing — this is a speed bump,
  not a hard limit, since Vercel Functions are stateless across instances.
  For stronger protection, put the site behind a WAF/rate limiter at the
  edge.
- Photo uploads are capped at a few MB after automatic compression — plenty
  for product photos.
- Only one admin account is supported (shared username/password). If you
  need multiple staff logins later, that's a bigger change — just ask.
- Consider changing `ADMIN_PASSWORD` periodically, especially if staff turn
  over.
- `product-detail.html` is wired to per-product data: clicking any product
  card links to `product-detail.html?id=<id>`, and `js/product-detail-render.js`
  loads that product's name, price, and photo from `/api/products` on page
  load.
