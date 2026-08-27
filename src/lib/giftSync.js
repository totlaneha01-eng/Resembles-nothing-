// Daily job: for every connected calendar, check for a birthday/anniversary
// in the next 2 weeks and nudge the user with a couple of gift picks. Wired
// up from src/index.js — no separate cron infra (no node-cron dependency,
// no Render Cron Job service) since a single setInterval in the one
// long-running web process is enough at this scale.
const prisma = require("./prisma");
const { decrypt } = require("./crypto");
const { getUpcomingGiftDates } = require("./googleCalendar");
const { notifyUser } = require("./whatsapp");

// Register this exact template in Meta Business Manager before it can
// actually send — see src/lib/whatsapp.js's setup note. Until then,
// notifyUser still writes the NotificationLog row (status "failed" or
// "skipped_no_optin"), so the in-app bell isn't blocked on that.
const GIFT_REMINDER_TEMPLATE = "gift_reminder";

async function pickGiftSuggestions(count = 3) {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  // Small in-memory shuffle over the newest 20 — fine at this catalog size;
  // revisit with a proper random SQL sample if the catalog gets much bigger.
  return products.sort(() => Math.random() - 0.5).slice(0, count);
}

async function syncOneConnection(conn) {
  const refreshToken = decrypt(conn.refreshTokenEnc);
  const upcoming = await getUpcomingGiftDates(refreshToken);

  for (const event of upcoming) {
    const suggestions = await pickGiftSuggestions();
    const names = suggestions.map((p) => p.name).join(", ");
    await notifyUser(conn.userId, {
      title: `${event.title} is coming up`,
      body: `${event.title} on ${event.date} — a few picks they'd actually love: ${names}.`,
      templateName: GIFT_REMINDER_TEMPLATE,
      templateParams: [event.title, event.date, names],
    });
  }

  await prisma.calendarConnection.update({
    where: { id: conn.id },
    data: { lastSyncedAt: new Date() },
  });
}

async function runGiftSync() {
  const connections = await prisma.calendarConnection.findMany();
  for (const conn of connections) {
    try {
      await syncOneConnection(conn);
    } catch (err) {
      // One user's expired/revoked Google token shouldn't stop everyone
      // else's sync — log and move on, matching the defensive style used
      // for admin bootstrap and the global unhandledRejection handler.
      console.error(`Gift sync failed for user ${conn.userId}:`, err.message);
    }
  }
}

module.exports = { runGiftSync };
