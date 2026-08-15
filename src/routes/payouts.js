const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireArtist, requireAdmin } = require("../middleware/auth");
const { encrypt } = require("../lib/crypto");

const router = express.Router();

router.post("/bank-details", requireAuth, requireArtist, async (req, res) => {
  const { accountHolderName, accountNumber, ifsc, upiId } = req.body;
  const bankDetails = await prisma.bankDetails.upsert({
    where: { userId: req.user.id },
    update: { accountHolderName, accountNumberEnc: encrypt(accountNumber), ifsc, upiId },
    create: { userId: req.user.id, accountHolderName, accountNumberEnc: encrypt(accountNumber), ifsc, upiId },
  });
  res.json({ ok: true, id: bankDetails.id }); // never echo the encrypted value back
});

// What an artist earns, sale by sale — mirrors "My Submissions" earnings in the frontend.
router.get("/mine", requireAuth, requireArtist, async (req, res) => {
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
});

// Admin-side payout ledger — everything currently owed to artists, across everyone.
// Actually moving the money (via RazorpayX Payouts, Cashfree, or a manual bank
// transfer) happens outside this API; this just tracks what's owed and marks it paid.
router.get("/ledger", requireAuth, requireAdmin, async (req, res) => {
  const pending = await prisma.orderItem.findMany({
    where: { artistPayoutStatus: "PENDING" },
    include: { artist: { select: { name: true, email: true } }, product: true },
  });
  res.json({ pending });
});

router.post("/ledger/:orderItemId/mark-paid", requireAuth, requireAdmin, async (req, res) => {
  const item = await prisma.orderItem.update({
    where: { id: req.params.orderItemId },
    data: { artistPayoutStatus: "PAID", artistPayoutPaidAt: new Date() },
  });
  res.json({ item });
});

module.exports = router;
