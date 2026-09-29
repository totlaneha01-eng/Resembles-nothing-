const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { sendEmail } = require("../lib/email");
const { publicUser } = require("../lib/publicUser");

const router = express.Router();

function signToken(userId) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set — add it in the deployment's environment variables");
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
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

// Always responds the same way whether or not the email has an account —
// otherwise this endpoint becomes a free "does this email have an account"
// oracle. The token itself is a random 32-byte value; only its SHA-256 hash
// is stored (same reasoning as a password hash — a stolen DB row shouldn't
// hand out a working reset link), and it's single-use and expires in an hour.
router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const genericResponse = { ok: true, message: "If an account exists for that email, we've sent a reset link." };
    if (!email) return res.status(400).json({ error: "Enter your email" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json(genericResponse); // don't leak whether the account exists

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your resembles.nothing password",
      html: `<p>Hi ${user.name},</p><p>Click below to set a new password. This link expires in 1 hour and only works once.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Didn't request this? You can safely ignore this email.</p>`,
    });

    res.json(genericResponse);
  } catch (err) {
    console.error("auth/forgot-password failed:", err);
    res.status(500).json({ error: "Something went wrong — try again." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Missing token or password" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: "This reset link is invalid or has expired — request a new one." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error("auth/reset-password failed:", err);
    res.status(500).json({ error: "Couldn't reset your password — try again." });
  }
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
