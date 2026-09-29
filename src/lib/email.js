// Sends transactional email via Resend's HTTP API (https://resend.com) — no
// SDK, just fetch, same style as src/lib/whatsapp.js's Meta Graph API calls.
// Setup: create a Resend account, verify a sending domain (or use their
// shared onboarding domain for testing), generate an API key, and put
// RESEND_API_KEY + RESEND_FROM_EMAIL in your .env.
//
// Until those are set, sendEmail() logs instead of sending — same
// "quietly stays off" pattern as the Google Calendar integration — so
// forgot-password still works end-to-end in dev without a real account:
// the reset link just lands in the server console instead of an inbox.
async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    console.log(`[email not configured — would send] To: ${to} | Subject: ${subject}\n${html}`);
    return { skipped: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
  return res.json();
}

module.exports = { sendEmail };
