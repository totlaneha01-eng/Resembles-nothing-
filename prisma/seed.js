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
  // Retired: no clean product image available. The only source images that
  // existed for these were screenshots of Instagram posts (captions/DM-to-order
  // banners baked in, not usable as-is), and on closer inspection both also
  // carry a real rights problem independent of the image quality — Interstellar
  // reproduces the film's own title-card style over a scene from it, and
  // Don, 1978 is a realistic portrait of Amitabh Bachchan under the actual
  // film's branding. Left retired rather than deleted, for record-keeping.
  { slug: "interstellar", name: "Interstellar", category: "Movies", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "For the room that needed a wormhole.", artist: null, retire: true },
  { slug: "don-1978", name: "Don, 1978", category: "Icons", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "Amitabh Bachchan, immortalised in satin.", artist: null, retire: true },
  { slug: "royal-sovereign", name: "Royal Sovereign", category: "Abstract", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "0% drama, 100% majestic.", artist: null, images: ["/products/royal-sovereign.jpg", "/products/royal-sovereign.jpg", "/products/royal-sovereign.jpg"] },
  { slug: "amateur-flirt", name: "Amateur Flirt", category: "Canvas", price: 4999, widthCm: 30, format: "CANVAS", blurb: "If love doesn't work out, at least the aesthetic does.", artist: null, images: ["/products/amateur-flirt.jpg", "/products/amateur-flirt.jpg", "/products/amateur-flirt.jpg"] },
  { slug: "silent-sovereign", name: "Silent Sovereign", category: "Motivation", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Doesn't judge. Just silently stares into your soul.", artist: null, images: ["/products/silent-sovereign.jpg", "/products/silent-sovereign.jpg", "/products/silent-sovereign.jpg"] },
  { slug: "dusk-raga", name: "Dusk Raga", category: "Spiritual", price: 7199, widthCm: 95, format: "TRIPTYCH", blurb: "Three panels, one flute, endless calm.", artist: null, images: ["/products/dusk-raga.jpg", "/products/dusk-raga.jpg", "/products/dusk-raga.jpg"] },
  // Retired: the artwork itself is the Pink Panther character (MGM), not
  // an original design.
  { slug: "rich-plans-pink-vibes", name: "Rich Plans, Pink Vibes", category: "Motivation", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Normal is boring. Luckily, so are we.", artist: null, retire: true },
  { slug: "royal-flush", name: "Royal Flush", category: "Abstract", price: 4999, widthCm: 30, format: "CANVAS", blurb: "At least these guys stay in their positions.", artist: null, sold: true, images: ["/products/royal-flush.jpg", "/products/royal-flush.jpg", "/products/royal-flush.jpg"] },
  { slug: "cubist-embrace", name: "Cubist Embrace", category: "Canvas", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Every colour in the room, wrapped around each other.", artist: "Priya Menon", images: ["/products/cubist-embrace.jpg", "/products/cubist-embrace.jpg", "/products/cubist-embrace.jpg"] },
  { slug: "the-power-move", name: "The Power Move", category: "Motivation", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Making power moves and looking beautiful doing it.", artist: "Kabir Rao", images: ["/products/the-power-move.jpg", "/products/the-power-move.jpg", "/products/the-power-move.jpg"] },
  { slug: "two-sides-of-the-same-fire", name: "Two Sides of the Same Fire", category: "Abstract", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "Equal parts predator and protector.", artist: "Priya Menon", images: ["/products/two-sides-of-the-same-fire.jpg", "/products/two-sides-of-the-same-fire.jpg", "/products/two-sides-of-the-same-fire.jpg"] },
  { slug: "rose-gold-tiger", name: "Rose Gold Tiger", category: "Abstract", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Softer palette, same amount of don't-test-me.", artist: "Kabir Rao", images: ["/products/rose-gold-tiger.jpg", "/products/rose-gold-tiger.jpg", "/products/rose-gold-tiger.jpg"] },
  // Retired: both carry a visible third-party artist signature ("Frances")
  // in the source image — not an original resembles.nothing design.
  { slug: "minding-my-own-business", name: "Minding My Own Business", category: "Motivation", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "Busy minding my own damn business.", artist: null, retire: true },
  { slug: "watch-me-not-explain", name: "Watch Me Not Explain", category: "Motivation", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "Some people ask permission. She asks for the bottle.", artist: null, retire: true },
  { slug: "architecture-of-chaos", name: "The Architecture of Chaos", category: "Motivation", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Newsprint, noise, and one face refusing to look away.", artist: null, images: ["/products/architecture-of-chaos.png", "/products/architecture-of-chaos.png", "/products/architecture-of-chaos.png"] },
  { slug: "staircase-within", name: "The Staircase Within", category: "Motivation", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A mind with a staircase in it. Take it or don't.", artist: null, images: ["/products/staircase-within.png", "/products/staircase-within.png", "/products/staircase-within.png"] },
  { slug: "door-within", name: "The Door Within", category: "Motivation", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A staircase inside your own silhouette, leading somewhere only you can go.", artist: null, images: ["/products/door-within.png", "/products/door-within.png", "/products/door-within.png"] },
  { slug: "mind-has-no-ceiling", name: "The Mind Has No Ceiling", category: "Motivation", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A rowboat adrift under a red sun, floating on the calm at the top of your head.", artist: null, images: ["/products/mind-has-no-ceiling.png", "/products/mind-has-no-ceiling.png", "/products/mind-has-no-ceiling.png"] },
  { slug: "golden-horizon", name: "The Golden Horizon", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Black, gold, and one long exhale toward the horizon.", artist: null, images: ["/products/golden-horizon.png", "/products/golden-horizon.png", "/products/golden-horizon.png"] },
  { slug: "cosmic-frequency", name: "Cosmic Frequency", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Sound made visible — a signal blooming outward in colour.", artist: null, images: ["/products/cosmic-frequency.png", "/products/cosmic-frequency.png", "/products/cosmic-frequency.png"] },
  // Batch 3 — designer's latest Drive drop (35 submitted; 6 were dupes of
  // designs already above, 6 excluded for rights: two used real artist
  // names/song titles/label branding (Kendrick Lamar/pgLang/"Not Like Us";
  // Guns N' Roses "Appetite for Destruction"), one reproduced the Nike
  // wordmark + swoosh + Jumpman logo verbatim, two were actual franchise
  // characters (Adventure Time's Finn & Jake; Rick and Morty's portal +
  // catchphrase), one was the Pink Panther character in a kimono.
  { slug: "cathedral-of-oblivion", name: "The Cathedral of Oblivion", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A skull-shaped stairway to nowhere, under a bleeding eclipse.", artist: null, images: ["/products/cathedral-of-oblivion.png", "/products/cathedral-of-oblivion.png", "/products/cathedral-of-oblivion.png"] },
  { slug: "weight-of-time", name: "The Weight of Time", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A heart-shaped ruin, a caged memory, and a river full of clocks.", artist: null, images: ["/products/weight-of-time.png", "/products/weight-of-time.png", "/products/weight-of-time.png"] },
  { slug: "distance-between-us", name: "The Distance Between Us", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Two figures, one skyline, a bridge that doesn't quite meet.", artist: null, images: ["/products/distance-between-us.png", "/products/distance-between-us.png", "/products/distance-between-us.png"] },
  { slug: "dreaming-forest", name: "The Dreaming Forest", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A mushroom house at the edge of the map, moon rising overhead.", artist: null, images: ["/products/dreaming-forest.png", "/products/dreaming-forest.png", "/products/dreaming-forest.png"] },
  { slug: "tears-of-saturn", name: "The Tears of Saturn", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A planet that cries in molten gold over a lone stargazer.", artist: null, images: ["/products/tears-of-saturn.png", "/products/tears-of-saturn.png", "/products/tears-of-saturn.png"] },
  { slug: "peacock-royale", name: "The Peacock Royale", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Gold leaf, an arched doorway, and every feather on display.", artist: null, images: ["/products/peacock-royale.png", "/products/peacock-royale.png", "/products/peacock-royale.png"] },
  { slug: "infinite-drop", name: "The Infinite Drop", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A single teardrop holding a whole world, and another drop inside that.", artist: null, images: ["/products/infinite-drop.png", "/products/infinite-drop.png", "/products/infinite-drop.png"] },
  { slug: "eternal-balance", name: "The Eternal Balance", category: "Spiritual", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A yin-yang that folds into itself, staircase after staircase.", artist: null, images: ["/products/eternal-balance.png", "/products/eternal-balance.png", "/products/eternal-balance.png"] },
  { slug: "chaos-in-rhythm", name: "Chaos in Rhythm", category: "Motivation", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Lose yourself, find the beat — a DJ deck for the room that never sleeps.", artist: null, images: ["/products/chaos-in-rhythm.png", "/products/chaos-in-rhythm.png", "/products/chaos-in-rhythm.png"] },
  { slug: "overthinking-warning", name: "The Overthinking Warning", category: "Motivation", price: 4999, widthCm: 30, format: "CANVAS", blurb: "A warning label for the habit that's actually doing the damage.", artist: null, images: ["/products/overthinking-warning.png", "/products/overthinking-warning.png", "/products/overthinking-warning.png"] },
  { slug: "infinite-horizons", name: "Infinite Horizons", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A lone hiker, a spiral valley, and mountains folding into mountains.", artist: null, images: ["/products/infinite-horizons.jpg", "/products/infinite-horizons.jpg", "/products/infinite-horizons.jpg"] },
  { slug: "infinite-reality", name: "Infinite Reality", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A quiet room that opens into a folding, upside-down city.", artist: null, images: ["/products/infinite-reality.jpg", "/products/infinite-reality.jpg", "/products/infinite-reality.jpg"] },
  { slug: "door-beyond-reality", name: "The Door Beyond Reality", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "An open door, a walkway through the clouds, a sunset waiting at the end.", artist: null, images: ["/products/door-beyond-reality.jpg", "/products/door-beyond-reality.jpg", "/products/door-beyond-reality.jpg"] },
  { slug: "weight-of-thought", name: "The Weight of Thought", category: "Motivation", price: 4999, widthCm: 30, format: "CANVAS", blurb: "A tangled mind, tethered to the thought that's really in charge.", artist: null, images: ["/products/weight-of-thought.jpg", "/products/weight-of-thought.jpg", "/products/weight-of-thought.jpg"] },
  { slug: "door-beyond-the-moon", name: "The Door Beyond the Moon", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A spiral staircase climbing straight into a full moon doorway.", artist: null, images: ["/products/door-beyond-the-moon.png", "/products/door-beyond-the-moon.png", "/products/door-beyond-the-moon.png"] },
  { slug: "stairway-within", name: "The Stairway Within", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A flat, sun-warmed staircase into a starlit archway — a quieter cousin of The Staircase Within.", artist: null, images: ["/products/stairway-within.png", "/products/stairway-within.png", "/products/stairway-within.png"] },
  { slug: "ancestral-sun", name: "The Ancestral Sun", category: "Spiritual", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Six women walk home under a sun woven from an unbroken circle of dancers.", artist: null, images: ["/products/ancestral-sun.png", "/products/ancestral-sun.png", "/products/ancestral-sun.png"] },
  { slug: "road-beyond", name: "The Road Beyond", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A curling doorway opens onto a mountain road that keeps going.", artist: null, images: ["/products/road-beyond.jpg", "/products/road-beyond.jpg", "/products/road-beyond.jpg"] },
  { slug: "keyhole-to-tomorrow", name: "The Keyhole to Tomorrow", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A keyhole-shaped sunrise, and a long walk toward it.", artist: null, images: ["/products/keyhole-to-tomorrow.png", "/products/keyhole-to-tomorrow.png", "/products/keyhole-to-tomorrow.png"] },
  { slug: "memory-of-giants", name: "The Memory of Giants", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "An elephant rendered entirely in overlapping scripts and patterns.", artist: null, images: ["/products/memory-of-giants.png", "/products/memory-of-giants.png", "/products/memory-of-giants.png"] },
  { slug: "divine-ascension", name: "Divine Ascension", category: "Spiritual", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A deity in flight, temple and thunder in the same breath.", artist: null, images: ["/products/divine-ascension.png", "/products/divine-ascension.png", "/products/divine-ascension.png"] },
  { slug: "silent-panther", name: "Silent Panther", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Black on red — a panther that doesn't need to raise its voice.", artist: null, images: ["/products/silent-panther.png", "/products/silent-panther.png", "/products/silent-panther.png"] },
  { slug: "chrome-rebellion", name: "Chrome Rebellion", category: "Abstract", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Ink-and-chrome study of a motorcycle that means business.", artist: null, images: ["/products/chrome-rebellion.png", "/products/chrome-rebellion.png", "/products/chrome-rebellion.png"] },
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
    // Deliberately narrow: this seed script's job has always been "create if
    // missing, leave alone if present" (so it's safe to run on every deploy
    // without clobbering anything edited live through the admin panel since).
    // The two exceptions are explicit, one-off corrections — a real `images`
    // array replacing a stale placeholder, or `retire: true` flipping status
    // on a design that turned out to have a rights problem — not a general
    // "keep every field in sync" update.
    const update = {
      ...(p.images ? { images: p.images } : {}),
      ...(p.retire ? { status: "RETIRED" } : {}),
    };
    await prisma.product.upsert({
      where: { slug: p.slug },
      update,
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
