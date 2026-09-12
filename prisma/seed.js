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
  { slug: "architecture-of-chaos", name: "The Architecture of Chaos", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Newsprint, noise, and one face refusing to look away.", artist: null, images: ["/products/architecture-of-chaos.png", "/products/architecture-of-chaos.png", "/products/architecture-of-chaos.png"], fixCategory: true },
  { slug: "staircase-within", name: "The Staircase Within", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A mind with a staircase in it. Take it or don't.", artist: null, images: ["/products/staircase-within.png", "/products/staircase-within.png", "/products/staircase-within.png"], fixCategory: true },
  { slug: "door-within", name: "The Door Within", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A staircase inside your own silhouette, leading somewhere only you can go.", artist: null, images: ["/products/door-within.png", "/products/door-within.png", "/products/door-within.png"], fixCategory: true },
  { slug: "mind-has-no-ceiling", name: "The Mind Has No Ceiling", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A rowboat adrift under a red sun, floating on the calm at the top of your head.", artist: null, images: ["/products/mind-has-no-ceiling.png", "/products/mind-has-no-ceiling.png", "/products/mind-has-no-ceiling.png"], fixCategory: true },
  { slug: "golden-horizon", name: "The Golden Horizon", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Black, gold, and one long exhale toward the horizon.", artist: null, images: ["/products/golden-horizon.png", "/products/golden-horizon.png", "/products/golden-horizon.png"], fixCategory: true },
  { slug: "cosmic-frequency", name: "Cosmic Frequency", category: "Celestial", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Sound made visible — a signal blooming outward in colour.", artist: null, images: ["/products/cosmic-frequency.png", "/products/cosmic-frequency.png", "/products/cosmic-frequency.png"], fixCategory: true },
  // Batch 3 — designer's latest Drive drop (35 submitted; 6 were dupes of
  // designs already above, 6 excluded for rights: two used real artist
  // names/song titles/label branding (Kendrick Lamar/pgLang/"Not Like Us";
  // Guns N' Roses "Appetite for Destruction"), one reproduced the Nike
  // wordmark + swoosh + Jumpman logo verbatim, two were actual franchise
  // characters (Adventure Time's Finn & Jake; Rick and Morty's portal +
  // catchphrase), one was the Pink Panther character in a kimono.
  { slug: "cathedral-of-oblivion", name: "The Cathedral of Oblivion", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A skull-shaped stairway to nowhere, under a bleeding eclipse.", artist: null, images: ["/products/cathedral-of-oblivion.png", "/products/cathedral-of-oblivion.png", "/products/cathedral-of-oblivion.png"], fixCategory: true },
  { slug: "weight-of-time", name: "The Weight of Time", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A heart-shaped ruin, a caged memory, and a river full of clocks.", artist: null, images: ["/products/weight-of-time.png", "/products/weight-of-time.png", "/products/weight-of-time.png"], fixCategory: true },
  { slug: "distance-between-us", name: "The Distance Between Us", category: "People", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Two figures, one skyline, a bridge that doesn't quite meet.", artist: null, images: ["/products/distance-between-us.png", "/products/distance-between-us.png", "/products/distance-between-us.png"], fixCategory: true },
  { slug: "dreaming-forest", name: "The Dreaming Forest", category: "Fantasy", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A mushroom house at the edge of the map, moon rising overhead.", artist: null, images: ["/products/dreaming-forest.png", "/products/dreaming-forest.png", "/products/dreaming-forest.png"], fixCategory: true },
  { slug: "tears-of-saturn", name: "The Tears of Saturn", category: "Celestial", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A planet that cries in molten gold over a lone stargazer.", artist: null, images: ["/products/tears-of-saturn.png", "/products/tears-of-saturn.png", "/products/tears-of-saturn.png"], fixCategory: true },
  { slug: "peacock-royale", name: "The Peacock Royale", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Gold leaf, an arched doorway, and every feather on display.", artist: null, images: ["/products/peacock-royale.png", "/products/peacock-royale.png", "/products/peacock-royale.png"], fixCategory: true },
  { slug: "infinite-drop", name: "The Infinite Drop", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A single teardrop holding a whole world, and another drop inside that.", artist: null, images: ["/products/infinite-drop.png", "/products/infinite-drop.png", "/products/infinite-drop.png"], fixCategory: true },
  { slug: "eternal-balance", name: "The Eternal Balance", category: "Symbols & Sigils", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A yin-yang that folds into itself, staircase after staircase.", artist: null, images: ["/products/eternal-balance.png", "/products/eternal-balance.png", "/products/eternal-balance.png"], fixCategory: true },
  { slug: "chaos-in-rhythm", name: "Chaos in Rhythm", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Lose yourself, find the beat — a DJ deck for the room that never sleeps.", artist: null, images: ["/products/chaos-in-rhythm.png", "/products/chaos-in-rhythm.png", "/products/chaos-in-rhythm.png"], fixFormats: true, fixCategory: true },
  { slug: "overthinking-warning", name: "The Overthinking Warning", category: "Human Emotions", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A warning label for the habit that's actually doing the damage.", artist: null, images: ["/products/overthinking-warning.png", "/products/overthinking-warning.png", "/products/overthinking-warning.png"], fixFormats: true, fixCategory: true },
  { slug: "infinite-horizons", name: "Infinite Horizons", category: "Nature", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A lone hiker, a spiral valley, and mountains folding into mountains.", artist: null, images: ["/products/infinite-horizons.jpg", "/products/infinite-horizons.jpg", "/products/infinite-horizons.jpg"], fixCategory: true },
  { slug: "infinite-reality", name: "Infinite Reality", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A quiet room that opens into a folding, upside-down city.", artist: null, images: ["/products/infinite-reality.jpg", "/products/infinite-reality.jpg", "/products/infinite-reality.jpg"], fixCategory: true },
  { slug: "door-beyond-reality", name: "The Door Beyond Reality", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "An open door, a walkway through the clouds, a sunset waiting at the end.", artist: null, images: ["/products/door-beyond-reality.jpg", "/products/door-beyond-reality.jpg", "/products/door-beyond-reality.jpg"], fixCategory: true },
  { slug: "weight-of-thought", name: "The Weight of Thought", category: "Human Emotions", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A tangled mind, tethered to the thought that's really in charge.", artist: null, images: ["/products/weight-of-thought.jpg", "/products/weight-of-thought.jpg", "/products/weight-of-thought.jpg"], fixFormats: true, fixCategory: true },
  { slug: "door-beyond-the-moon", name: "The Door Beyond the Moon", category: "Celestial", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A spiral staircase climbing straight into a full moon doorway.", artist: null, images: ["/products/door-beyond-the-moon.png", "/products/door-beyond-the-moon.png", "/products/door-beyond-the-moon.png"], fixCategory: true },
  { slug: "stairway-within", name: "The Stairway Within", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A flat, sun-warmed staircase into a starlit archway — a quieter cousin of The Staircase Within.", artist: null, images: ["/products/stairway-within.png", "/products/stairway-within.png", "/products/stairway-within.png"], fixCategory: true },
  { slug: "ancestral-sun", name: "The Ancestral Sun", category: "Culture & Rituals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Six women walk home under a sun woven from an unbroken circle of dancers.", artist: null, images: ["/products/ancestral-sun.png", "/products/ancestral-sun.png", "/products/ancestral-sun.png"], fixCategory: true },
  { slug: "road-beyond", name: "The Road Beyond", category: "Places", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A curling doorway opens onto a mountain road that keeps going.", artist: null, images: ["/products/road-beyond.jpg", "/products/road-beyond.jpg", "/products/road-beyond.jpg"], fixCategory: true },
  { slug: "keyhole-to-tomorrow", name: "The Keyhole to Tomorrow", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A keyhole-shaped sunrise, and a long walk toward it.", artist: null, images: ["/products/keyhole-to-tomorrow.png", "/products/keyhole-to-tomorrow.png", "/products/keyhole-to-tomorrow.png"], fixCategory: true },
  { slug: "memory-of-giants", name: "The Memory of Giants", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "An elephant rendered entirely in overlapping scripts and patterns.", artist: null, images: ["/products/memory-of-giants.png", "/products/memory-of-giants.png", "/products/memory-of-giants.png"], fixCategory: true },
  { slug: "divine-ascension", name: "Divine Ascension", category: "Myth & Divinity", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A deity in flight, temple and thunder in the same breath.", artist: null, images: ["/products/divine-ascension.png", "/products/divine-ascension.png", "/products/divine-ascension.png"], fixCategory: true },
  { slug: "silent-panther", name: "Silent Panther", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Black on red — a panther that doesn't need to raise its voice.", artist: null, images: ["/products/silent-panther.png", "/products/silent-panther.png", "/products/silent-panther.png"], fixCategory: true },
  { slug: "chrome-rebellion", name: "Chrome Rebellion", category: "Vintage & Retro", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Ink-and-chrome study of a motorcycle that means business.", artist: null, images: ["/products/chrome-rebellion.png", "/products/chrome-rebellion.png", "/products/chrome-rebellion.png"], fixFormats: true, fixCategory: true },
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
  { slug: "mind-cave", name: "Mind Cave", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A weathered face becomes a tunnel — someone small, walking straight into it.", artist: null, images: ["/products/mind-cave.png", "/products/mind-cave.png", "/products/mind-cave.png"], fixCategory: true },
  { slug: "crowned-fighter", name: "Crowned Fighter", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Boxing gloves up, crown on, not backing down from anything.", artist: null, images: ["/products/crowned-fighter.png", "/products/crowned-fighter.png", "/products/crowned-fighter.png"], fixCategory: true },
  { slug: "predator-elegance", name: "Predator Elegance", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Sharp eyes, same look, whether it's her or the leopard behind her.", artist: null, images: ["/products/predator-elegance.png", "/products/predator-elegance.png", "/products/predator-elegance.png"], fixCategory: true },
  { slug: "lunar-break", name: "Lunar Break", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Even 384,000 km from home, some breaks can't wait.", artist: null, images: ["/products/lunar-break.png", "/products/lunar-break.png", "/products/lunar-break.png"], fixCategory: true },
  { slug: "hoop-hero", name: "Hoop Hero", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "One hand, one ball, one net — geometric and unapologetic.", artist: null, images: ["/products/hoop-hero.png", "/products/hoop-hero.png", "/products/hoop-hero.png"], fixCategory: true },
  { slug: "inferno-rock", name: "Inferno Rock", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A stage, a wall of flame, and a crowd that's completely lost it.", artist: null, images: ["/products/inferno-rock.png", "/products/inferno-rock.png", "/products/inferno-rock.png"], fixCategory: true },
  { slug: "elemental-balance", name: "Elemental Balance", category: "Myth & Divinity", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Four deities, four elements, one grid.", artist: null, images: ["/products/elemental-balance.png", "/products/elemental-balance.png", "/products/elemental-balance.png"], fixCategory: true },
  { slug: "soundscape-sanctuary", name: "Soundscape Sanctuary", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A DJ deck in the middle of nowhere, mountains for a dance floor.", artist: null, images: ["/products/soundscape-sanctuary.png", "/products/soundscape-sanctuary.png", "/products/soundscape-sanctuary.png"], fixCategory: true },
  { slug: "head-full-of-chaos", name: "Head Full of Chaos", category: "Human Emotions", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A very startled face, a very unbothered cat.", artist: null, images: ["/products/head-full-of-chaos.png", "/products/head-full-of-chaos.png", "/products/head-full-of-chaos.png"], fixCategory: true },
  { slug: "no-plans-just-vibes", name: "No Plans, Just Vibes", category: "Nature", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A train window, a field of gold, and nowhere in particular to be.", artist: null, images: ["/products/no-plans-just-vibes.png", "/products/no-plans-just-vibes.png", "/products/no-plans-just-vibes.png"], fixCategory: true },
  { slug: "messy-magic", name: "Messy Magic", category: "Human Emotions", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Band-aids, bows, and a cat who's clearly been through something.", artist: null, images: ["/products/messy-magic.png", "/products/messy-magic.png", "/products/messy-magic.png"], fixCategory: true },
  { slug: "checkmate-chaos", name: "Checkmate Chaos", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Sixteen squares, sixteen pieces, zero rules about matching.", artist: null, images: ["/products/checkmate-chaos.png", "/products/checkmate-chaos.png", "/products/checkmate-chaos.png"], fixCategory: true },
  { slug: "better-views-better-vibes", name: "Better Views, Better Vibes", category: "Places", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A pink coupe, a coast road, and bougainvillea for miles.", artist: null, images: ["/products/better-views-better-vibes.png", "/products/better-views-better-vibes.png", "/products/better-views-better-vibes.png"], fixCategory: true },
  { slug: "chi-flow", name: "Chi Flow", category: "Spirituality", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Every chakra, lit up, on the way to becoming.", artist: null, images: ["/products/chi-flow.png", "/products/chi-flow.png", "/products/chi-flow.png"], fixCategory: true },
  { slug: "cosmic-dharma", name: "Cosmic Dharma", category: "Myth & Divinity", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A whole pantheon, one wall, endless detail.", artist: null, images: ["/products/cosmic-dharma.png", "/products/cosmic-dharma.png", "/products/cosmic-dharma.png"], fixCategory: true },
  { slug: "celestial-flow", name: "Celestial Flow", category: "Celestial", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Gold on black — a river, a mudra, and every moon phase at once.", artist: null, images: ["/products/celestial-flow.png", "/products/celestial-flow.png", "/products/celestial-flow.png"], fixCategory: true },
  { slug: "stormborn", name: "Stormborn", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A plane landing through lightning, a skull on the wet tarmac below.", artist: null, images: ["/products/stormborn.png", "/products/stormborn.png", "/products/stormborn.png"], fixCategory: true },
  { slug: "mind-beyond-battlefield", name: "The Mind Beyond the Battlefield", category: "Myth & Divinity", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "One figure seated, two armies waiting, a god rising between them.", artist: null, images: ["/products/mind-beyond-battlefield.png", "/products/mind-beyond-battlefield.png", "/products/mind-beyond-battlefield.png"], fixCategory: true },
  { slug: "panther-queen", name: "The Panther Queen", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "The Queen of Spades, recast as the animal that never blinks first.", artist: null, images: ["/products/panther-queen.png", "/products/panther-queen.png", "/products/panther-queen.png"], fixCategory: true },
  { slug: "beautiful-chaos", name: "Beautiful Chaos", category: "People", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "One figure, one pole, a hundred butterflies taking off at once.", artist: null, images: ["/products/beautiful-chaos.png", "/products/beautiful-chaos.png", "/products/beautiful-chaos.png"], fixCategory: true },
  { slug: "aggressive-self-care", name: "Aggressive Self-Care", category: "Symbols & Sigils", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A mandala that means business — symmetry as a whole personality.", artist: null, images: ["/products/aggressive-self-care.png", "/products/aggressive-self-care.png", "/products/aggressive-self-care.png"], fixCategory: true },
  // Batch 5 — designer's latest Drive drop (18 new designs, #072-#089;
  // 15 added here, 3 excluded for rights: a famous Hunter S. Thompson
  // quote ("Too weird to live, too rare to die," Fear and Loathing in Las
  // Vegas) used verbatim as the centerpiece text; a real, legible
  // "Marshall" amplifier logo; and a visible third-party artist signature
  // in the corner, same standard as the "Frances" signature excluded
  // earlier in this catalog.
  { slug: "infinite-vibes", name: "Infinite Vibes", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Good vibes, bad decisions — a mouth that spirals straight into the cosmos.", artist: null, images: ["/products/infinite-vibes.png", "/products/infinite-vibes.png", "/products/infinite-vibes.png"], fixCategory: true },
  { slug: "cosmic-empathy", name: "Cosmic Empathy", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A rave, a disco ball, and a moment of eyes-closed stillness in the middle of it.", artist: null, images: ["/products/cosmic-empathy.png", "/products/cosmic-empathy.png", "/products/cosmic-empathy.png"], fixCategory: true },
  { slug: "edge-of-tomorrow", name: "The Edge of Tomorrow", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A chair, a cliff, a balloon tied to someone who isn't holding on too tight.", artist: null, images: ["/products/edge-of-tomorrow.png", "/products/edge-of-tomorrow.png", "/products/edge-of-tomorrow.png"], fixCategory: true },
  { slug: "moonlit-misfit", name: "Moonlit Misfit", category: "Fantasy", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A ghost, a smoke break, and a whole mountain range to himself.", artist: null, images: ["/products/moonlit-misfit.png", "/products/moonlit-misfit.png", "/products/moonlit-misfit.png"], fixCategory: true },
  { slug: "whispers-of-the-sun", name: "Whispers of the Sun", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A crystal-antlered deer, caught in a single shaft of forest light.", artist: null, images: ["/products/whispers-of-the-sun.png", "/products/whispers-of-the-sun.png", "/products/whispers-of-the-sun.png"], fixCategory: true },
  { slug: "above-the-ordinary", name: "Above the Ordinary", category: "People", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A sticker-covered pole, a whole city of clouds, one kid above all of it.", artist: null, images: ["/products/above-the-ordinary.png", "/products/above-the-ordinary.png", "/products/above-the-ordinary.png"], fixCategory: true },
  { slug: "what-remains-after-noise", name: "What Remains After the Noise", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A head mid-explosion into paper shards — what's left once the noise clears.", artist: null, images: ["/products/what-remains-after-noise.png", "/products/what-remains-after-noise.png", "/products/what-remains-after-noise.png"], fixCategory: true },
  { slug: "shattered-reality", name: "Shattered Reality", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A shattered mirror, a burning eye, and a hundred small truths in the cracks.", artist: null, images: ["/products/shattered-reality.png", "/products/shattered-reality.png", "/products/shattered-reality.png"], fixCategory: true },
  { slug: "crimson-horizon", name: "Crimson Horizon", category: "People", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Four silhouettes, one long walk home, a whole sky gone the colour of embers.", artist: null, images: ["/products/crimson-horizon.png", "/products/crimson-horizon.png", "/products/crimson-horizon.png"], fixCategory: true },
  { slug: "millionaire-mindset", name: "Millionaire Mindset", category: "Pop Culture", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A lion in a suit, a bag full of cash, zero patience for small thinking.", artist: null, images: ["/products/millionaire-mindset.png", "/products/millionaire-mindset.png", "/products/millionaire-mindset.png"], fixCategory: true },
  { slug: "intuition-entered-chat", name: "Intuition Has Entered the Chat", category: "Surreal", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "One eye, a galaxy of purple smoke, and a slow pink drip down the frame.", artist: null, images: ["/products/intuition-entered-chat.png", "/products/intuition-entered-chat.png", "/products/intuition-entered-chat.png"], fixCategory: true },
  { slug: "fruit-therapy", name: "Fruit Therapy", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Avocado, citrus, watermelon — three panels of pure impasto colour.", artist: null, images: ["/products/fruit-therapy.png", "/products/fruit-therapy.png", "/products/fruit-therapy.png"], fixCategory: true },
  { slug: "pour-decisions", name: "Pour Decisions", category: "Abstract", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "Wine mid-pour, wine mid-splash — a whole toast in two panels.", artist: null, images: ["/products/pour-decisions.png", "/products/pour-decisions.png", "/products/pour-decisions.png"], fixCategory: true },
  { slug: "flock-of-freedom", name: "Flock of Freedom", category: "Animals", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A flock breaking for the horizon, straight into a burnt-orange sky.", artist: null, images: ["/products/flock-of-freedom.png", "/products/flock-of-freedom.png", "/products/flock-of-freedom.png"], fixCategory: true },
  { slug: "bloom-in-lines", name: "Bloom in Lines", category: "Botanical", price: 1499, widthCm: 100, formats: ["TAPESTRY", "CANVAS"], blurb: "A single bloom, drawn entirely in line — every petal its own current.", artist: null, images: ["/products/bloom-in-lines.png", "/products/bloom-in-lines.png", "/products/bloom-in-lines.png"], fixCategory: true },
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
