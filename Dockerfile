# syntax=docker/dockerfile:1

# ---- Stage 1: build the frontend ----
# frontend/vite.config.ts builds straight into "../public" — relative to
# /repo/frontend, that lands at /repo/public, which stage 2 copies out.
# Keeping this as its own stage (rather than building in stage 2) means the
# frontend's node_modules never end up in the runtime image.
FROM node:22-alpine AS frontend-build
WORKDIR /repo
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY frontend/ frontend/
RUN cd frontend && npm run build

# ---- Stage 2: runtime image ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine dynamically links against OpenSSL and expects glibc-
# compatible shims — bare node:*-alpine has neither, which fails at
# `prisma generate`/first query with a "libssl.so" or similar load error.
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY prisma ./prisma
# Deliberately a full `npm ci`, not `--omit=dev` — the `prisma` CLI is a
# devDependency, and docker-entrypoint.sh below needs it on every container
# start to run `prisma migrate deploy` against this container's real
# DATABASE_URL/DIRECT_URL. --omit=dev would leave npx to fetch prisma over
# the network at startup instead of having it baked into the image already.
RUN npm ci

COPY src ./src
COPY api ./api
COPY --from=frontend-build /repo/public ./public

COPY deploy/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
