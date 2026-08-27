require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const prisma = require("./lib/prisma");

const app = express();
// Render sits in front of this app as a reverse proxy — without this,
// req.protocol always reports "http" even on a real https:// request, which
// breaks Google OAuth's exact redirect_uri match (src/lib/googleCalendar.js
// builds it from req.protocol). Harmless for everything else already here.
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());

// Public marketing site (public/index.html) — a static landing page, not the
// interactive shop. It sends buyers to Instagram/WhatsApp DMs to order, so it
// doesn't call any of the /api routes below.
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/artists", require("./routes/artists"));
app.use("/api/payouts", require("./routes/payouts"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/quiz", require("./routes/quiz"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/calendar", require("./routes/calendar"));
app.use("/api/admin", require("./routes/admin"));
app.use("/webhooks/whatsapp", require("./routes/whatsappWebhook"));

app.get("/health", (req, res) => res.json({ ok: true }));

// Centralized error handler — catches errors thrown synchronously in a route,
// or passed explicitly via next(err). It does NOT catch a rejected promise
// inside an async route handler on Express 4 (no autonomous forwarding to
// error middleware — that's an Express 5 change) — a route that awaits
// something and doesn't wrap it in its own try/catch can still take the
// whole process down. See routes/orders.js for the pattern that route uses.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Something went wrong" });
});

// Last-resort safety net: if some route anywhere still lets a rejection
// escape uncaught, log it instead of letting Node terminate the process.
// Losing one request to a 500 the client never sees is bad; losing the
// entire site for every visitor because of it is much worse.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (server kept running):", reason);
});

// Admin bootstrap without Shell access — Render's Shell tab is a paid-plan
// feature, so `node scripts/make-admin.js <email>` isn't runnable on a free
// service. This gives the same result from the (free-tier) Environment tab
// instead: set ADMIN_BOOTSTRAP_EMAIL to the account's email and redeploy
// (Render redeploys automatically on an env var change) — on boot, if a user
// with that exact email exists and isn't already an admin, it's promoted.
// Safe to leave set permanently: it only ever matches one account (whoever
// controls the Render dashboard chose that email) and no-ops once that
// account is already an admin.
async function bootstrapAdminFromEnv() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  if (!email) return;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`Admin bootstrap: no account found for ${email} yet — sign up first, then redeploy.`);
      return;
    }
    if (user.isAdmin) return;
    await prisma.user.update({ where: { email }, data: { isAdmin: true } });
    console.log(`Admin bootstrap: ${email} is now an admin.`);
  } catch (err) {
    console.error("Admin bootstrap failed (server still starting normally):", err.message);
  }
}
bootstrapAdminFromEnv();

// Gift reminders: check everyone's connected calendar once a day for an
// upcoming birthday/anniversary. No cron infra for this (no node-cron
// dependency, no Render Cron Job service) — one setInterval in this
// long-running process is enough at this scale. No-ops entirely (an empty
// CalendarConnection table means nothing to check) until GOOGLE_CLIENT_ID/
// GOOGLE_CLIENT_SECRET exist and at least one user has connected — see
// src/lib/googleCalendar.js and src/routes/calendar.js.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const { runGiftSync } = require("./lib/giftSync");
  setTimeout(() => runGiftSync().catch((err) => console.error("Gift sync failed:", err.message)), 60_000); // wait a minute after boot, not in the critical startup path
  setInterval(() => runGiftSync().catch((err) => console.error("Gift sync failed:", err.message)), ONE_DAY_MS);
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`resembles.nothing API running on :${PORT}`));
