const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireArtist, requireAdmin } = require("../middleware/auth");
const { publicUser } = require("../lib/publicUser");
const { generateProductSeoContent } = require("../lib/seoContent");

const router = express.Router();

// Anyone can apply to become an artist — no purchase history required,
// matching what's promised on the frontend. Bank details are collected
// separately via POST /api/payouts/bank-details before their first submission.
router.post("/apply", requireAuth, async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { isArtist: true } });
  res.json({ user: publicUser(user) });
});

router.post("/submissions", requireAuth, requireArtist, async (req, res) => {
  try {
    const { title, description, suggestedPrice, imageUrl } = req.body;
    // "This is a specific, already-painted piece" — not a design to be
    // printed. Formats/editionSize don't apply the normal way: it's always
    // exactly one physical object, so formats is forced to ["ORIGINAL"]
    // regardless of what (if anything) was checked on the form, and
    // editionSize is forced to 1 rather than trusting the field.
    const isOriginal = req.body.isOriginal === true;
    // A submission can propose more than one format (e.g. "I'd like this sold
    // as both a Tapestry and a Canvas"); accept a legacy single `format` too.
    const formats = isOriginal
      ? ["ORIGINAL"]
      : Array.isArray(req.body.formats) && req.body.formats.length ? req.body.formats : req.body.format ? [req.body.format] : [];
    const editionSize = isOriginal ? 1 : (Number.isInteger(req.body.editionSize) && req.body.editionSize > 0 ? req.body.editionSize : 1);
    let widthCm = null;
    let heightCm = null;
    if (isOriginal) {
      widthCm = Number(req.body.widthCm);
      heightCm = Number(req.body.heightCm);
      if (!Number.isFinite(widthCm) || widthCm <= 0 || !Number.isFinite(heightCm) || heightCm <= 0) {
        return res.status(400).json({ error: "An original piece needs its real width and height (cm)" });
      }
    }
    const submission = await prisma.artistSubmission.create({
      data: { artistId: req.user.id, title, description, formats, isOriginal, widthCm, heightCm, editionSize, suggestedPrice, imageUrl },
    });
    res.json({ submission });
  } catch (err) {
    console.error("artists POST /submissions failed:", err);
    res.status(500).json({ error: "Couldn't submit that design — try again." });
  }
});

router.get("/submissions/mine", requireAuth, requireArtist, async (req, res) => {
  try {
    const submissions = await prisma.artistSubmission.findMany({
      where: { artistId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ submissions });
  } catch (err) {
    console.error("artists GET /submissions/mine failed:", err);
    res.status(500).json({ error: "Couldn't load your submissions — try again." });
  }
});

// ---- Admin review queue ----

router.get("/submissions/pending", requireAuth, requireAdmin, async (req, res) => {
  try {
    const submissions = await prisma.artistSubmission.findMany({
      where: { status: "PENDING" },
      include: { artist: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({ submissions });
  } catch (err) {
    console.error("artists GET /submissions/pending failed:", err);
    res.status(500).json({ error: "Couldn't load pending submissions — try again." });
  }
});

router.post("/submissions/:id/approve", requireAuth, requireAdmin, async (req, res) => {
  try {
    const submission = await prisma.artistSubmission.findUnique({ where: { id: req.params.id } });
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    // Without this check, a slow request followed by an admin clicking
    // Approve again (or a retried request) re-runs this whole handler for a
    // submission that's already been turned into a product. The second
    // attempt then hits Product.submissionId's unique constraint and throws
    // — and since Express 4 doesn't forward a rejected promise from an async
    // handler to the error middleware, that request used to just hang
    // instead of failing visibly, which is what made the button look broken.
    if (submission.status !== "PENDING") {
      return res.status(409).json({ error: `Already ${submission.status.toLowerCase()} — refresh the submissions list.` });
    }

    const slug = slugify(submission.title);
    const category = req.body.category || "Abstract";
    const blurb = req.body.blurb || submission.description.slice(0, 80);
    const isOriginal = submission.isOriginal;
    // A print's width is an admin/catalog decision made right here (default
    // 30cm). An original's width/height are facts about a specific physical
    // object the artist already stated at submission time — admin can still
    // correct a mistake via req.body, but there's no sane default to fall
    // back to the way there is for a reproducible print.
    const widthCm = isOriginal ? req.body.widthCm || submission.widthCm : req.body.widthCm || 30;
    const heightCm = isOriginal ? req.body.heightCm || submission.heightCm : null;
    if (isOriginal && (!widthCm || !heightCm)) {
      return res.status(400).json({ error: "This original submission is missing its width/height — set both before approving." });
    }
    // Landscape-oriented uploads print fine as Tapestry/Canvas — they just
    // need the admin to flag that at approval, same way category/widthCm
    // already get filled in here (the frontend prefills this from the
    // submitted image's real aspect ratio, but the admin can override it).
    // Not meaningful for an ORIGINAL (its real dims come from widthCm/
    // heightCm directly, not a print's size-tier table) — left PORTRAIT.
    const orientation = !isOriginal && req.body.orientation === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT";
    // Every design approved from here on gets the same real, keyword-relevant
    // description/story as the hand-seeded catalogue — not a copy of the
    // artist's raw submission text — so content quality doesn't degrade as
    // the catalogue scales past the original 217 products. See lib/seoContent.
    const seo = generateProductSeoContent({
      slug,
      name: submission.title,
      category,
      blurb,
      formats: submission.formats,
      widthCm,
      heightCm,
    });

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          slug,
          name: submission.title,
          category,
          price: submission.suggestedPrice,
          widthCm,
          heightCm,
          orientation,
          images: [submission.imageUrl, submission.imageUrl, submission.imageUrl],
          blurb,
          description: seo.description,
          story: seo.story,
          features: req.body.features || [],
          formats: submission.formats,
          editionSize: submission.editionSize,
          artistId: submission.artistId,
          submissionId: submission.id,
        },
      });
      // Guards the same race at the DB level: if two approve requests for
      // this submission are in flight at once, only one can flip PENDING ->
      // APPROVED, so the other's update matches zero rows and throws —
      // inside this transaction, that rolls back its product.create too,
      // instead of leaving two products for one submission.
      const updated = await tx.artistSubmission.updateMany({
        where: { id: submission.id, status: "PENDING" },
        data: { status: "APPROVED", reviewedById: req.user.id, reviewedAt: new Date() },
      });
      if (updated.count === 0) throw new Error("Submission was already reviewed");
      return p;
    });

    res.json({ product });
  } catch (err) {
    console.error("artists/submissions/:id/approve failed:", err);
    res.status(500).json({ error: "Couldn't approve that submission — try again." });
  }
});

router.post("/submissions/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { count } = await prisma.artistSubmission.updateMany({
      where: { id: req.params.id, status: "PENDING" },
      data: { status: "REJECTED", reviewNote: req.body.reviewNote, reviewedById: req.user.id, reviewedAt: new Date() },
    });
    if (count === 0) return res.status(409).json({ error: "Already reviewed, or no longer pending — refresh the submissions list." });
    const submission = await prisma.artistSubmission.findUnique({ where: { id: req.params.id } });
    res.json({ submission });
  } catch (err) {
    console.error("artists/submissions/:id/reject failed:", err);
    res.status(500).json({ error: "Couldn't reject that submission — try again." });
  }
});

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);
}

module.exports = router;
