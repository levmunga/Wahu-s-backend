// migrate.js
// One-time script to import the 15 products already hardcoded in the old
// single-file storefront (wahus-closet-v3.html) into the new database.
//
// Usage:
//   1. Make sure the backend server is running (npm start) and you've
//      already created an admin account via the /admin panel.
//   2. node migration/migrate.js <admin-username> <admin-password> [api-base-url]
//
// What it does:
//   - Reads data_extract.js (a snapshot of the old site's PRODUCTS,
//     PRODUCT_COLOR_BG, and CATEGORY_META variables).
//   - For colors that have a real embedded photo, decodes the base64 image
//     and uploads it through POST /api/admin/images.
//   - For colors that only had a CSS gradient placeholder (no real photo
//     was ever supplied), skips the image — the admin panel will show an
//     empty thumbnail you can fill in later, rather than inventing a fake one.
//   - Creates each product through POST /api/admin/products with the
//     resulting color/image data attached.
//
// This script is safe to run only once against a fresh database. Running it
// twice will create duplicate products, since it doesn't check for existing
// matches by name.

const path = require("path");
const { PRODUCTS, PRODUCT_COLOR_BG } = require("./data_extract.js");

const [, , username, password, apiBaseArg] = process.argv;
const API_BASE = apiBaseArg || "http://localhost:3000";

if (!username || !password) {
  console.error("Usage: node migration/migrate.js <admin-username> <admin-password> [api-base-url]");
  process.exit(1);
}

function extractBase64FromCssValue(cssValue) {
  // cssValue looks like: center/cover no-repeat url(data:image/jpeg;base64,XXXXX)
  const match = cssValue.match(/url\(data:(image\/\w+);base64,([^)]+)\)/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

async function login() {
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Login failed: " + (data.error || res.status));
  // Extract the session cookie from the response so subsequent requests can reuse it
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("Login succeeded but no session cookie was returned.");
  return setCookie.split(";")[0]; // "wahus_admin_session=xxxx"
}

async function uploadImage(cookie, mimeType, base64) {
  const buffer = Buffer.from(base64, "base64");
  const blob = new Blob([buffer], { type: mimeType });
  const formData = new FormData();
  const ext = mimeType.split("/")[1] || "jpg";
  formData.append("image", blob, `migrated.${ext}`);

  const res = await fetch(`${API_BASE}/api/admin/images`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Image upload failed: " + (data.error || res.status));
  return data.imageId;
}

async function createProduct(cookie, payload) {
  const res = await fetch(`${API_BASE}/api/admin/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Product creation failed: " + (data.error || res.status));
  return data;
}

async function main() {
  console.log(`Logging in as ${username}...`);
  const cookie = await login();
  console.log("Logged in. Starting migration of", PRODUCTS.length, "products.\n");

  const imageIdCache = {}; // avoid re-uploading the same photo if reused across colors

  let createdCount = 0;
  let skippedImages = 0;
  let uploadedImages = 0;

  for (const p of PRODUCTS) {
    process.stdout.write(`Migrating "${p.name}"... `);

    const colors = [];
    for (const c of p.colors) {
      const cssValue = PRODUCT_COLOR_BG[c.img];
      let imageId = null;

      if (cssValue) {
        const parsed = extractBase64FromCssValue(cssValue);
        if (parsed) {
          if (imageIdCache[c.img]) {
            imageId = imageIdCache[c.img];
          } else {
            imageId = await uploadImage(cookie, parsed.mimeType, parsed.base64);
            imageIdCache[c.img] = imageId;
            uploadedImages++;
          }
        } else {
          // Gradient placeholder, not a real photo — skip, leave blank for the admin to fill in.
          skippedImages++;
        }
      }

      colors.push({ name: c.name, hex: c.hex, imageId });
    }

    await createProduct(cookie, {
      name: p.name,
      category: p.category,
      price: p.price,
      compareAtPrice: p.compareAtPrice || null,
      description: p.desc || "",
      care: p.care || "",
      sizes: p.sizes || null,
      badge: p.badge || null,
      stock: p.stock || "in",
      isNew: !!p.isNew,
      isBest: !!p.isBest,
      rating: p.rating != null ? p.rating : 5,
      reviews: p.reviews != null ? p.reviews : 0,
      colors,
    });

    createdCount++;
    console.log("done");
  }

  console.log(`\nMigration complete.`);
  console.log(`  Products created: ${createdCount}`);
  console.log(`  Real photos uploaded: ${uploadedImages}`);
  console.log(`  Placeholder colors left blank (no real photo existed): ${skippedImages}`);
  console.log(`\nOpen /admin in your browser to review and add photos for any blank colors.`);
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});
