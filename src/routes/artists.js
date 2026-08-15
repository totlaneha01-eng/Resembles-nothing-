const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireArtist, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Anyone can apply to become an artist — no purchase history required,
// matching what's promised on the frontend. Bank details are collected
// separately via POST /api/payouts/bank-details before their first submission.
router.post("/apply", requireAuth, async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { isArtist: true } });
  res.json({ user });
});

router.post("/submissions", requireAuth, requireArtist, async (req, res) => {
  const { title, description, format, suggestedPrice, imageUrl } = req.body;
  const submission = await prisma.artistSubmission.create({
    data: { artistId: req.user.id, title, description, format, suggestedPrice, imageUrl },
  });
  res.json({ submission });
});

router.get("/submissions/mine", requireAuth, requireArtist, async (req, res) => {
  const submissions = await prisma.artistSubmission.findMany({
    where: { artistId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ submissions });
});

// ---- Admin review queue ----

router.get("/submissions/pending", requireAuth, requireAdmin, async (req, res) => {
  const submissions = await prisma.artistSubmission.findMany({
    where: { status: "PENDING" },
    include: { artist: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json({ submissions });
});

router.post("/submissions/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  const submission = await prisma.artistSubmission.findUnique({ where: { id: req.params.id } });
  if (!submission) return res.status(404).json({ error: "Submission not found" });

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        slug: slugify(submission.title),
        name: submission.title,
        category: req.body.category || "Abstract",
        price: submission.suggestedPrice,
        widthCm: req.body.widthCm || 30,
        images: [submission.imageUrl, submission.imageUrl, submission.imageUrl],
        blurb: req.body.blurb || submission.description.slice(0, 80),
        description: submission.description,
        story: submission.description,
        features: req.body.features || [],
        format: submission.format,
        artistId: submission.artistId,
        submissionId: submission.id,
      },
    });
    await tx.artistSubmission.update({
      where: { id: submission.id },
      data: { status: "APPROVED", reviewedById: req.user.id, reviewedAt: new Date() },
    });
    return p;
  });

  res.json({ product });
});

router.post("/submissions/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  const submission = await prisma.artistSubmission.update({
    where: { id: req.params.id },
    data: { status: "REJECTED", reviewNote: req.body.reviewNote, reviewedById: req.user.id, reviewedAt: new Date() },
  });
  res.json({ submission });
});

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);
}

module.exports = router;
