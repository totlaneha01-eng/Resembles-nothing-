const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/:productId", async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { productId: req.params.productId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ reviews });
});

// photoUrls are uploaded client-side to your object storage (S3/Cloudinary/etc.)
// first; this endpoint just records the resulting URLs against the review.
router.post("/:productId", requireAuth, async (req, res) => {
  const { rating, text, photoUrls = [] } = req.body;
  const review = await prisma.review.create({
    data: { userId: req.user.id, productId: req.params.productId, rating, text, photoUrls },
  });
  res.json({ review });
});

module.exports = router;
