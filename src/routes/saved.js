const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// The "Saved" tab — a lightweight wishlist. Unlike a cart item this isn't
// tied to a format/size, just "I want to remember this design."
router.get("/", requireAuth, async (req, res) => {
  const saved = await prisma.savedProduct.findMany({
    where: { userId: req.user.id },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ saved });
});

router.post("/:productId", requireAuth, async (req, res) => {
  const { productId } = req.params;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: "Design not found" });

  const item = await prisma.savedProduct.upsert({
    where: { userId_productId: { userId: req.user.id, productId } },
    update: {},
    create: { userId: req.user.id, productId },
  });
  res.json({ item });
});

router.delete("/:productId", requireAuth, async (req, res) => {
  await prisma.savedProduct.deleteMany({
    where: { userId: req.user.id, productId: req.params.productId },
  });
  res.json({ ok: true });
});

module.exports = router;
