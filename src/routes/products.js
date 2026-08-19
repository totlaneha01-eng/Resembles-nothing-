const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Public catalog — powers the shop grid and category filter.
router.get("/", async (req, res) => {
  const { category } = req.query;
  const products = await prisma.product.findMany({
    where: category && category !== "All" ? { category } : undefined,
    include: { artist: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ products });
});

router.get("/:slug", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: {
      artist: { select: { id: true, name: true } },
      reviews: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!product) return res.status(404).json({ error: "Design not found — it may have sold and been retired" });
  res.json({ product });
});

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6)
  );
}

const REQUIRED_FIELDS = ["name", "category", "price", "widthCm"];
const VALID_FORMATS = ["TAPESTRY", "CANVAS", "DIPTYCH", "TRIPTYCH", "QUADRIPTYCH"];

// Shared validation + defaulting for a single product payload, used by both
// the single-create and bulk-create endpoints so they behave identically.
function prepareProductData(input) {
  const missing = REQUIRED_FIELDS.filter((f) => input[f] === undefined || input[f] === null || input[f] === "");
  if (missing.length) throw new Error(`Missing required field(s): ${missing.join(", ")}`);

  // A design can be sold in more than one format (e.g. both Tapestry and
  // Canvas) — accept `formats` (array) as the primary shape, but also take
  // a single legacy `format` string so older callers don't break.
  const rawFormats = Array.isArray(input.formats) && input.formats.length ? input.formats : input.format ? [input.format] : [];
  if (rawFormats.length === 0) throw new Error("formats (array) or format is required");
  const formats = rawFormats.map((f) => String(f).toUpperCase());
  const invalid = formats.filter((f) => !VALID_FORMATS.includes(f));
  if (invalid.length) throw new Error(`format must be one of ${VALID_FORMATS.join(", ")} (got "${invalid.join(", ")}")`);

  const price = Number(input.price);
  const widthCm = Number(input.widthCm);
  if (!Number.isFinite(price) || price <= 0) throw new Error("price must be a positive number (in paise)");
  if (!Number.isFinite(widthCm) || widthCm <= 0) throw new Error("widthCm must be a positive number");

  let editionSize = 1;
  if (input.editionSize !== undefined && input.editionSize !== null && input.editionSize !== "") {
    editionSize = Number(input.editionSize);
    if (!Number.isInteger(editionSize) || editionSize < 1) throw new Error("editionSize must be a whole number of 1 or more");
  }

  const images = Array.isArray(input.images) && input.images.length ? input.images : input.imageUrl ? [input.imageUrl, input.imageUrl, input.imageUrl] : [];
  if (images.length === 0) throw new Error("images (array) or imageUrl is required");

  return {
    slug: input.slug ? String(input.slug) : slugify(input.name),
    name: input.name,
    category: input.category,
    price,
    widthCm,
    images,
    blurb: input.blurb || input.name,
    description: input.description || input.blurb || input.name,
    story: input.story || input.description || input.blurb || input.name,
    features: Array.isArray(input.features) ? input.features : [],
    formats,
    editionSize,
    artistId: input.artistId || null,
  };
}

// Admin-only: create a house design directly (bypassing the artist submission queue).
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const data = prepareProductData(req.body);
    const product = await prisma.product.create({ data });
    res.json({ product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin-only: create many products in one call, e.g. from a pasted catalog
// dump. Best-effort per item — one bad row doesn't fail the whole batch, so
// the caller can see exactly which rows succeeded and which need fixing.
router.post("/bulk", requireAuth, requireAdmin, async (req, res) => {
  const items = Array.isArray(req.body.products) ? req.body.products : null;
  if (!items || items.length === 0) return res.status(400).json({ error: "Body must be { products: [...] } with at least one item" });
  if (items.length > 200) return res.status(400).json({ error: "Max 200 products per bulk request" });

  const results = [];
  for (let i = 0; i < items.length; i++) {
    try {
      const data = prepareProductData(items[i]);
      const product = await prisma.product.create({ data });
      results.push({ index: i, success: true, product });
    } catch (err) {
      results.push({ index: i, success: false, error: err.message, name: items[i]?.name });
    }
  }

  const created = results.filter((r) => r.success).length;
  res.json({ results, created, failed: results.length - created });
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
  res.json({ product });
});

// Admin-only: remove a product entirely (e.g. cleaning up placeholder/seed
// entries). Prefer PATCH status: "RETIRED" for a product that actually sold
// or shouldn't be deleted for record-keeping — this is a hard delete.
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
