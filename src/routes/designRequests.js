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

  const request = await prisma.designRequest.create({
    data: { userId: req.user?.id || null, name, contact, message },
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

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!["NEW", "REVIEWED", "DONE"].includes(status)) return res.status(400).json({ error: "Invalid status" });
  const request = await prisma.designRequest.update({ where: { id: req.params.id }, data: { status } });
  res.json({ request });
});

module.exports = router;
