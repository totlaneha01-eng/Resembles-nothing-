const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { notifyOrderStatus, notifyUser } = require("../lib/whatsapp");
const { streamInvoice } = require("../lib/invoice");

const router = express.Router();

const ARTIST_COMMISSION_PCT = 30; // keep this in sync with the frontend constant

// This is where the edition-size rule actually gets enforced — each sale
// counts one unit against the design's editionSize (set by the artist/
// admin, default 1 for true one-of-one), across ANY format/size. Only
// flips to SOLD once the edition is exhausted. Raw SQL so the read
// (current unitsSold) and write happen as one atomic statement per row —
// two near-simultaneous purchases of the last unit must not both succeed.
// The `unitsSold < editionSize` guard stops this specific UPDATE from
// ever oversubscribing an edition. It does not, on its own, stop two
// concurrent checkouts from both reaching this point for the last unit —
// that needs inventory to be reserved before payment, which the manual-UPI
// flow doesn't do yet.
function editionSaleUpdates(items) {
  return items.map(
    (item) => prisma.$executeRaw`
      UPDATE "Product"
      SET "unitsSold" = "unitsSold" + 1,
          "status" = CASE WHEN "unitsSold" + 1 >= "editionSize" THEN 'SOLD'::"ProductStatus" ELSE "status" END,
          "soldAt" = CASE WHEN "unitsSold" + 1 >= "editionSize" AND "soldAt" IS NULL THEN NOW() ELSE "soldAt" END
      WHERE id = ${item.productId} AND "unitsSold" < "editionSize"
    `
  );
}

// Manual-UPI checkout — the frontend sends the buyer to WhatsApp with their
// order + a payment screenshot; this just gives that order a real,
// persisted row (invoice, order history, admin visibility) instead of
// living only in the browser. Doesn't touch unitsSold/editionSize yet —
// that only happens once an admin actually confirms the payment below,
// since nothing here has verified money changed hands.
router.post("/manual", requireAuth, async (req, res) => {
  try {
    const { items, shippingAddress, paymentScreenshot } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "No items to order" });

    // Optional — checkout still works without it (WhatsApp is the fallback).
    // A phone screenshot rarely exceeds a couple MB; 7M chars of base64
    // (~5MB raw) is a generous cap that just stops something huge from
    // landing in a TEXT column.
    if (paymentScreenshot !== undefined && paymentScreenshot !== null && paymentScreenshot !== "") {
      if (typeof paymentScreenshot !== "string" || !paymentScreenshot.startsWith("data:image/")) {
        return res.status(400).json({ error: "That doesn't look like a valid image" });
      }
      if (paymentScreenshot.length > 7_000_000) {
        return res.status(400).json({ error: "That screenshot's too large — try a smaller one" });
      }
    }

    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));

    const unavailable = items.filter((i) => !byId[i.productId] || byId[i.productId].status !== "ACTIVE");
    if (unavailable.length > 0) {
      return res.status(409).json({ error: "Some items just sold out or aren't available", items: unavailable.map((i) => i.productId) });
    }

    const totalAmount = items.reduce((sum, i) => sum + i.priceINR * (i.qty || 1), 0);

    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        totalAmount,
        shippingAddress,
        status: "PLACED",
        paymentMethod: "UPI_MANUAL",
        paymentScreenshot: paymentScreenshot || null,
        items: {
          create: items.map((i) => {
            const product = byId[i.productId];
            return {
              productId: i.productId,
              format: i.format,
              sizeLabel: i.sizeLabel,
              sizeDims: i.sizeDims,
              priceINR: i.priceINR,
              priceUSD: i.priceUSD || 0,
              artistId: product.artistId,
              artistPayoutAmount: product.artistId ? Math.round((i.priceINR * ARTIST_COMMISSION_PCT) / 100) : null,
              artistPayoutStatus: product.artistId ? "PENDING" : "NOT_APPLICABLE",
            };
          }),
        },
      },
    });

    res.json({ orderId: order.id });
  } catch (err) {
    console.error("orders/manual failed:", err);
    res.status(500).json({ error: "Couldn't save this order — your WhatsApp message still went through, so it's not lost, just not in your order history yet." });
  }
});

// Admin confirms a manual-UPI payment (matched a buyer's screenshot to this
// order by hand) — this is the moment that actually counts as "paid": it's
// what decrements the edition and flips a sold-out design to SOLD.
router.post("/:id/confirm-payment", requireAuth, requireAdmin, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.paymentConfirmed) return res.json({ order }); // already confirmed — no-op, not an error

  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { paymentConfirmed: true, paymentConfirmedAt: new Date() } }),
    ...editionSaleUpdates(order.items),
  ]);

  // Writes a NotificationLog row either way (visible in the customer's
  // notification bell once that's wired to real data) and actually reaches
  // WhatsApp once WHATSAPP_PHONE_NUMBER_ID/ACCESS_TOKEN are configured —
  // silently a no-op until then, not an error.
  await notifyOrderStatus(order.id, "PLACED");

  const updated = await prisma.order.findUnique({ where: { id: order.id }, include: { items: { include: { product: true } }, user: { select: { name: true, email: true } } } });
  res.json({ order: updated });
});

// Streams a GST-invoice PDF for one order — the buyer (if it's their order)
// or an admin can pull it. Works whether or not payment's been confirmed
// yet, so an admin can preview it before sending.
router.get("/:id/invoice", requireAuth, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true } }, user: { select: { name: true, email: true } } },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.userId !== req.user.id && !req.user.isAdmin) return res.status(403).json({ error: "Not your order" });

  streamInvoice(order, res);
});

router.get("/", requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    include: { items: { include: { product: true } }, statusEvents: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ orders });
});

// Admin-only: every order across every buyer — the manual-UPI ones needing
// a "Confirm Payment" tap show up here regardless of who placed them.
router.get("/admin/all", requireAuth, requireAdmin, async (req, res) => {
  const orders = await prisma.order.findMany({
    include: { items: { include: { product: true } }, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
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
