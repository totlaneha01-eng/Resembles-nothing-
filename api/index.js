// Vercel's entry point. Every request (API routes, the SPA fallback,
// webhooks, health, sitemap.xml) gets routed here by vercel.json — real
// static files (images, JS/CSS bundles) never reach this file at all;
// Vercel serves those directly first (see the "handle": "filesystem" rule
// in vercel.json). This just hands everything else to the same Express app
// Render and local dev already run — see src/index.js for the app itself.
module.exports = require("../src/index.js");
