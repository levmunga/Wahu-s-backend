# Wahu's Closet — Backend & Admin Panel

This is a real backend for Wahu's Closet: a small database-backed API plus an
admin panel where you can add, edit, and delete products yourself — no more
sending photos through chat for each new item.

It replaces the old approach (one giant HTML file with everything baked in)
with three separate pieces:

1. **The database** — stores every product, color, price, and photo.
2. **The API** — a small server that reads/writes the database.
3. **The admin panel** (`/admin`) — the page you log into to manage products.

Your existing storefront design isn't touched by this — once this is deployed,
the next step (separate from this build) is pointing the storefront's product
list at this API instead of its hardcoded list, so the site shows whatever is
in your database.

---

## 1. Running it on your own computer first (recommended before deploying)

You'll need [Node.js](https://nodejs.org) version 22.5 or newer installed.
Check what you have with:

```
node --version
```

Then, from inside this folder:

```
npm install
cp .env.example .env
```

Open `.env` in a text editor and replace `JWT_SECRET` with a random string
(anything long and unguessable works — you can generate one with the command
shown inside the file).

Start the server:

```
npm start
```

You should see:

```
Wahu's Closet backend running on http://localhost:3000
```

Open **http://localhost:3000/admin/** in your browser. The first time, you'll
see "Create an admin account" — choose a username and password (this is
**your** login, not a customer account, and there's only ever one). After
that, you'll log in with those same details every time.

---

## 2. Bringing in your existing 15 products

If you want the products already on your current site (handbags, the
Mavercik set, dresses, etc.) to show up here too instead of re-entering them
by hand, run this **once**, after creating your admin account:

```
node migration/migrate.js your-username your-password
```

This reads a snapshot of your old site's product list and photos and creates
matching entries in the new database. Products that only ever had a
placeholder color swatch (no real photo was supplied) come in with a blank
photo slot — open `/admin`, click "Edit" on that product, and upload a real
photo for those colors whenever you're ready. Nothing is faked or guessed.

**Only run this once.** Running it a second time will create duplicate
products, since it doesn't check what's already there.

---

## 3. Using the admin panel day to day

- **Add Product** — fill in name, category, price (and an optional "was"
  price for a strikethrough discount), sizes if relevant, description, and
  at least one color with a photo.
- **Edit** — click Edit on any product card to change anything, including
  swapping out a photo for a color.
- **Delete** — removes the product and any photos that aren't used elsewhere.
- Changes are live immediately — there's no separate "publish" step.

---

## 4. Deploying so it's reachable by real customers, not just your computer

Right now this only works while it's running on your computer. To make it
permanently available, you deploy it to a hosting provider. The simplest free
option for something this size is **Render**:

1. Put this project in a GitHub repository (Render deploys from GitHub).
   If you're not already using GitHub, it's free at github.com — create an
   account, create a new repository, and follow GitHub's instructions for
   uploading this folder to it.
2. Go to [render.com](https://render.com) and sign up (you can sign up
   directly with your GitHub account, which simplifies the next step).
3. Click **New +** → **Web Service**, and select the GitHub repository you
   just created.
4. Render will detect this is a Node project. Use these settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment Variables**, add the same variables from your `.env`
   file — especially `JWT_SECRET` (use a different random value than the one
   on your computer) and set `NODE_ENV` to `production`.
6. Click **Create Web Service**. Render will build and start it, and give you
   a URL like `https://wahus-backend.onrender.com`.
7. Visit `https://your-render-url.onrender.com/admin/` and create your admin
   account there (this is separate from any account you made locally — it's
   a fresh database on Render's server).
8. If you ran the migration locally first and want those same products on
   the live version, run the migration command again, but pointing at your
   Render URL instead of localhost:
   ```
   node migration/migrate.js your-username your-password https://your-render-url.onrender.com
   ```

**One thing about Render's free tier worth knowing honestly:** free web
services "sleep" after periods of inactivity and take 30-60 seconds to wake
up on the next request. For a small storefront with occasional admin updates,
this is usually fine — but if it ever feels too slow, Render's paid tier
(a few dollars a month) removes the sleep delay entirely.

---

## 5. What this does *not* do yet

This builds the backend and admin panel only. Your live storefront
(`wahus-closet-v3.html`) still has its product list hardcoded the old way —
connecting the storefront to read from this API instead is a separate,
smaller follow-up step once this is deployed and you've confirmed it works
the way you want.

---

## Project structure

```
wahus-backend/
  src/
    server.js       — the API server and all routes
    db.js            — database setup (SQLite, file-based)
    auth.js          — admin login/session handling
    products.js       — all product/image database queries
  public/
    admin/
      index.html      — the admin panel (what you see at /admin)
  migration/
    data_extract.js   — snapshot of your old site's product data
    migrate.js         — the one-time import script
  data/
    wahus.db          — the actual database file (created automatically,
                          this is where everything lives — back this up!)
  .env.example         — template for required configuration
  package.json
```

## Backing up your data

Everything — every product, every photo — lives in one file:
`data/wahus.db`. If you're hosting on Render, this file lives on their
server, not your computer. It's worth periodically downloading a copy as a
backup; ask if you'd like a simple way to do that added.
