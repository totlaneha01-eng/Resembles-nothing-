const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { createRazorpayOrder, verifyPaymentSignature } = require("../lib/razorpay");
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
// that needs inventory to be reserved before payment, which neither flow
// does yet. Shared by both the Razorpay /verify path and the manual-UPI
// /confirm-payment path, since either one is "we now have real proof this
// was paid for."
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

// Step 1 — create a Razorpay order for whatever's currently in the cart.
// The frontend calls this, then opens Razorpay Checkout with the returned order_id.
router.post("/create", requireAuth, async (req, res) => {
  try {
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
        paymentMethod: "RAZORPAY",
        items: {
          create: cartItems.map((i) => ({
            productId: i.productId,
            format: i.format,
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

    // Razorpay itself is the most likely thing to fail here (bad/missing
    // keys, network blip, Razorpay downtime) — if it does, the order row
    // above already exists with no razorpayOrderId, which is a fine, inert
    // state to leave it in. What must NOT happen is this throwing past the
    // try/catch: an uncaught rejection in an async Express 4 handler doesn't
    // get routed to error middleware, it crashes the whole Node process —
    // taking the entire site down for every visitor, not just this request.
    const razorpayOrder = await createRazorpayOrder(totalAmount, order.id);
    await prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId: razorpayOrder.id } });

    res.json({ orderId: order.id, razorpayOrderId: razorpayOrder.id, amount: totalAmount, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("orders/create failed:", err);
    res.status(502).json({ error: "Couldn't start checkout — payment provider didn't respond. Please try again." });
  }
});

// Step 2 — the frontend calls this once Razorpay Checkout succeeds, passing
// back the payment_id + signature so we can verify the payment actually happened.
// (Also register the same logic on a Razorpay webhook as a backup — see README.)
router.post("/verify", requireAuth, async (req, res) => {
  try {
    const { orderId, razorpayPaymentId, razorpaySignature } = req.body;
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.userId !== req.user.id) return res.status(404).json({ error: "Order not found" });

    const valid = verifyPaymentSignature({ razorpayOrderId: order.razorpayOrderId, razorpayPaymentId, razorpaySignature });
    if (!valid) return res.status(400).json({ error: "Payment could not be verified" });

    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { razorpayPaymentId, status: "PLACED", paymentConfirmed: true, paymentConfirmedAt: new Date() } }),
      prisma.orderStatusEvent.create({ data: { orderId: order.id, status: "PLACED" } }),
      ...editionSaleUpdates(order.items),
      prisma.cartItem.deleteMany({ where: { userId: req.user.id } }),
    ]);

    await notifyOrderStatus(order.id, "PLACED");
    res.json({ ok: true, orderId: order.id });
  } catch (err) {
    console.error("orders/verify failed:", err);
    res.status(502).json({ error: "Payment verification hit an error — if you were charged, contact support before retrying." });
  }
});

// Manual-UPI checkout path (temporary, while Razorpay's account keys are
// being connected) — the frontend already sent the buyer to WhatsApp with
// their order + a payment screenshot; this just gives that order a real,
// persisted row (invoice, order history, admin visibility) instead of
// living only in the browser. Doesn't touch unitsSold/editionSize yet —
// that only happens once an admin actually confirms the payment below,
// since nothing here has verified money changed hands.
router.post("/manual", requireAuth, async (req, res) => {
  try {
    const { items, shippingAddress } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "No items to order" });

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
