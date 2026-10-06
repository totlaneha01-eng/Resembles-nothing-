const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireArtist, requireAdmin } = require("../middleware/auth");
const { encrypt } = require("../lib/crypto");

const router = express.Router();

router.post("/bank-details", requireAuth, requireArtist, async (req, res) => {
  try {
    const { accountHolderName, accountNumber, ifsc, upiId } = req.body;
    const bankDetails = await prisma.bankDetails.upsert({
      where: { userId: req.user.id },
      update: { accountHolderName, accountNumberEnc: encrypt(accountNumber), ifsc, upiId },
      create: { userId: req.user.id, accountHolderName, accountNumberEnc: encrypt(accountNumber), ifsc, upiId },
    });
    res.json({ ok: true, id: bankDetails.id }); // never echo the encrypted value back
  } catch (err) {
    console.error("payouts POST /bank-details failed:", err);
    res.status(500).json({ error: "Couldn't save your bank details — try again." });
  }
});

// What an artist earns, sale by sale — mirrors "My Submissions" earnings in the frontend.
router.get("/mine", requireAuth, requireArtist, async (req, res) => {
  try {
    const items = await prisma.orderItem.findMany({
      where: { artistId: req.user.id },
      include: { product: true, order: { select: { status: true, createdAt: true } } },
      orderBy: { id: "desc" },
    });
    const totals = items.reduce(
      (acc, i) => {
        acc.total += i.artistPayoutAmount || 0;
        if (i.artistPayoutStatus === "PAID") acc.paid += i.artistPayoutAmount || 0;
        else acc.pending += i.artistPayoutAmount || 0;
        return acc;
      },
      { total: 0, paid: 0, pending: 0 }
    );
    res.json({ items, totals });
  } catch (err) {
    console.error("payouts GET /mine failed:", err);
    res.status(500).json({ error: "Couldn't load your earnings — try again." });
  }
});

// Admin-side payout ledger — everything currently owed to artists, across everyone.
// Actually moving the money (via a payout provider or a manual bank transfer)
// happens outside this API; this just tracks what's owed and marks it paid.
router.get("/ledger", requireAuth, requireAdmin, async (req, res) => {
  try {
    const pending = await prisma.orderItem.findMany({
      where: { artistPayoutStatus: "PENDING" },
      include: { artist: { select: { name: true, email: true } }, product: true },
    });
    res.json({ pending });
  } catch (err) {
    console.error("payouts GET /ledger failed:", err);
    res.status(500).json({ error: "Couldn't load the payout ledger — try again." });
  }
});

// An ORIGINAL sale's payout can't be computed at order time (see
// routes/orders.js) — it needs the actual transport/packaging/marketing
// cost for that specific sale first. This is that step: the admin enters
// the real overhead once it's known, and this computes the 50/50 split of
// what's left and stores both numbers (kept separate — artistPayoutAmount
// is what actually gets paid, artistPayoutOverheadAmount is what was
// deducted to get there, visible on the ledger for anyone checking the math).
router.post("/ledger/:orderItemId/finalize-original", requireAuth, requireAdmin, async (req, res) => {
  try {
    const overheadAmount = Number(req.body.overheadAmount); // paise
    if (!Number.isFinite(overheadAmount) || overheadAmount < 0) {
      return res.status(400).json({ error: "overheadAmount must be a non-negative number (in paise)" });
    }
    const item = await prisma.orderItem.findUnique({ where: { id: req.params.orderItemId } });
    if (!item) return res.status(404).json({ error: "Order item not found" });
    if (item.format !== "ORIGINAL") return res.status(400).json({ error: "This endpoint is only for format: ORIGINAL order items" });
    if (overheadAmount > item.priceINR) return res.status(400).json({ error: "overheadAmount can't exceed the sale price" });

    const netForSplit = item.priceINR - overheadAmount;
    const artistPayoutAmount = Math.round(netForSplit / 2);

    const updated = await prisma.orderItem.update({
      where: { id: item.id },
      data: { artistPayoutAmount, artistPayoutOverheadAmount: overheadAmount },
    });
    res.json({ item: updated });
  } catch (err) {
    console.error("payouts POST /ledger/:orderItemId/finalize-original failed:", err);
    res.status(500).json({ error: "Couldn't finalize that payout — try again." });
  }
});

router.post("/ledger/:orderItemId/mark-paid", requireAuth, requireAdmin, async (req, res) => {
  try {
    const item = await prisma.orderItem.update({
      where: { id: req.params.orderItemId },
      data: { artistPayoutStatus: "PAID", artistPayoutPaidAt: new Date() },
    });
    res.json({ item });
  } catch (err) {
    console.error("payouts POST /ledger/:orderItemId/mark-paid failed:", err);
    res.status(500).json({ error: "Couldn't mark that as paid — try again." });
  }
});

module.exports = router;
