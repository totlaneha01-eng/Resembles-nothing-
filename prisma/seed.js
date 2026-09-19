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
  { slug: "royal-sovereign", name: "Royal Sovereign", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "0% drama, 100% majestic.", artist: null, images: ["/products/royal-sovereign.jpg", "/products/royal-sovereign.jpg", "/products/royal-sovereign.jpg"], fixFormats: true, fixCategory: true },
  { slug: "amateur-flirt", name: "Amateur Flirt", category: "People", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "If love doesn't work out, at least the aesthetic does.", artist: null, images: ["/products/amateur-flirt.jpg", "/products/amateur-flirt.jpg", "/products/amateur-flirt.jpg"], fixFormats: true, fixCategory: true },
  { slug: "silent-sovereign", name: "Silent Sovereign", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Doesn't judge. Just silently stares into your soul.", artist: null, images: ["/products/silent-sovereign.jpg", "/products/silent-sovereign.jpg", "/products/silent-sovereign.jpg"], fixFormats: true, fixCategory: true },
  // Triptych by design (3 panels) — kept as the primary format, with
  // Tapestry/Canvas added as single-panel alternatives rather than
  // replacing the split-panel option.
  { slug: "dusk-raga", name: "Dusk Raga", category: "Myth & Divinity", price: 7199, widthCm: 95, formats: ["TRIPTYCH", "TAPESTRY", "CANVAS"], blurb: "Three panels, one flute, endless calm.", artist: null, images: ["/products/dusk-raga.jpg", "/products/dusk-raga.jpg", "/products/dusk-raga.jpg"], fixFormats: true, fixCategory: true },
  // Retired: the artwork itself is the Pink Panther character (MGM), not
  // an original design.
  { slug: "rich-plans-pink-vibes", name: "Rich Plans, Pink Vibes", category: "Motivation", price: 4999, widthCm: 30, format: "CANVAS", blurb: "Normal is boring. Luckily, so are we.", artist: null, retire: true },
  { slug: "royal-flush", name: "Royal Flush", category: "Vintage & Retro", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "At least these guys stay in their positions.", artist: null, sold: true, images: ["/products/royal-flush.jpg", "/products/royal-flush.jpg", "/products/royal-flush.jpg"], fixFormats: true, fixCategory: true },
  { slug: "cubist-embrace", name: "Cubist Embrace", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Every colour in the room, wrapped around each other.", artist: "Priya Menon", images: ["/products/cubist-embrace.jpg", "/products/cubist-embrace.jpg", "/products/cubist-embrace.jpg"], fixFormats: true, fixCategory: true },
  { slug: "the-power-move", name: "The Power Move", category: "People", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Making power moves and looking beautiful doing it.", artist: "Kabir Rao", images: ["/products/the-power-move.jpg", "/products/the-power-move.jpg", "/products/the-power-move.jpg"], fixFormats: true, fixCategory: true },
  { slug: "two-sides-of-the-same-fire", name: "Two Sides of the Same Fire", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Equal parts predator and protector.", artist: "Priya Menon", images: ["/products/two-sides-of-the-same-fire.jpg", "/products/two-sides-of-the-same-fire.jpg", "/products/two-sides-of-the-same-fire.jpg"], fixFormats: true, fixCategory: true },
  { slug: "rose-gold-tiger", name: "Rose Gold Tiger", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Softer palette, same amount of don't-test-me.", artist: "Kabir Rao", images: ["/products/rose-gold-tiger.jpg", "/products/rose-gold-tiger.jpg", "/products/rose-gold-tiger.jpg"], fixFormats: true, fixCategory: true },
  // Retired: both carry a visible third-party artist signature ("Frances")
  // in the source image — not an original resembles.nothing design.
  { slug: "minding-my-own-business", name: "Minding My Own Business", category: "Motivation", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "Busy minding my own damn business.", artist: null, retire: true },
  { slug: "watch-me-not-explain", name: "Watch Me Not Explain", category: "Motivation", price: 1499, widthCm: 100, format: "TAPESTRY", blurb: "Some people ask permission. She asks for the bottle.", artist: null, retire: true },
  { slug: "architecture-of-chaos", name: "The Architecture of Chaos", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Newsprint, noise, and one face refusing to look away.", artist: null, images: ["/products/architecture-of-chaos.jpg", "/products/architecture-of-chaos.jpg", "/products/architecture-of-chaos.jpg"], fixCategory: true },
  { slug: "staircase-within", name: "The Staircase Within", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A mind with a staircase in it. Take it or don't.", artist: null, images: ["/products/staircase-within.jpg", "/products/staircase-within.jpg", "/products/staircase-within.jpg"], fixCategory: true },
  { slug: "door-within", name: "The Door Within", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A staircase inside your own silhouette, leading somewhere only you can go.", artist: null, images: ["/products/door-within.jpg", "/products/door-within.jpg", "/products/door-within.jpg"], fixCategory: true },
  { slug: "mind-has-no-ceiling", name: "The Mind Has No Ceiling", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A rowboat adrift under a red sun, floating on the calm at the top of your head.", artist: null, images: ["/products/mind-has-no-ceiling.jpg", "/products/mind-has-no-ceiling.jpg", "/products/mind-has-no-ceiling.jpg"], fixCategory: true },
  { slug: "golden-horizon", name: "The Golden Horizon", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Black, gold, and one long exhale toward the horizon.", artist: null, images: ["/products/golden-horizon.jpg", "/products/golden-horizon.jpg", "/products/golden-horizon.jpg"], fixCategory: true },
  { slug: "cosmic-frequency", name: "Cosmic Frequency", category: "Celestial", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Sound made visible — a signal blooming outward in colour.", artist: null, images: ["/products/cosmic-frequency.jpg", "/products/cosmic-frequency.jpg", "/products/cosmic-frequency.jpg"], fixCategory: true },
  // Batch 3 — designer's latest Drive drop (35 submitted; 6 were dupes of
  // designs already above, 6 excluded for rights: two used real artist
  // names/song titles/label branding (Kendrick Lamar/pgLang/"Not Like Us";
  // Guns N' Roses "Appetite for Destruction"), one reproduced the Nike
  // wordmark + swoosh + Jumpman logo verbatim, two were actual franchise
  // characters (Adventure Time's Finn & Jake; Rick and Morty's portal +
  // catchphrase), one was the Pink Panther character in a kimono.
  { slug: "cathedral-of-oblivion", name: "The Cathedral of Oblivion", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A skull-shaped stairway to nowhere, under a bleeding eclipse.", artist: null, images: ["/products/cathedral-of-oblivion.jpg", "/products/cathedral-of-oblivion.jpg", "/products/cathedral-of-oblivion.jpg"], fixCategory: true },
  { slug: "weight-of-time", name: "The Weight of Time", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A heart-shaped ruin, a caged memory, and a river full of clocks.", artist: null, images: ["/products/weight-of-time.jpg", "/products/weight-of-time.jpg", "/products/weight-of-time.jpg"], fixCategory: true },
  { slug: "distance-between-us", name: "The Distance Between Us", category: "People", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Two figures, one skyline, a bridge that doesn't quite meet.", artist: null, images: ["/products/distance-between-us.jpg", "/products/distance-between-us.jpg", "/products/distance-between-us.jpg"], fixCategory: true },
  { slug: "dreaming-forest", name: "The Dreaming Forest", category: "Fantasy", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A mushroom house at the edge of the map, moon rising overhead.", artist: null, images: ["/products/dreaming-forest.jpg", "/products/dreaming-forest.jpg", "/products/dreaming-forest.jpg"], fixCategory: true },
  { slug: "tears-of-saturn", name: "The Tears of Saturn", category: "Celestial", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A planet that cries in molten gold over a lone stargazer.", artist: null, images: ["/products/tears-of-saturn.jpg", "/products/tears-of-saturn.jpg", "/products/tears-of-saturn.jpg"], fixCategory: true },
  { slug: "peacock-royale", name: "The Peacock Royale", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Gold leaf, an arched doorway, and every feather on display.", artist: null, images: ["/products/peacock-royale.jpg", "/products/peacock-royale.jpg", "/products/peacock-royale.jpg"], fixCategory: true },
  { slug: "infinite-drop", name: "The Infinite Drop", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A single teardrop holding a whole world, and another drop inside that.", artist: null, images: ["/products/infinite-drop.jpg", "/products/infinite-drop.jpg", "/products/infinite-drop.jpg"], fixCategory: true },
  { slug: "eternal-balance", name: "The Eternal Balance", category: "Symbols & Sigils", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A yin-yang that folds into itself, staircase after staircase.", artist: null, images: ["/products/eternal-balance.jpg", "/products/eternal-balance.jpg", "/products/eternal-balance.jpg"], fixCategory: true },
  { slug: "chaos-in-rhythm", name: "Chaos in Rhythm", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Lose yourself, find the beat — a DJ deck for the room that never sleeps.", artist: null, images: ["/products/chaos-in-rhythm.jpg", "/products/chaos-in-rhythm.jpg", "/products/chaos-in-rhythm.jpg"], fixFormats: true, fixCategory: true },
  { slug: "overthinking-warning", name: "The Overthinking Warning", category: "Human Emotions", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A warning label for the habit that's actually doing the damage.", artist: null, images: ["/products/overthinking-warning.jpg", "/products/overthinking-warning.jpg", "/products/overthinking-warning.jpg"], fixFormats: true, fixCategory: true },
  { slug: "infinite-horizons", name: "Infinite Horizons", category: "Nature", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A lone hiker, a spiral valley, and mountains folding into mountains.", artist: null, images: ["/products/infinite-horizons.jpg", "/products/infinite-horizons.jpg", "/products/infinite-horizons.jpg"], fixCategory: true },
  { slug: "infinite-reality", name: "Infinite Reality", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A quiet room that opens into a folding, upside-down city.", artist: null, images: ["/products/infinite-reality.jpg", "/products/infinite-reality.jpg", "/products/infinite-reality.jpg"], fixCategory: true },
  { slug: "door-beyond-reality", name: "The Door Beyond Reality", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "An open door, a walkway through the clouds, a sunset waiting at the end.", artist: null, images: ["/products/door-beyond-reality.jpg", "/products/door-beyond-reality.jpg", "/products/door-beyond-reality.jpg"], fixCategory: true },
  { slug: "weight-of-thought", name: "The Weight of Thought", category: "Human Emotions", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A tangled mind, tethered to the thought that's really in charge.", artist: null, images: ["/products/weight-of-thought.jpg", "/products/weight-of-thought.jpg", "/products/weight-of-thought.jpg"], fixFormats: true, fixCategory: true },
  { slug: "door-beyond-the-moon", name: "The Door Beyond the Moon", category: "Celestial", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A spiral staircase climbing straight into a full moon doorway.", artist: null, images: ["/products/door-beyond-the-moon.jpg", "/products/door-beyond-the-moon.jpg", "/products/door-beyond-the-moon.jpg"], fixCategory: true },
  { slug: "stairway-within", name: "The Stairway Within", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A flat, sun-warmed staircase into a starlit archway — a quieter cousin of The Staircase Within.", artist: null, images: ["/products/stairway-within.jpg", "/products/stairway-within.jpg", "/products/stairway-within.jpg"], fixCategory: true },
  { slug: "ancestral-sun", name: "The Ancestral Sun", category: "Culture & Rituals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Six women walk home under a sun woven from an unbroken circle of dancers.", artist: null, images: ["/products/ancestral-sun.jpg", "/products/ancestral-sun.jpg", "/products/ancestral-sun.jpg"], fixCategory: true },
  { slug: "road-beyond", name: "The Road Beyond", category: "Places", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A curling doorway opens onto a mountain road that keeps going.", artist: null, images: ["/products/road-beyond.jpg", "/products/road-beyond.jpg", "/products/road-beyond.jpg"], fixCategory: true },
  { slug: "keyhole-to-tomorrow", name: "The Keyhole to Tomorrow", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A keyhole-shaped sunrise, and a long walk toward it.", artist: null, images: ["/products/keyhole-to-tomorrow.jpg", "/products/keyhole-to-tomorrow.jpg", "/products/keyhole-to-tomorrow.jpg"], fixCategory: true },
  { slug: "memory-of-giants", name: "The Memory of Giants", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "An elephant rendered entirely in overlapping scripts and patterns.", artist: null, images: ["/products/memory-of-giants.jpg", "/products/memory-of-giants.jpg", "/products/memory-of-giants.jpg"], fixCategory: true },
  { slug: "divine-ascension", name: "Divine Ascension", category: "Myth & Divinity", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A deity in flight, temple and thunder in the same breath.", artist: null, images: ["/products/divine-ascension.jpg", "/products/divine-ascension.jpg", "/products/divine-ascension.jpg"], fixCategory: true },
  { slug: "silent-panther", name: "Silent Panther", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Black on red — a panther that doesn't need to raise its voice.", artist: null, images: ["/products/silent-panther.jpg", "/products/silent-panther.jpg", "/products/silent-panther.jpg"], fixCategory: true },
  { slug: "chrome-rebellion", name: "Chrome Rebellion", category: "Vintage & Retro", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Ink-and-chrome study of a motorcycle that means business.", artist: null, images: ["/products/chrome-rebellion.jpg", "/products/chrome-rebellion.jpg", "/products/chrome-rebellion.jpg"], fixFormats: true, fixCategory: true },
  // Batch 4 — designer's latest Drive drop (36 new designs submitted;
  // 21 added here, 15 excluded for rights):
  //  - 7 real sports-club logos/wordmarks used verbatim: Chicago Bulls,
  //    Miami Heat, LA Lakers (NBA); FC Barcelona, Arsenal, Real Madrid,
  //    Manchester United (football)
  //  - Tom, from Tom and Jerry (Warner Bros./MGM)
  //  - Monkey D. Luffy, from One Piece (Shueisha/Toei)
  //  - a realistic Leonardo DiCaprio/Jordan Belfort likeness with
  //    "BELFORT" printed on it (The Wolf of Wall Street)
  //  - "Get Rich or Die Tryin'" — 50 Cent's actual album title, as text
  //  - a visible Converse logo on a sneaker
  //  - a literal Rubik's Cube (protected trade dress)
  //  - 2 fighter-jet infographics carrying real manufacturer branding
  //    (Dassault Aviation / Indian Air Force insignia; Lockheed Martin /
  //    Pratt & Whitney / General Dynamics)
  { slug: "mind-cave", name: "Mind Cave", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A weathered face becomes a tunnel — someone small, walking straight into it.", artist: null, images: ["/products/mind-cave.jpg", "/products/mind-cave.jpg", "/products/mind-cave.jpg"], fixCategory: true },
  { slug: "crowned-fighter", name: "Crowned Fighter", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Boxing gloves up, crown on, not backing down from anything.", artist: null, images: ["/products/crowned-fighter.jpg", "/products/crowned-fighter.jpg", "/products/crowned-fighter.jpg"], fixCategory: true },
  { slug: "predator-elegance", name: "Predator Elegance", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Sharp eyes, same look, whether it's her or the leopard behind her.", artist: null, images: ["/products/predator-elegance.jpg", "/products/predator-elegance.jpg", "/products/predator-elegance.jpg"], fixCategory: true },
  { slug: "lunar-break", name: "Lunar Break", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Even 384,000 km from home, some breaks can't wait.", artist: null, images: ["/products/lunar-break.jpg", "/products/lunar-break.jpg", "/products/lunar-break.jpg"], fixCategory: true },
  { slug: "hoop-hero", name: "Hoop Hero", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "One hand, one ball, one net — geometric and unapologetic.", artist: null, images: ["/products/hoop-hero.jpg", "/products/hoop-hero.jpg", "/products/hoop-hero.jpg"], fixCategory: true },
  { slug: "inferno-rock", name: "Inferno Rock", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A stage, a wall of flame, and a crowd that's completely lost it.", artist: null, images: ["/products/inferno-rock.jpg", "/products/inferno-rock.jpg", "/products/inferno-rock.jpg"], fixCategory: true },
  { slug: "elemental-balance", name: "Elemental Balance", category: "Myth & Divinity", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Four deities, four elements, one grid.", artist: null, images: ["/products/elemental-balance.jpg", "/products/elemental-balance.jpg", "/products/elemental-balance.jpg"], fixCategory: true },
  { slug: "soundscape-sanctuary", name: "Soundscape Sanctuary", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A DJ deck in the middle of nowhere, mountains for a dance floor.", artist: null, images: ["/products/soundscape-sanctuary.jpg", "/products/soundscape-sanctuary.jpg", "/products/soundscape-sanctuary.jpg"], fixCategory: true },
  { slug: "head-full-of-chaos", name: "Head Full of Chaos", category: "Human Emotions", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A very startled face, a very unbothered cat.", artist: null, images: ["/products/head-full-of-chaos.jpg", "/products/head-full-of-chaos.jpg", "/products/head-full-of-chaos.jpg"], fixCategory: true },
  { slug: "no-plans-just-vibes", name: "No Plans, Just Vibes", category: "Nature", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A train window, a field of gold, and nowhere in particular to be.", artist: null, images: ["/products/no-plans-just-vibes.jpg", "/products/no-plans-just-vibes.jpg", "/products/no-plans-just-vibes.jpg"], fixCategory: true },
  { slug: "messy-magic", name: "Messy Magic", category: "Human Emotions", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Band-aids, bows, and a cat who's clearly been through something.", artist: null, images: ["/products/messy-magic.jpg", "/products/messy-magic.jpg", "/products/messy-magic.jpg"], fixCategory: true },
  { slug: "checkmate-chaos", name: "Checkmate Chaos", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Sixteen squares, sixteen pieces, zero rules about matching.", artist: null, images: ["/products/checkmate-chaos.jpg", "/products/checkmate-chaos.jpg", "/products/checkmate-chaos.jpg"], fixCategory: true },
  { slug: "better-views-better-vibes", name: "Better Views, Better Vibes", category: "Places", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A pink coupe, a coast road, and bougainvillea for miles.", artist: null, images: ["/products/better-views-better-vibes.jpg", "/products/better-views-better-vibes.jpg", "/products/better-views-better-vibes.jpg"], fixCategory: true },
  { slug: "chi-flow", name: "Chi Flow", category: "Spirituality", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Every chakra, lit up, on the way to becoming.", artist: null, images: ["/products/chi-flow.jpg", "/products/chi-flow.jpg", "/products/chi-flow.jpg"], fixCategory: true },
  { slug: "cosmic-dharma", name: "Cosmic Dharma", category: "Myth & Divinity", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A whole pantheon, one wall, endless detail.", artist: null, images: ["/products/cosmic-dharma.jpg", "/products/cosmic-dharma.jpg", "/products/cosmic-dharma.jpg"], fixCategory: true },
  { slug: "celestial-flow", name: "Celestial Flow", category: "Celestial", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Gold on black — a river, a mudra, and every moon phase at once.", artist: null, images: ["/products/celestial-flow.jpg", "/products/celestial-flow.jpg", "/products/celestial-flow.jpg"], fixCategory: true },
  { slug: "stormborn", name: "Stormborn", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A plane landing through lightning, a skull on the wet tarmac below.", artist: null, images: ["/products/stormborn.jpg", "/products/stormborn.jpg", "/products/stormborn.jpg"], fixCategory: true },
  { slug: "mind-beyond-battlefield", name: "The Mind Beyond the Battlefield", category: "Myth & Divinity", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "One figure seated, two armies waiting, a god rising between them.", artist: null, images: ["/products/mind-beyond-battlefield.jpg", "/products/mind-beyond-battlefield.jpg", "/products/mind-beyond-battlefield.jpg"], fixCategory: true },
  { slug: "panther-queen", name: "The Panther Queen", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "The Queen of Spades, recast as the animal that never blinks first.", artist: null, images: ["/products/panther-queen.jpg", "/products/panther-queen.jpg", "/products/panther-queen.jpg"], fixCategory: true },
  { slug: "beautiful-chaos", name: "Beautiful Chaos", category: "People", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "One figure, one pole, a hundred butterflies taking off at once.", artist: null, images: ["/products/beautiful-chaos.jpg", "/products/beautiful-chaos.jpg", "/products/beautiful-chaos.jpg"], fixCategory: true },
  { slug: "aggressive-self-care", name: "Aggressive Self-Care", category: "Symbols & Sigils", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A mandala that means business — symmetry as a whole personality.", artist: null, images: ["/products/aggressive-self-care.jpg", "/products/aggressive-self-care.jpg", "/products/aggressive-self-care.jpg"], fixCategory: true },
  // Batch 5 — designer's latest Drive drop (18 new designs, #072-#089;
  // 15 added here, 3 excluded for rights: a famous Hunter S. Thompson
  // quote ("Too weird to live, too rare to die," Fear and Loathing in Las
  // Vegas) used verbatim as the centerpiece text; a real, legible
  // "Marshall" amplifier logo; and a visible third-party artist signature
  // in the corner, same standard as the "Frances" signature excluded
  // earlier in this catalog.
  { slug: "infinite-vibes", name: "Infinite Vibes", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Good vibes, bad decisions — a mouth that spirals straight into the cosmos.", artist: null, images: ["/products/infinite-vibes.jpg", "/products/infinite-vibes.jpg", "/products/infinite-vibes.jpg"], fixCategory: true },
  { slug: "cosmic-empathy", name: "Cosmic Empathy", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A rave, a disco ball, and a moment of eyes-closed stillness in the middle of it.", artist: null, images: ["/products/cosmic-empathy.jpg", "/products/cosmic-empathy.jpg", "/products/cosmic-empathy.jpg"], fixCategory: true },
  { slug: "edge-of-tomorrow", name: "The Edge of Tomorrow", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A chair, a cliff, a balloon tied to someone who isn't holding on too tight.", artist: null, images: ["/products/edge-of-tomorrow.jpg", "/products/edge-of-tomorrow.jpg", "/products/edge-of-tomorrow.jpg"], fixCategory: true },
  { slug: "moonlit-misfit", name: "Moonlit Misfit", category: "Fantasy", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A ghost, a smoke break, and a whole mountain range to himself.", artist: null, images: ["/products/moonlit-misfit.jpg", "/products/moonlit-misfit.jpg", "/products/moonlit-misfit.jpg"], fixCategory: true },
  { slug: "whispers-of-the-sun", name: "Whispers of the Sun", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A crystal-antlered deer, caught in a single shaft of forest light.", artist: null, images: ["/products/whispers-of-the-sun.jpg", "/products/whispers-of-the-sun.jpg", "/products/whispers-of-the-sun.jpg"], fixCategory: true },
  { slug: "above-the-ordinary", name: "Above the Ordinary", category: "People", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A sticker-covered pole, a whole city of clouds, one kid above all of it.", artist: null, images: ["/products/above-the-ordinary.jpg", "/products/above-the-ordinary.jpg", "/products/above-the-ordinary.jpg"], fixCategory: true },
  { slug: "what-remains-after-noise", name: "What Remains After the Noise", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A head mid-explosion into paper shards — what's left once the noise clears.", artist: null, images: ["/products/what-remains-after-noise.jpg", "/products/what-remains-after-noise.jpg", "/products/what-remains-after-noise.jpg"], fixCategory: true },
  { slug: "shattered-reality", name: "Shattered Reality", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A shattered mirror, a burning eye, and a hundred small truths in the cracks.", artist: null, images: ["/products/shattered-reality.jpg", "/products/shattered-reality.jpg", "/products/shattered-reality.jpg"], fixCategory: true },
  { slug: "crimson-horizon", name: "Crimson Horizon", category: "People", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Four silhouettes, one long walk home, a whole sky gone the colour of embers.", artist: null, images: ["/products/crimson-horizon.jpg", "/products/crimson-horizon.jpg", "/products/crimson-horizon.jpg"], fixCategory: true },
  { slug: "millionaire-mindset", name: "Millionaire Mindset", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A lion in a suit, a bag full of cash, zero patience for small thinking.", artist: null, images: ["/products/millionaire-mindset.jpg", "/products/millionaire-mindset.jpg", "/products/millionaire-mindset.jpg"], fixCategory: true },
  { slug: "intuition-entered-chat", name: "Intuition Has Entered the Chat", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "One eye, a galaxy of purple smoke, and a slow pink drip down the frame.", artist: null, images: ["/products/intuition-entered-chat.jpg", "/products/intuition-entered-chat.jpg", "/products/intuition-entered-chat.jpg"], fixCategory: true },
  { slug: "fruit-therapy", name: "Fruit Therapy", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Avocado, citrus, watermelon — three panels of pure impasto colour.", artist: null, images: ["/products/fruit-therapy.jpg", "/products/fruit-therapy.jpg", "/products/fruit-therapy.jpg"], fixCategory: true },
  { slug: "pour-decisions", name: "Pour Decisions", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Wine mid-pour, wine mid-splash — a whole toast in two panels.", artist: null, images: ["/products/pour-decisions.jpg", "/products/pour-decisions.jpg", "/products/pour-decisions.jpg"], fixCategory: true },
  { slug: "flock-of-freedom", name: "Flock of Freedom", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A flock breaking for the horizon, straight into a burnt-orange sky.", artist: null, images: ["/products/flock-of-freedom.jpg", "/products/flock-of-freedom.jpg", "/products/flock-of-freedom.jpg"], fixCategory: true },
  { slug: "bloom-in-lines", name: "Bloom in Lines", category: "Botanical", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A single bloom, drawn entirely in line — every petal its own current.", artist: null, images: ["/products/bloom-in-lines.jpg", "/products/bloom-in-lines.jpg", "/products/bloom-in-lines.jpg"], fixCategory: true },

  // Batch import from the DESIGN CATALOGUE Drive folder — new designs not
  // previously in the catalogue. Category/price/blurb are first-pass
  // placeholders pending review.
  { slug: "goa-after-dark", name: "Goa After Dark", category: "Places", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Neon signs, warm night air — Goa the moment the sun gives up and the lights take over.", artist: null, images: ["/products/goa-after-dark.jpg", "/products/goa-after-dark.jpg", "/products/goa-after-dark.jpg"] },
  { slug: "neon-yog-nagri", name: "Neon Yog Nagri", category: "Places", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Rishikesh reimagined in neon — the yoga capital, wide awake after dark.", artist: null, images: ["/products/neon-yog-nagri.jpg", "/products/neon-yog-nagri.jpg", "/products/neon-yog-nagri.jpg"] },
  { slug: "neon-mumbai", name: "Neon Mumbai", category: "Places", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "The city that never sleeps, lit up in electric colour.", artist: null, images: ["/products/neon-mumbai.jpg", "/products/neon-mumbai.jpg", "/products/neon-mumbai.jpg"] },
  { slug: "the-lost-world-of-hyperborea", name: "The Lost World of Hyperborea", category: "Fantasy", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A myth of a golden land beyond the north wind, painted like it was never lost at all.", artist: null, images: ["/products/the-lost-world-of-hyperborea.jpg", "/products/the-lost-world-of-hyperborea.jpg", "/products/the-lost-world-of-hyperborea.jpg"] },
  { slug: "the-geometry-of-creation", name: "The Geometry of Creation", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Sacred shapes and hard angles — the universe's own blueprint.", artist: null, images: ["/products/the-geometry-of-creation.jpg", "/products/the-geometry-of-creation.jpg", "/products/the-geometry-of-creation.jpg"] },
  { slug: "ganeshas-embrace", name: "Ganesha's Embrace", category: "Myth & Divinity", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "The remover of obstacles, rendered in warmth and gold.", artist: null, images: ["/products/ganeshas-embrace.jpg", "/products/ganeshas-embrace.jpg", "/products/ganeshas-embrace.jpg"] },
  { slug: "the-last-light-of-ganesha", name: "The Last Light of Ganesha", category: "Myth & Divinity", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Dusk settling over the deity — the day's last light, held a moment longer.", artist: null, images: ["/products/the-last-light-of-ganesha.jpg", "/products/the-last-light-of-ganesha.jpg", "/products/the-last-light-of-ganesha.jpg"] },
  { slug: "celestial-blessing", name: "Celestial Blessing", category: "Spirituality", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Stars bending down like they've got something to say.", artist: null, images: ["/products/celestial-blessing.jpg", "/products/celestial-blessing.jpg", "/products/celestial-blessing.jpg"] },
  { slug: "divine-grit", name: "Divine Grit", category: "Myth & Divinity", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Sacred, but not soft about it.", artist: null, images: ["/products/divine-grit.jpg", "/products/divine-grit.jpg", "/products/divine-grit.jpg"] },
  { slug: "ganesha-geometry", name: "Ganesha Geometry", category: "Myth & Divinity", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "The deity redrawn in clean, sacred lines.", artist: null, images: ["/products/ganesha-geometry.jpg", "/products/ganesha-geometry.jpg", "/products/ganesha-geometry.jpg"] },
  { slug: "divine-flow", name: "Divine Flow", category: "Spirituality", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Everything sacred, none of it still.", artist: null, images: ["/products/divine-flow.jpg", "/products/divine-flow.jpg", "/products/divine-flow.jpg"] },
  { slug: "faces-in-the-wild", name: "Faces in the Wild", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "The wild, looking right back at you.", artist: null, images: ["/products/faces-in-the-wild.jpg", "/products/faces-in-the-wild.jpg", "/products/faces-in-the-wild.jpg"] },
  { slug: "vacation-mode-permanently-on", name: "Vacation Mode: Permanently On", category: "Places", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "For the wall that refuses to clock back in.", artist: null, images: ["/products/vacation-mode-permanently-on.jpg", "/products/vacation-mode-permanently-on.jpg", "/products/vacation-mode-permanently-on.jpg"] },
  { slug: "recalculating-reality", name: "Recalculating Reality", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "The world, mid-glitch, rerouting itself in real time.", artist: null, images: ["/products/recalculating-reality.jpg", "/products/recalculating-reality.jpg", "/products/recalculating-reality.jpg"] },
  { slug: "chasing-dreams", name: "Chasing Dreams", category: "Human Emotions", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Always one step ahead, always worth the run.", artist: null, images: ["/products/chasing-dreams.jpg", "/products/chasing-dreams.jpg", "/products/chasing-dreams.jpg"] },
  { slug: "f16-fighting-falcon", name: "F-16 Fighting Falcon — Anatomy of a Fighter", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Every rivet and wing of a fighter jet, laid out like a blueprint.", artist: null, images: ["/products/f16-fighting-falcon.jpg", "/products/f16-fighting-falcon.jpg", "/products/f16-fighting-falcon.jpg"] },
  { slug: "touch-the-sky", name: "Touch the Sky", category: "Nature", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "For the wall that's always reaching for more.", artist: null, images: ["/products/touch-the-sky.jpg", "/products/touch-the-sky.jpg", "/products/touch-the-sky.jpg"] },
  { slug: "chance-vs-strategy", name: "Chance vs. Strategy", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Every game's real question, laid out in one frame.", artist: null, images: ["/products/chance-vs-strategy.jpg", "/products/chance-vs-strategy.jpg", "/products/chance-vs-strategy.jpg"] },
  { slug: "90s-nostalgia-mix", name: "90s Nostalgia Mix", category: "Vintage & Retro", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Everything that made the 90s the 90s, in one loud collage.", artist: null, images: ["/products/90s-nostalgia-mix.jpg", "/products/90s-nostalgia-mix.jpg", "/products/90s-nostalgia-mix.jpg"] },
  { slug: "fortune-favors-the-bold", name: "Fortune Favors the Bold", category: "Symbols & Sigils", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A reminder that plays well in gold.", artist: null, images: ["/products/fortune-favors-the-bold.jpg", "/products/fortune-favors-the-bold.jpg", "/products/fortune-favors-the-bold.jpg"] },
  { slug: "get-rich-or-die-tryin", name: "Get Rich or Die Tryin'", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "No subtlety, no apologies.", artist: null, images: ["/products/get-rich-or-die-tryin.jpg", "/products/get-rich-or-die-tryin.jpg", "/products/get-rich-or-die-tryin.jpg"] },
  { slug: "manchester-red-relic", name: "Manchester Red Relic", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "For the ones who bleed red on matchday.", artist: null, images: ["/products/manchester-red-relic.jpg", "/products/manchester-red-relic.jpg", "/products/manchester-red-relic.jpg"] },
  { slug: "crown-of-circuitry", name: "Crown of Circuitry", category: "Fantasy", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Royalty, rewired for a different century.", artist: null, images: ["/products/crown-of-circuitry.jpg", "/products/crown-of-circuitry.jpg", "/products/crown-of-circuitry.jpg"] },
  { slug: "arsenal-inferno", name: "Arsenal Inferno", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "For the ones who bleed red and white on matchday.", artist: null, images: ["/products/arsenal-inferno.jpg", "/products/arsenal-inferno.jpg", "/products/arsenal-inferno.jpg"] },
  { slug: "barcelona-divide", name: "Barcelona Divide", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "One city, one badge, no middle ground.", artist: null, images: ["/products/barcelona-divide.jpg", "/products/barcelona-divide.jpg", "/products/barcelona-divide.jpg"] },
  { slug: "lakers-court", name: "Lakers Court", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Purple and gold, courtside energy for the wall.", artist: null, images: ["/products/lakers-court.jpg", "/products/lakers-court.jpg", "/products/lakers-court.jpg"] },
  { slug: "miami-heat", name: "Miami Heat", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Turn it up, then turn it up again.", artist: null, images: ["/products/miami-heat.jpg", "/products/miami-heat.jpg", "/products/miami-heat.jpg"] },
  { slug: "chicago-grit", name: "Chicago Grit", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A city that plays like it's got something to prove.", artist: null, images: ["/products/chicago-grit.jpg", "/products/chicago-grit.jpg", "/products/chicago-grit.jpg"] },
  { slug: "trust-the-process", name: "Trust the Process", category: "Human Emotions", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "For the long game, and everyone still playing it.", artist: null, images: ["/products/trust-the-process.jpg", "/products/trust-the-process.jpg", "/products/trust-the-process.jpg"] },
  { slug: "pink-panther-zen", name: "Pink Panther Zen", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Effortlessly cool, exactly as advertised.", artist: null, images: ["/products/pink-panther-zen.jpg", "/products/pink-panther-zen.jpg", "/products/pink-panther-zen.jpg"] },
  { slug: "portal-problems", name: "Portal Problems", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A doorway to somewhere else, still figuring out where.", artist: null, images: ["/products/portal-problems.jpg", "/products/portal-problems.jpg", "/products/portal-problems.jpg"] },
  { slug: "the-adventure-awaits", name: "The Adventure Awaits", category: "Places", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "An open road and every excuse to take it.", artist: null, images: ["/products/the-adventure-awaits.jpg", "/products/the-adventure-awaits.jpg", "/products/the-adventure-awaits.jpg"] },
  { slug: "appetite-for-destruction", name: "Appetite for Destruction", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Loud, unapologetic, exactly what it says on the tin.", artist: null, images: ["/products/appetite-for-destruction.jpg", "/products/appetite-for-destruction.jpg", "/products/appetite-for-destruction.jpg"] },
  { slug: "built-for-legacy", name: "Built for Legacy", category: "Human Emotions", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Not built for now. Built to last.", artist: null, images: ["/products/built-for-legacy.jpg", "/products/built-for-legacy.jpg", "/products/built-for-legacy.jpg"] },
  { slug: "static-from-compton", name: "Static From Compton", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Raw static and West Coast heat, straight off the block.", artist: null, images: ["/products/static-from-compton.jpg", "/products/static-from-compton.jpg", "/products/static-from-compton.jpg"] },
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
      // One-off correction: a handful of designs went out canvas-only in a
      // deploy that already ran, when they should offer tapestry too (every
      // design should be orderable in every format we support — see the
      // formats field's own doc comment). fixFormats replays their
      // formats/price/widthCm onto the existing row without touching
      // anything else an admin may have since edited.
      ...(p.fixFormats ? { formats: p.formats || [p.format], price: p.price, widthCm: p.widthCm } : {}),
      // One-off correction: category is meant to be a content theme (what
      // the design is about — Sports, Abstract, Spiritual, ...), never a
      // format ("Canvas" was being used as both a category AND a format,
      // which is exactly the ambiguity formats/fixFormats above exists to
      // avoid). fixCategory replays just the corrected category onto an
      // existing row.
      ...(p.fixCategory ? { category: p.category } : {}),
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
