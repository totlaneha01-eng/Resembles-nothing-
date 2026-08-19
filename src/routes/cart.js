const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { notifyUser } = require("../lib/whatsapp");
const { findSize, defaultSize } = require("../lib/pricing");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const items = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: { product: true },
  });
  res.json({ items });
});

// sizeLabel is optional — omit it to add the product's default tier, exactly
// like tapping "Add to Cart" on a catalog card in the frontend (which skips
// the size picker and uses whatever price that card already shows).
// format is optional — omit it to use the design's first available format,
// same idea as sizeLabel defaulting to the middle tier.
router.post("/add", requireAuth, async (req, res) => {
  const { productId, qty = 1, format, sizeLabel } = req.body;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.status !== "ACTIVE") {
    return res.status(409).json({ error: "This design is no longer available — it may already be sold" });
  }

  const chosenFormat = format || product.formats[0];
  if (!product.formats.includes(chosenFormat)) {
    return res.status(400).json({ error: `This design isn't available as ${chosenFormat}` });
  }

  const size = sizeLabel ? findSize(chosenFormat, sizeLabel) : defaultSize(chosenFormat, product.price);

  const item = await prisma.cartItem.upsert({
    where: { userId_productId_format_sizeLabel: { userId: req.user.id, productId, format: chosenFormat, sizeLabel: size.label } },
    update: { qty: { increment: qty } },
    create: {
      userId: req.user.id,
      productId,
      format: chosenFormat,
      qty,
      sizeLabel: size.label,
      sizeDims: size.dims,
      priceINR: size.priceINR,
      priceUSD: size.priceUSD,
    },
  });

  // Keep the "in X carts right now" counter on the product accurate.
  await prisma.product.update({ where: { id: productId }, data: { cartCount: { increment: 1 } } });

  res.json({ item });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const { qty } = req.body;
  const item = await prisma.cartItem.update({ where: { id: req.params.id }, data: { qty } });
  res.json({ item });
});

router.delete("/:id", requireAuth, async (req, res) => {
  await prisma.cartItem.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// Called by a scheduled job (e.g. every few hours) — nudges anyone with items
// sitting in their cart, via WhatsApp, which is the "your cart is empty /
// waiting" trust notification described in the frontend.
async function sendAbandonedCartReminders() {
  const staleItems = await prisma.cartItem.findMany({
    where: { createdAt: { lt: new Date(Date.now() - 1000 * 60 * 60 * 6) } }, // 6h+ old
    include: { product: true, user: true },
    distinct: ["userId"],
  });
  for (const item of staleItems) {
    await notifyUser(item.userId, {
      title: "Your cart's waiting",
      body: `"${item.product.name}" is still in your cart.`,
      templateName: "cart_reminder",
      templateParams: [item.product.name],
    });
  }
}

module.exports = router;
module.exports.sendAbandonedCartReminders = sendAbandonedCartReminders;
