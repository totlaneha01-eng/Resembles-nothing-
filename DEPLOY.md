# Deploying resembles.nothing on your own server

This app already runs as a plain long-running Node/Express process (see
`src/index.js`'s `app.listen()` at the bottom) — Vercel's serverless entry
point (`api/index.js`) was always just a thin wrapper around the same app.
Moving off Vercel is an infrastructure change, not a code rewrite.

The database stays on Supabase either way — this only moves where the Node
process itself runs. Two ways to do that are set up here: **Docker**
(recommended — one command, consistent environment) or a **plain systemd
service** (if you'd rather not use Docker).

## Prerequisites

- A server (VPS or physical) with a public IP, port 80/443 reachable
- A domain pointed at it (an `A` record for `resemblesnothing.in` and
  `www.resemblesnothing.in` → the server's IP)
- Your Supabase `DATABASE_URL` and `DIRECT_URL`, fetched fresh from the
  Supabase dashboard (Settings → Database → Connection string) — not
  copied from an old `.env`, in case the password's been rotated
- Everything else `.env.example` lists (WhatsApp, Resend, Google Calendar
  creds are all optional — those features just stay off without them)

## Option A — Docker (recommended)

```bash
git clone <this repo> resembles-nothing
cd resembles-nothing
cp .env.example .env
# fill in .env — at minimum DATABASE_URL, DIRECT_URL, JWT_SECRET,
# BANK_ENCRYPTION_KEY

docker compose up -d --build
```

That's it. The container's entrypoint (`deploy/docker-entrypoint.sh`) runs
`prisma migrate deploy` automatically on every start before the app boots —
so a `git pull && docker compose up -d --build` after a future schema
change applies the migration for you instead of being a manual step you
have to remember (that step being missed is what caused the production
outages on Vercel earlier this project).

Check it's up:

```bash
curl http://localhost:4000/health
# {"ok":true}
docker compose logs -f app
```

### Updating after a code change

```bash
git pull
docker compose up -d --build
```

## Option B — plain systemd (no Docker)

```bash
sudo mkdir -p /opt/resembles-nothing
sudo chown $USER /opt/resembles-nothing
git clone <this repo> /opt/resembles-nothing
cd /opt/resembles-nothing

cp .env.example .env   # fill it in, same as Option A

npm ci
cd frontend && npm ci && npm run build && cd ..   # builds into ../public

npx prisma migrate deploy   # manual here — see the service file's own note

sudo cp deploy/resembles-nothing.service /etc/systemd/system/
# edit User= and the paths in that file to match your server first
sudo systemctl daemon-reload
sudo systemctl enable --now resembles-nothing
```

Unlike Docker, this path does **not** run migrations automatically on
restart — after any future `git pull` that includes a schema change, run
`npx prisma migrate deploy` by hand before `sudo systemctl restart
resembles-nothing`, same discipline as before.

## nginx + HTTPS

Either option above binds the app to `127.0.0.1:4000` — nginx sits in
front, terminates TLS, and proxies to it.

```bash
sudo apt install nginx certbot python3-certbot-nginx   # Debian/Ubuntu

sudo cp deploy/nginx.conf /etc/nginx/sites-available/resemblesnothing.in
sudo ln -s /etc/nginx/sites-available/resemblesnothing.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d resemblesnothing.in -d www.resemblesnothing.in
```

`certbot --nginx` rewrites the config to redirect HTTP → HTTPS and fills in
the certificate paths automatically — `deploy/nginx.conf` is deliberately
just the plain-HTTP starting point so certbot has something working to
modify.

## Admin bootstrap

Same as before: set `ADMIN_BOOTSTRAP_EMAIL` in `.env` to your account's
email (comma-separated for more than one), and it's promoted on the app's
next boot — matched case-insensitively, so a signup that got
autocapitalized still resolves correctly.

## What's unaffected by this move

- The database (still Supabase, same data)
- `src/lib/*` business logic, all API routes, the frontend — none of this
  is Vercel-specific and none of it changed for this move
- `vercel.json`/`api/index.js` are left in place, untouched, in case you
  ever want Vercel as a fallback — they don't interfere with running this
  way

## What actually changes

- You now own uptime, SSL renewal (certbot auto-renews via its own systemd
  timer/cron — verify with `sudo certbot renew --dry-run`), and server
  patching, none of which Vercel handled for you before
- No more "did the migration actually apply" guessing — Option A makes
  that automatic
