const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public — the footer "Stay in the loop" form. No auth: most visitors
// signing up here haven't made an account yet.
router.post("/subscribe", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address" });

  // Idempotent — resubmitting the same email (e.g. a double click) just
  // succeeds quietly instead of erroring.
  await prisma.newsletterSubscriber.upsert({
    where: { email },
    update: {},
    create: { email },
  });
  res.json({ ok: true });
});

module.exports = router;
