const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { encrypt } = require("../lib/crypto");
const { requireAuth } = require("../middleware/auth");
const { buildAuthUrl, exchangeCodeForTokens } = require("../lib/googleCalendar");

const router = express.Router();

// GOOGLE_CLIENT_ID/SECRET aren't set up yet (needs a Google Cloud project —
// see src/lib/googleCalendar.js's doc comment) — every route here 501s
// until they exist, rather than failing confusingly deep inside a fetch call.
function requireGoogleConfigured(req, res, next) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(501).json({ error: "Calendar connection isn't configured yet — GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET aren't set." });
  }
  next();
}

router.get("/status", requireAuth, async (req, res) => {
  const conn = await prisma.calendarConnection.findUnique({ where: { userId: req.user.id } });
  res.json({ connected: !!conn, connectedAt: conn?.connectedAt || null, lastSyncedAt: conn?.lastSyncedAt || null });
});

// Returns the Google consent URL rather than redirecting directly — the
// frontend's fetch call carries the user's JWT in an Authorization header,
// which a plain browser navigation to Google can't send. The frontend does
// `window.location.href = url` with what this returns instead.
router.get("/connect", requireAuth, requireGoogleConfigured, (req, res) => {
  // Short-lived state token carries which user this is for through the
  // round trip to Google and back — the callback below is an unauthenticated
  // browser redirect (no Authorization header), so this is how it knows.
  const state = jwt.sign({ userId: req.user.id, purpose: "calendar_connect" }, process.env.JWT_SECRET, { expiresIn: "10m" });
  res.json({ url: buildAuthUrl(req, state) });
});

// Google redirects the browser here after the user approves (or denies)
// access. Not behind requireAuth — this request comes from Google, not from
// an authenticated fetch — the signed state param is what proves who it's for.
router.get("/callback", requireGoogleConfigured, async (req, res) => {
  const { code, state, error } = req.query;
  const redirectHome = (query) => res.redirect(`/?${query}`);

  if (error) return redirectHome("calendar=denied");
  if (!code || !state) return redirectHome("calendar=error");

  let userId;
  try {
    const payload = jwt.verify(state, process.env.JWT_SECRET);
    if (payload.purpose !== "calendar_connect") throw new Error("wrong token purpose");
    userId = payload.userId;
  } catch {
    return redirectHome("calendar=error"); // expired (>10min) or tampered state
  }

  try {
    const tokens = await exchangeCodeForTokens(req, code);
    if (!tokens.refresh_token) {
      // Google only sends a refresh_token on first-ever consent (or when
      // prompt=consent forces re-issue, which buildAuthUrl always sets) —
      // if it's still missing something's off; don't silently half-connect.
      return redirectHome("calendar=error");
    }
    await prisma.calendarConnection.upsert({
      where: { userId },
      update: { refreshTokenEnc: encrypt(tokens.refresh_token), scope: tokens.scope || "" },
      create: { userId, refreshTokenEnc: encrypt(tokens.refresh_token), scope: tokens.scope || "" },
    });
    return redirectHome("calendar=connected");
  } catch (err) {
    console.error("Calendar connect failed:", err.message);
    return redirectHome("calendar=error");
  }
});

router.post("/disconnect", requireAuth, async (req, res) => {
  await prisma.calendarConnection.deleteMany({ where: { userId: req.user.id } });
  res.json({ ok: true });
});

module.exports = router;
