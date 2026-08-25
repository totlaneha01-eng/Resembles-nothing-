// Loads the exact catalog currently live in the frontend prototype — 14
// products, correctly split between house designs (artistId: null) and the
// two named guest artists. Run after `npx prisma migrate dev`.
//
// Image paths are placeholders — the frontend prototype currently embeds
// images as base64 for portability, which doesn't belong in a database.
// Upload real files to S3/Cloudinary/Supabase Storage and swap these paths
// before running this for real.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

const FABRIC_FEATURES = ["Premium satin fabric", "Fade-resistant HD print", "Perfect stitching", "Ready to hang", "Carefully packed", "Pan-India delivery"];
const CANVAS_FEATURES = ["Premium 380 GSM canvas", "Fade-resistant ink", "Stretched & framed, ready to hang", "Made with intent, not mass produced", "Carefully packed", "Pan-India delivery"];

const ARTISTS = [
  { name: "Priya Menon", email: "priya.menon@example.com" },
  { name: "Kabir Rao", email: "kabir.rao@example.com" },
];

const PRODUCTS = [
  { slug: "interstellar", name: "Interstellar", category: "Movies", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "For the room that needed a wormhole.", artist: null },
  { slug: "don-1978", name: "Don, 1978", category: "Icons", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "Amitabh Bachchan, immortalised in satin.", artist: null },
  { slug: "royal-sovereign", name: "Royal Sovereign", category: "Abstract", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "0% drama, 100% majestic.", artist: null },
  { slug: "amateur-flirt", name: "Amateur Flirt", category: "Canvas", price: 4999, widthCm: 30, format: "CANVAS", blurb: "If love doesn't work out, at least the aesthetic does.", artist: null },
  { slug: "silent-sovereign", name: "Silent Sovereign", category: "Motivation", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Doesn't judge. Just silently stares into your soul.", artist: null },
  { slug: "dusk-raga", name: "Dusk Raga", category: "Spiritual", price: 7199, widthCm: 95, format: "TRIPTYCH", blurb: "Three panels, one flute, endless calm.", artist: null },
  { slug: "rich-plans-pink-vibes", name: "Rich Plans, Pink Vibes", category: "Motivation", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Normal is boring. Luckily, so are we.", artist: null },
  { slug: "royal-flush", name: "Royal Flush", category: "Abstract", price: 4999, widthCm: 30, format: "CANVAS", blurb: "At least these guys stay in their positions.", artist: null, sold: true },
  { slug: "cubist-embrace", name: "Cubist Embrace", category: "Canvas", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Every colour in the room, wrapped around each other.", artist: "Priya Menon" },
  { slug: "the-power-move", name: "The Power Move", category: "Motivation", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Making power moves and looking beautiful doing it.", artist: "Kabir Rao" },
  { slug: "two-sides-of-the-same-fire", name: "Two Sides of the Same Fire", category: "Abstract", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "Equal parts predator and protector.", artist: "Priya Menon" },
  { slug: "rose-gold-tiger", name: "Rose Gold Tiger", category: "Abstract", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Softer palette, same amount of don't-test-me.", artist: "Kabir Rao" },
  { slug: "minding-my-own-business", name: "Minding My Own Business", category: "Motivation", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "Busy minding my own damn business.", artist: null },
  { slug: "watch-me-not-explain", name: "Watch Me Not Explain", category: "Motivation", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "Some people ask permission. She asks for the bottle.", artist: null },
  { slug: "architecture-of-chaos", name: "The Architecture of Chaos", category: "Motivation", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Newsprint, noise, and one face refusing to look away.", artist: null, images: ["/products/architecture-of-chaos.png", "/products/architecture-of-chaos.png", "/products/architecture-of-chaos.png"] },
  { slug: "staircase-within", name: "The Staircase Within", category: "Motivation", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A mind with a staircase in it. Take it or don't.", artist: null, images: ["/products/staircase-within.png", "/products/staircase-within.png", "/products/staircase-within.png"] },
];

async function main() {
  const artistUsers = {};
  for (const a of ARTISTS) {
    const passwordHash = await bcrypt.hash("changeme-" + Math.random().toString(36).slice(2), 12);
    const user = await prisma.user.upsert({
      where: { email: a.email },
      update: {},
      create: { name: a.name, email: a.email, passwordHash, isArtist: true },
    });
    artistUsers[a.name] = user.id;
  }

  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        category: p.category,
        price: p.price,
        widthCm: p.widthCm,
        formats: p.formats || [p.format],
        blurb: p.blurb,
        description: p.blurb,
        story: p.blurb, // placeholder — copy the full story text from the frontend CATALOG constant
        features: (p.formats || [p.format])[0] === "TAPESTRY" || (p.formats || [p.format])[0] === "TRIPTYCH" ? FABRIC_FEATURES : CANVAS_FEATURES,
        images: p.images || [`/uploads/${p.slug}-far.jpg`, `/uploads/${p.slug}-close.jpg`, `/uploads/${p.slug}-exact.jpg`],
        status: p.sold ? "SOLD" : "ACTIVE",
        soldAt: p.sold ? new Date() : null,
        artistId: p.artist ? artistUsers[p.artist] : null,
      },
    });
  }

  console.log(`Seeded ${ARTISTS.length} artists and ${PRODUCTS.length} products.`);
}

main().finally(() => prisma.$disconnect());
