const { PrismaClient } = require("@prisma/client");

// Reuse a single client across hot reloads in dev instead of opening a new
// connection pool on every file change.
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

module.exports = prisma;
