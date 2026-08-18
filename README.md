# resembles.nothing — API

This is the backend for the frontend prototype (`resembles-nothing-shop.jsx`).
Everything in the frontend that was labeled "demo" — cart, login, checkout,
notifications, artist submissions, payouts — has a real endpoint here to
replace it with.

## Stack

- **Node.js + Express** — API server
- **PostgreSQL + Prisma** — database (schema in `prisma/schema.prisma`)
- **Razorpay** — payment processing
- **WhatsApp Business Cloud API** (Meta) — order status + cart notifications
- **JWT** — auth (swap for sessions/Clerk/Auth0 if you'd rather not roll your own)

## Setup

```bash
npm install
cp .env.example .env        # fill in real values, see below
npx prisma migrate dev      # creates the database tables
npm run seed                # loads the 14 designs from the prototype
npm run dev                 # starts the API on :4000
```

## Deploying (Render or similar)

Migrations are checked into `prisma/migrations/` and must be *applied*, not
regenerated, in production:

- **Build Command:** `npm install && npm run build`
  (`npm run build` runs `prisma generate && prisma migrate deploy`)
- **Start Command:** `npm start`

`prisma migrate deploy` only applies migration files that already exist in
`prisma/migrations/` — it never creates new ones. If tables aren't showing
up in production, check that the Build Command above (not just `npm start`)
is what's actually configured for the service, and that `DATABASE_URL`
points at the same database the app connects to at runtime.
