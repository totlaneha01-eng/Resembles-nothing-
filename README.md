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
