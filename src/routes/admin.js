const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// One aggregate endpoint the admin dashboard calls on load. Split into
// separate cached queries once traffic makes a single call too slow.
router.get("/dashboard", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalArtists,
      totalOrders,
      revenueAgg,
      pendingSubmissions,
      pendingPayouts,
      topProducts,
      recentOrders,
      recentSubmissions,
      categoryBreakdown,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isArtist: true } }),
      prisma.order.count({ where: { status: { not: "CANCELLED" } } }),
      prisma.order.aggregate({ where: { status: { not: "CANCELLED" } }, _sum: { totalAmount: true } }),
      prisma.artistSubmission.count({ where: { status: "PENDING" } }),
      prisma.orderItem.aggregate({ where: { artistPayoutStatus: "PENDING" }, _sum: { artistPayoutAmount: true } }),
      prisma.orderItem.groupBy({ by: ["productId"], _count: { productId: true }, orderBy: { _count: { productId: "desc" } }, take: 5 }),
      prisma.order.findMany({ take: 10, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } }, items: true } }),
      // Every status, not just PENDING — this is "what's been happening"
      // for the Activity feed, not the review queue (that's the Submissions
      // panel, which only cares about PENDING).
      prisma.artistSubmission.findMany({ take: 10, orderBy: { createdAt: "desc" }, include: { artist: { select: { name: true } } } }),
      prisma.product.groupBy({ by: ["category"], _count: { category: true } }),
    ]);

    res.json({
      totals: {
        users: totalUsers,
        artists: totalArtists,
        orders: totalOrders,
        revenue: revenueAgg._sum.totalAmount || 0,
        pendingSubmissions,
        artistPayoutsOwed: pendingPayouts._sum.artistPayoutAmount || 0,
      },
      topProducts,
      recentOrders,
      recentSubmissions,
      categoryBreakdown,
    });
  } catch (err) {
    console.error("admin/dashboard failed:", err);
    res.status(500).json({ error: "Couldn't load the dashboard — try again." });
  }
});

// Every account on the platform, not just artists — the dashboard's stat
// grid only ever showed a total count with nothing behind it. Useful on its
// own, and also the quickest way to answer "is this account actually an
// admin, and does its stored email look right" without a direct DB console.
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
        isArtist: true,
        createdAt: true,
        _count: { select: { orders: true, submissions: true, products: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  } catch (err) {
    console.error("admin/users failed:", err);
    res.status(500).json({ error: "Couldn't load users — try again." });
  }
});

// Every artist account, regardless of whether they've published a live
// product yet — the dashboard's "Artist Roster" used to be derived purely
// from published Products, so someone who'd only just applied (no
// submissions approved yet) was invisible there. This is the real source.
router.get("/artists", requireAuth, requireAdmin, async (req, res) => {
  try {
    const artists = await prisma.user.findMany({
      where: { isArtist: true },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: { select: { submissions: true, products: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ artists });
  } catch (err) {
    console.error("admin/artists failed:", err);
    res.status(500).json({ error: "Couldn't load artists — try again." });
  }
});

// Per-user activity — "what is this specific person doing" drill-down.
router.get("/users/:id/activity", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [orders, cartItems, submissions, reviews] = await Promise.all([
      prisma.order.findMany({ where: { userId: req.params.id }, include: { items: true } }),
      prisma.cartItem.findMany({ where: { userId: req.params.id }, include: { product: true } }),
      prisma.artistSubmission.findMany({ where: { artistId: req.params.id } }),
      prisma.review.findMany({ where: { userId: req.params.id } }),
    ]);
    res.json({ orders, cartItems, submissions, reviews });
  } catch (err) {
    console.error("admin/users/:id/activity failed:", err);
    res.status(500).json({ error: "Couldn't load that user's activity — try again." });
  }
});

module.exports = router;
