const express = require("express");
const prisma = require("../lib/prisma");
const { optionalAuth, requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// "Request a custom design" message box — open to signed-out visitors too.
// If they're logged in (token present), attach their account automatically;
// otherwise require name + contact so we know how to reach back.
router.post("/", optionalAuth, async (req, res) => {
  const message = String(req.body.message || "").trim();
  if (!message) return res.status(400).json({ error: "Tell us a bit about what you're picturing" });
  if (message.length > 4000) return res.status(400).json({ error: "That's a lot — try trimming it a little" });

  const name = req.user ? req.user.name : String(req.body.name || "").trim();
  const contact = req.user ? req.user.email : String(req.body.contact || "").trim();
  if (!req.user && (!name || !contact)) {
    return res.status(400).json({ error: "Add your name and a way to reach you (email, phone, or WhatsApp)" });
  }

  // Optional — same rules as orders/manual's paymentScreenshot (see that
  // route's comment for why: WhatsApp is still the fallback, and the cap is
  // just to keep something huge out of a TEXT column).
  const { paymentScreenshot } = req.body;
  if (paymentScreenshot !== undefined && paymentScreenshot !== null && paymentScreenshot !== "") {
    if (typeof paymentScreenshot !== "string" || !paymentScreenshot.startsWith("data:image/")) {
      return res.status(400).json({ error: "That doesn't look like a valid image" });
    }
    if (paymentScreenshot.length > 7_000_000) {
      return res.status(400).json({ error: "That screenshot's too large — try a smaller one" });
    }
  }

  const request = await prisma.designRequest.create({
    data: { userId: req.user?.id || null, name, contact, message, paymentScreenshot: paymentScreenshot || null },
  });
  res.json({ request });
});

// Admin-only: review queue for the requests above.
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const requests = await prisma.designRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  res.json({ requests });
});

// Admin confirms the commission fee actually landed (matched a payment
// screenshot by hand, same as orders/:id/confirm-payment) — idempotent, so
// tapping it twice isn't an error, it just no-ops the second time.
router.post("/:id/confirm-payment", requireAuth, requireAdmin, async (req, res) => {
  const request = await prisma.designRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.paymentConfirmed) return res.json({ request }); // already confirmed — no-op, not an error

  const updated = await prisma.designRequest.update({
    where: { id: request.id },
    data: {
      paymentConfirmed: true,
      paymentConfirmedAt: new Date(),
      status: request.status === "NEW" ? "IN_PROGRESS" : request.status,
    },
  });
  res.json({ request: updated });
});

// Moves a request through its stages and/or attaches the first round of
// design directions — pasting iterationImages in counts as "sent" on its
// own (moves status to ITERATIONS_SENT) unless the caller also explicitly
// set a different status in the same call.
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const data = {};

  if (req.body.status !== undefined) {
    if (!["NEW", "IN_PROGRESS", "ITERATIONS_SENT", "DONE"].includes(req.body.status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    data.status = req.body.status;
  }
  if (req.body.iterationImages !== undefined) {
    if (!Array.isArray(req.body.iterationImages)) return res.status(400).json({ error: "iterationImages must be a list of URLs" });
    data.iterationImages = req.body.iterationImages.map((u) => String(u).trim()).filter(Boolean);
    if (data.status === undefined) data.status = "ITERATIONS_SENT";
  }
  if (req.body.iterationNote !== undefined) {
    data.iterationNote = String(req.body.iterationNote || "").trim() || null;
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nothing to update" });

  const request = await prisma.designRequest.update({ where: { id: req.params.id }, data });
  res.json({ request });
});

module.exports = router;
