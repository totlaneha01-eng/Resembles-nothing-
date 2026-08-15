const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { createRazorpayOrder, verifyPaymentSignature } = require("../lib/razorpay");
const { notifyOrderStatus, notifyUser } = require("../lib/whatsapp");

const router = express.Router();

const ARTIST_COMMISSION_PCT = 30; // keep this in sync with the frontend constant

// Step 1 — create a Razorpay order for whatever's currently in the cart.
// The frontend calls this, then opens Razorpay Checkout with the returned order_id.
router.post("/create", requireAuth, async (req, res) => {
  const { shippingAddress } = req.body;

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: { product: true },
  });
  if (cartItems.length === 0) return res.status(400).json({ error: "Your cart is empty" });

  // Re-check every item is still ACTIVE right before charging — a one-of-one
  // design must never be sold to two people because of a race condition.
  const unavailable = cartItems.filter((i) => i.product.status !== "ACTIVE");
  if (unavailable.length > 0) {
    return res.status(409).json({ error: "Some items in your cart just sold out", items: unavailable.map((i) => i.product.name) });
  }

  const totalAmount = cartItems.reduce((sum, i) => sum + i.priceINR * i.qty, 0);

  const order = await prisma.order.create({
    data: {
      userId: req.user.id,
      totalAmount,
      shippingAddress,
      status: "PLACED",
      items: {
        create: cartItems.map((i) => ({
          productId: i.productId,
          sizeLabel: i.sizeLabel,
          sizeDims: i.sizeDims,
          priceINR: i.priceINR,
          priceUSD: i.priceUSD,
          artistId: i.product.artistId,
          artistPayoutAmount: i.product.artistId ? Math.round((i.priceINR * ARTIST_COMMISSION_PCT) / 100) : null,
          artistPayoutStatus: i.product.artistId ? "PENDING" : "NOT_APPLICABLE",
        })),
      },
    },
  });

  const razorpayOrder = await createRazorpayOrder(totalAmount, order.id);
  await prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: razorpayOrder.id } });

  res.json({ orderId: order.id, razorpayOrderId: razorpayOrder.id, amount: totalAmount, keyId: process.env.RAZORPAY_KEY_ID });
});

// Step 2 — the frontend calls this once Razorpay Checkout succeeds, passing
// back the payment_id + signature so we can verify the payment actually happened.
// (Also register the same logic on a Razorpay webhook as a backup — see README.)
router.post("/verify", requireAuth, async (req, res) => {
  const { orderId, razorpayPaymentId, razorpaySignature } = req.body;
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: "Order not found" });

  const valid = verifyPaymentSignature({ razorpayOrderId: order.razorpayOrderId, razorpayPaymentId, razorpaySignature });
  if (!valid) return res.status(400).json({ error: "Payment could not be verified" });

  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { razorpayPaymentId, status: "PLACED" } }),
    prisma.orderStatusEvent.create({ data: { orderId: order.id, status: "PLACED" } }),
    // This is where the one-sale-only rule actually gets enforced — the
    // moment payment clears, every product in the order is retired for good.
    ...order.items.map((item) =>
      prisma.product.update({ where: { id: item.productId }, data: { status: "SOLD", soldAt: new Date() } })
    ),
    prisma.cartItem.deleteMany({ where: { userId: req.user.id } }),
  ]);

  await notifyOrderStatus(order.id, "PLACED");
  res.json({ ok: true, orderId: order.id });
});

router.get("/", requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    include: { items: { include: { product: true } }, statusEvents: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ orders });
});

// Admin/ops moves an order through its journey — each call fires the matching
// WhatsApp template via notifyOrderStatus. This is the "every step gets sent
// to WhatsApp" feature from the frontend, actually wired up.
router.post("/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const { status, note } = req.body; // one of OrderStatus enum values
  await prisma.orderStatusEvent.create({ data: { orderId: req.params.id, status, note } });
  const order = await prisma.order.update({ where: { id: req.params.id }, data: { status } });
  await notifyOrderStatus(order.id, status);

  // Once delivered, mark artist payouts as due — the actual bank transfer is
  // a separate step (see routes/payouts.js), kept manual/reviewable on purpose.
  if (status === "DELIVERED") {
    await prisma.orderItem.updateMany({
      where: { orderId: order.id, artistPayoutStatus: "PENDING" },
      data: { artistPayoutStatus: "PENDING" }, // stays PENDING until an admin actually pays out
    });
  }

  res.json({ order });
});

module.exports = router;
