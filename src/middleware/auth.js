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

// Like requireAuth but never blocks the request — attaches req.user when a
// valid token is present, otherwise just moves on. For routes a signed-out
// visitor can still use (e.g. submitting a design request), where being
// logged in just means "attach my account" rather than "required to enter."
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user) req.user = user;
  } catch {
    // Invalid/expired token — proceed as a signed-out visitor rather than erroring.
  }
  next();
}

function requireArtist(req, res, next) {
  if (!req.user?.isArtist) return res.status(403).json({ error: "Artist account required" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: "Admin access required" });
  next();
}

module.exports = { requireAuth, optionalAuth, requireArtist, requireAdmin };
