const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// One aggregate endpoint the admin dashboard calls on load. Split into
// separate cached queries once traffic makes a single call too slow.
router.get("/dashboard", requireAuth, requireAdmin, async (req, res) => {
  const [
    totalUsers,
    totalArtists,
    totalOrders,
    revenueAgg,
    pendingSubmissions,
    pendingPayouts,
    topProducts,
    recentOrders,
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
    categoryBreakdown,
  });
});

// Per-user activity — "what is this specific person doing" drill-down.
router.get("/users/:id/activity", requireAuth, requireAdmin, async (req, res) => {
  const [orders, cartItems, submissions, reviews] = await Promise.all([
    prisma.order.findMany({ where: { userId: req.params.id }, include: { items: true } }),
    prisma.cartItem.findMany({ where: { userId: req.params.id }, include: { product: true } }),
    prisma.artistSubmission.findMany({ where: { artistId: req.params.id } }),
    prisma.review.findMany({ where: { userId: req.params.id } }),
  ]);
  res.json({ orders, cartItems, submissions, reviews });
});

module.exports = router;
