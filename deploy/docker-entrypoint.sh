#!/bin/sh
# Runs on every container start, not just the first one — `prisma migrate
# deploy` is safe to run repeatedly (it only applies migrations that
# haven't been applied yet, and no-ops instantly otherwise). This is what
# finally removes the manual "did you remember to run the migration"
# step that caused real production outages on Vercel: here, it runs
# automatically, every deploy, against whatever DATABASE_URL/DIRECT_URL
# this container actually has.
set -e

echo "[entrypoint] Applying database migrations..."
npx prisma migrate deploy

echo "[entrypoint] Starting resembles.nothing..."
exec "$@"
