const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function signToken(userId) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set — add it in the deployment's environment variables");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function publicUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}

// Every handler below is wrapped in try/catch on purpose — Express 4 doesn't
// forward a rejected promise from an async route to the error middleware, so
// an unguarded route that throws (e.g. a missing JWT_SECRET) doesn't 500, it
// just never responds and hangs until the platform times the request out.
// See routes/orders.js's /manual handler for the same pattern.
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password are required" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "An account already exists for this email" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });
    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    console.error("auth/signup failed:", err);
    res.status(500).json({ error: "Couldn't create your account — try again." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Incorrect email or password" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Incorrect email or password" });

    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    console.error("auth/login failed:", err);
    res.status(500).json({ error: "Couldn't sign you in — try again." });
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Lets a user link the WhatsApp number every order/cart notification will go to.
router.post("/whatsapp-opt-in", requireAuth, async (req, res) => {
  try {
    const { whatsappNumber } = req.body; // E.164 format, e.g. +919876543210
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { whatsappNumber, whatsappOptIn: true },
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("auth/whatsapp-opt-in failed:", err);
    res.status(500).json({ error: "Couldn't save that number — try again." });
  }
});

module.exports = router;
