// Minimal Google Calendar OAuth + read client — deliberately built on raw
// fetch rather than the `googleapis` npm package, matching how
// src/lib/whatsapp.js talks to Meta's Graph API directly. Keeps the
// dependency list small for what's really three HTTP calls.
//
// Setup (one-time, in Google Cloud Console — see prisma/schema.prisma's
// CalendarConnection doc comment for why only a refresh token is stored):
//   1. console.cloud.google.com -> new project -> enable "Google Calendar API".
//   2. OAuth consent screen -> External -> add scope
//      https://www.googleapis.com/auth/calendar.readonly -> add yourself as
//      a test user while in Testing mode.
//   3. Credentials -> Create Credentials -> OAuth client ID -> Web
//      application -> Authorized redirect URI: <your domain>/api/calendar/callback
//   4. Put the resulting Client ID + Secret in GOOGLE_CLIENT_ID /
//      GOOGLE_CLIENT_SECRET (Render's Environment tab in production).
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

function redirectUri(req) {
  // Same Express app serves the API and the static frontend from one
  // origin (see src/index.js), so the callback always comes back here —
  // no separate FRONTEND_URL needed, just derive our own base URL.
  return `${req.protocol}://${req.get("host")}/api/calendar/callback`;
}

function buildAuthUrl(req, state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline", // required to get a refresh_token back
    prompt: "consent", // forces a refresh_token on every connect, not just the first
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// Exchanges a one-time auth code (from the callback's ?code=) for tokens.
async function exchangeCodeForTokens(req, code) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(req),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Google token exchange failed");
  return data; // { access_token, refresh_token, expires_in, scope, ... }
}

// A refresh_token has no expiry (until revoked), so this is called fresh
// every time we need to read a calendar rather than caching access tokens.
async function getAccessToken(refreshToken) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Google token refresh failed");
  return data.access_token;
}

// Pulls events in the next `daysAhead` days whose title mentions a birthday
// or anniversary. Good enough as a first pass — Google's separate "Contacts'
// birthdays" calendar would catch more, but needs a second calendarId and
// its own read, left for later if this doesn't surface enough matches.
async function getUpcomingGiftDates(refreshToken, daysAhead = 14) {
  const accessToken = await getAccessToken(refreshToken);
  const now = new Date();
  const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: until.toISOString(),
    singleEvents: "true", // expands recurring events (birthdays repeat yearly) into concrete instances
    orderBy: "startTime",
    maxResults: "50",
  });
  const res = await fetch(`${CALENDAR_EVENTS_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Google Calendar read failed");

  const KEYWORDS = /birthday|anniversary/i;
  return (data.items || [])
    .filter((e) => KEYWORDS.test(e.summary || ""))
    .map((e) => ({
      title: e.summary,
      date: e.start?.date || e.start?.dateTime,
    }));
}

module.exports = { buildAuthUrl, exchangeCodeForTokens, getUpcomingGiftDates };
