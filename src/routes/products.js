const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Public catalog — powers the shop grid and category filter.
router.get("/", async (req, res) => {
  const { category } = req.query;
  const products = await prisma.product.findMany({
    where: category && category !== "All" ? { category } : undefined,
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

// Admin-only: create a house design directly (bypassing the artist submission queue).
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const product = await prisma.product.create({ data: req.body });
  res.json({ product });
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
  res.json({ product });
});

module.exports = router;
