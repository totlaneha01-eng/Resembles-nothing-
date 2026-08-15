const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { notifyUser } = require("../lib/whatsapp");

const router = express.Router();

// Fetch (or implicitly start) the conversation between the current user and
// a product's artist. If the product has no artist (a house design), messages
// route to the studio account instead — same shape either way.
router.get("/:productId", requireAuth, async (req, res) => {
  const messages = await prisma.chatMessage.findMany({
    where: { productId: req.params.productId, customerId: req.user.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { name: true } } },
  });
  res.json({ messages });
});

router.post("/:productId", requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: "Message can't be empty" });

  const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
  if (!product) return res.status(404).json({ error: "Design not found" });

  const message = await prisma.chatMessage.create({
    data: {
      productId: req.params.productId,
      customerId: req.user.id,
      senderId: req.user.id,
      text: text.trim(),
    },
  });

  // Notify the artist a customer messaged them about their piece. House
  // designs (no artist) notify the studio's admin account instead — set
  // STUDIO_ADMIN_USER_ID in your env once you know that account's id.
  const notifyTargetId = product.artistId || process.env.STUDIO_ADMIN_USER_ID;
  if (notifyTargetId) {
    await notifyUser(notifyTargetId, {
      title: "New message about your design",
      body: `Someone asked about "${product.name}": "${text.trim().slice(0, 80)}"`,
      templateName: "artist_chat_message",
      templateParams: [product.name],
    });
  }

  res.json({ message });
});

// Lets an artist (or admin, for house designs) reply into a specific
// customer's conversation about one of their products.
router.post("/:productId/reply/:customerId", requireAuth, async (req, res) => {
  const { text } = req.body;
  const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
  if (!product) return res.status(404).json({ error: "Design not found" });

  const isTheArtist = product.artistId === req.user.id;
  if (!isTheArtist && !req.user.isAdmin) {
    return res.status(403).json({ error: "Only this design's artist can reply here" });
  }

  const message = await prisma.chatMessage.create({
    data: {
      productId: req.params.productId,
      customerId: req.params.customerId,
      senderId: req.user.id,
      text: text.trim(),
    },
  });

  await notifyUser(req.params.customerId, {
    title: `${product.artist?.name || "The artist"} replied`,
    body: text.trim().slice(0, 100),
    templateName: "artist_chat_reply",
    templateParams: [product.name],
  });

  res.json({ message });
});

module.exports = router;
