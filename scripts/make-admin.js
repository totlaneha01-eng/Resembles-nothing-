// One-time bootstrap: there's no self-serve "become admin" flow (on purpose —
// isAdmin should never be settable via a public API). Sign up for a normal
// account on the site first, then run this once, from Render's Shell tab:
//
//   node scripts/make-admin.js you@example.com
//
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/make-admin.js <email>");
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { isAdmin: true },
  });
  console.log(`${user.email} is now an admin.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
