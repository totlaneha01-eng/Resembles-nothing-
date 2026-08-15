const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Sign in required" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: "Session no longer valid" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired — please sign in again" });
  }
}

function requireArtist(req, res, next) {
  if (!req.user?.isArtist) return res.status(403).json({ error: "Artist account required" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: "Admin access required" });
  next();
}

module.exports = { requireAuth, requireArtist, requireAdmin };
