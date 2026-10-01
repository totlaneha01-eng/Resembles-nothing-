// Generates real, keyword-relevant SEO content (description/story/alt) for a
// product from attributes every product already has — name, category, blurb,
// format. This is called from two places on purpose:
//   1. prisma/seed.js, for the hand-curated catalogue
//   2. routes/artists.js's submission-approval endpoint, for every design an
//      artist submits from here on
// That second call site is the one that actually matters at scale — without
// it, this only ever covers whatever's in the catalogue the day this file was
// written, and every design approved afterward goes right back to having a
// one-line placeholder for both fields. One generator, one set of category/
// intent data, called automatically at the one moment (approval) a design
// becomes a real catalogue entry — that's what scales to thousands of
// designs without turning into a recurring manual job.
//
// Deliberately NOT keyword-stuffing: Google's ranking algorithms have
// penalized exact-match keyword repetition since the early 2000s. Every
// phrase bank below is varied, natural-reading English woven through real,
// substantive sentences — not a list of terms repeated verbatim.

const FORMAT_LABEL = {
  TAPESTRY: "tapestry",
  CANVAS: "canvas print",
  TRIPTYCH: "triptych canvas set",
  DIPTYCH: "diptych canvas set",
  QUADRIPTYCH: "four-panel canvas set",
};

const FABRIC_NOTE = {
  tapestry: "premium satin fabric with a fade-resistant HD print",
  "canvas print": "380 GSM stretched canvas with fade-resistant ink",
  "triptych canvas set": "380 GSM stretched canvas across three panels",
  "diptych canvas set": "380 GSM stretched canvas across two panels",
  "four-panel canvas set": "380 GSM stretched canvas across four panels",
};

// Category-specific phrase banks: kw (what-it-is search terms), mood
// (room/persona pairing for the narrative half), intent (the one search
// angle unique to that category — fandom, motivation, spirituality, ...).
const CATEGORY = {
  Abstract: {
    kw: ["abstract wall art", "modern abstract print", "contemporary abstract tapestry", "statement abstract decor"],
    mood: ["a minimalist studio apartment", "a creative workspace", "a modern living room that needed one bold piece", "a gallery-style bedroom wall"],
    intent: ["anyone searching for modern art that isn't a mass-produced print", "collectors of contemporary abstract art", "building a gallery wall around one strong anchor piece"],
  },
  Animals: {
    kw: ["animal wall art", "wildlife print", "animal-lover home decor", "statement animal tapestry"],
    mood: ["anyone who'd rather have a tiger on the wall than a houseplant", "a nature-lover's reading nook", "a bedroom that needed some personality", "a pet-lover's living room"],
    intent: ["animal lovers and wildlife-art collectors", "anyone searching for a statement animal print that isn't stock photography", "a nature-themed room makeover"],
  },
  Botanical: {
    kw: ["botanical wall art", "floral print", "plant-inspired home decor", "nature botanical tapestry"],
    mood: ["a sunlit reading corner", "a plant parent's living room", "a calm, green-leaning bedroom", "a balcony-adjacent nook"],
    intent: ["plant parents and botanical-print collectors", "anyone searching for calming, nature-led wall decor", "a fresh, green-toned room refresh"],
  },
  Celestial: {
    kw: ["celestial wall art", "cosmic print", "galaxy tapestry", "moon-and-stars wall decor", "space-themed home decor"],
    mood: ["a late-night study corner", "a dorm room that needed some wonder", "a meditation nook", "a bedroom that needed a little cosmos in it"],
    intent: ["stargazers, astrology fans, and space-print collectors", "anyone searching for moon-and-stars decor that isn't a cheap poster", "a dreamy, cosmic bedroom refresh"],
  },
  "Culture & Rituals": {
    kw: ["Indian heritage wall art", "cultural tapestry", "traditional motif print", "ritual-inspired home decor"],
    mood: ["an entryway that sets the tone for the whole house", "a living room with a story to tell", "a festival-season refresh", "a heritage-forward home office"],
    intent: ["anyone searching for Indian heritage art for the home", "a festival or housewarming gift with real cultural weight", "collectors of culture-forward wall decor"],
  },
  Fantasy: {
    kw: ["fantasy wall art", "mythical-creature print", "fantasy-themed tapestry", "fantasy home decor"],
    mood: ["a reader's den", "a gaming room that needed a backdrop", "a teenager's bedroom", "anyone who never grew out of wanting a dragon on the wall"],
    intent: ["fantasy readers, gamers, and mythical-creature fans", "anyone searching for fantasy art that isn't a licensed character", "a gaming or reading-room centrepiece"],
  },
  "Human Emotions": {
    kw: ["motivational wall art", "mindset print", "emotional-expression tapestry", "self-growth wall decor"],
    mood: ["a home office that needed a daily reminder", "a gym corner", "a desk setup for someone chasing something", "a bedroom wall for the version of you that's still becoming"],
    intent: ["anyone searching for motivational wall art that isn't a cheesy quote poster", "a home-office or gym mindset corner", "a gift for someone chasing a goal"],
  },
  "Myth & Divinity": {
    kw: ["mythology wall art", "deity print", "spiritual tapestry", "Hindu mythology art", "divine wall decor"],
    mood: ["a puja corner that deserved better lighting", "a living room that wanted some reverence in it", "a meditation room", "a hallway that needed presence"],
    intent: ["anyone searching for Hindu mythology and deity wall art", "a puja room or meditation space upgrade", "a spiritually meaningful housewarming gift"],
  },
  Nature: {
    kw: ["nature wall art", "landscape print", "outdoor-inspired tapestry", "nature home decor"],
    mood: ["a home office with a view problem", "a living room that needed to breathe", "a reading nook by the window", "a hallway that felt a little flat"],
    intent: ["anyone searching for landscape and nature wall art", "a calming home-office or reading-nook refresh", "nature lovers who can't always get outside"],
  },
  People: {
    kw: ["portrait wall art", "figurative print", "human-silhouette tapestry", "statement portrait decor"],
    mood: ["a living room centrepiece wall", "a studio apartment's one big moment", "a hallway gallery wall", "a bedroom that needed a focal point"],
    intent: ["anyone searching for figurative or portrait-style wall art", "a living-room or hallway focal-point piece", "collectors of statement figurative prints"],
  },
  Places: {
    kw: ["travel wall art", "cityscape print", "destination-inspired tapestry", "travel-themed home decor"],
    mood: ["a traveller's bedroom", "a home office for someone who'd rather be elsewhere", "a living room that needed a window to somewhere else", "a hostel-chic studio"],
    intent: ["travellers and cityscape-print collectors", "anyone searching for travel-themed wall art", "a gift for someone who's always planning the next trip"],
  },
  "Pop Culture": {
    kw: ["pop culture wall art", "fandom tapestry", "sports wall decor", "trending wall art"],
    mood: ["a dorm room", "a man-cave that needed an upgrade", "a fan's bedroom wall", "a games-room backdrop"],
    intent: ["fans searching for fandom and pop-culture wall art", "a dorm room, man-cave, or games-room upgrade", "a gift for the fan who already has everything official"],
  },
  Spirituality: {
    kw: ["spiritual wall art", "meditation print", "chakra tapestry", "mindfulness home decor"],
    mood: ["a meditation corner", "a yoga room", "a bedroom that needed calmer energy", "a reading nook for quiet mornings"],
    intent: ["anyone searching for meditation or mindfulness wall art", "a yoga room or meditation-corner upgrade", "a calming gift for someone building a mindfulness practice"],
  },
  Surreal: {
    kw: ["surreal wall art", "dreamlike print", "psychedelic tapestry", "surrealist home decor"],
    mood: ["a creative studio", "a living room that needed to feel a little unreal", "a bedroom for someone who dreams in colour", "a hallway that deserved a double-take"],
    intent: ["surrealist-art and psychedelic-print collectors", "anyone searching for dreamlike, conversation-starting wall art", "a creative studio or statement bedroom wall"],
  },
  "Symbols & Sigils": {
    kw: ["sacred-geometry wall art", "symbolic print", "sigil tapestry", "symbolic home decor"],
    mood: ["a meditation room", "a minimalist study", "a hallway that wanted meaning on the wall, not just decoration", "a home office that needed quiet focus"],
    intent: ["anyone searching for sacred-geometry or symbolic wall art", "a meditation room or minimalist study", "collectors who want meaning behind the decor"],
  },
  "Vintage & Retro": {
    kw: ["vintage wall art", "retro print", "throwback tapestry", "retro home decor"],
    mood: ["a living room going for a lived-in look", "a record-and-coffee corner", "a studio apartment with personality", "a bedroom with some throwback energy"],
    intent: ["anyone searching for vintage or retro-style wall art", "a record corner or throwback-themed room", "a nostalgia gift for a specific decade"],
  },
};

const UNIVERSAL = {
  gift: [
    "a housewarming gift that doesn't look like everyone else's",
    "a gift for the friend who says they don't want anything",
    "a genuinely original gift for someone who already has everything",
    "a birthday or festival gift that actually gets remembered",
  ],
  interior: [
    "a real interior-design statement piece, not filler decor",
    "wall art that finishes a room instead of just filling a wall",
    "a focal-point piece for a living room, bedroom, or home office",
    "the one piece a room was missing",
  ],
  collector: [
    "a limited-edition piece for a serious art collector",
    "an original wall art investment, not a mass-printed poster",
    "a true one-of-one collectible",
  ],
};

function fallback(category) {
  const slug = category.toLowerCase();
  return {
    kw: [`${slug} wall art`, `${slug} print`, `${slug} tapestry`],
    mood: ["a wall that needed something different"],
    intent: [`anyone searching for ${slug}-themed wall art`],
  };
}

function hashPick(seed, options) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return options[h % options.length];
}

function an(phrase) {
  return /^[aeiouAEIOU]/.test(phrase) ? "an" : "a";
}

function fmtLabel(formats) {
  return FORMAT_LABEL[(formats && formats[0]) || "CANVAS"] || "wall art print";
}

const DESC_TEMPLATES = [
  (n, b, cat, u, fmt, w) =>
    `${b} "${n}" is ${an(cat.kw0)} ${cat.kw0} from resembles.nothing — ${an(fmt)} ${fmt} printed at ${w}cm, sold once as a true one-of-one and retired from the catalogue the moment it's bought. It works well as ${u.gift} and as ${u.interior}; it's also a strong pick for ${cat.intent}. Made to order in India, fade-resistant, and shipped worldwide.`,
  (n, b, cat, u, fmt, w) =>
    `${b} From the ${cat.name} collection, "${n}" is a ${w}cm ${fmt} designed as ${cat.kw1} — limited to a single edition, so once it sells it's gone from the catalogue for good. Beyond being ${cat.kw0}, it doubles as ${u.gift} and ${u.interior}, and it's a strong pick for ${cat.intent}. Made to order in India, fade-resistant, and shipped worldwide.`,
];

const STORY_TEMPLATES = [
  (n, mood, cat, fabric, u2) =>
    `"${n}" belongs in ${mood} — somewhere that wants ${an(cat.kw0)} real ${cat.kw0}, not a print half the internet already owns. Every resembles.nothing design, this one included, is a strict limited edition: once it's bought, it's retired from the catalogue permanently, so hanging it means owning the only copy that will ever exist on a wall like yours.\n\n` +
    `It's printed on ${fabric}, made to order rather than mass-produced, and checked by hand before it ships. Beyond being ${cat.kw1}, it's ${u2.collector} — a strong pick for ${cat.intent}, or simply ${u2.gift2}. However you found it, it won't be here for anyone else to find after you.`,
  (n, mood, cat, fabric, u2) =>
    `Picture "${n}" in ${mood}: it's the kind of piece that does the talking a bare wall can't. resembles.nothing never reprints a sold design, which makes this less of a purchase and more of a claim — ${an(cat.kw0)} ${cat.kw0} that's yours alone the second it ships.\n\n` +
    `It's built on ${fabric} and made to order in India rather than pulled off a factory line — worth knowing for ${cat.intent}, or just after ${u2.interior2}. It also travels well as ${u2.gift2} — every order is packed carefully and shipped worldwide, so the only thing you need to decide is which wall it's claiming.`,
];

// Deterministic generation (same slug -> same output every time) so running
// this repeatedly, e.g. re-seeding, doesn't rewrite content that's already
// been indexed by search engines under a specific URL.
function generateProductSeoContent({ slug, name, category, blurb, formats, widthCm }) {
  const catData = CATEGORY[category] || fallback(category);
  const altKw = catData.kw.filter((k, i) => i !== 0);
  const cat = {
    name: category,
    kw0: hashPick(slug + "a", catData.kw),
    kw1: hashPick(slug + "b", altKw.length ? altKw : catData.kw),
    intent: hashPick(slug + "f", catData.intent),
  };

  const u = {
    gift: hashPick(slug + "g", UNIVERSAL.gift),
    interior: hashPick(slug + "i", UNIVERSAL.interior),
  };
  const u2 = {
    collector: hashPick(slug + "j", UNIVERSAL.collector),
    gift2: hashPick(slug + "k", UNIVERSAL.gift),
    interior2: hashPick(slug + "l", UNIVERSAL.interior),
  };
  const mood = hashPick(slug + "c", catData.mood);
  const fmt = fmtLabel(formats);
  const fabric = FABRIC_NOTE[fmt] || "premium printed fabric";
  const width = widthCm || 100;

  const descFn = DESC_TEMPLATES[hashPick(slug + "d", DESC_TEMPLATES.map((_, i) => i))];
  const storyFn = STORY_TEMPLATES[hashPick(slug + "e", STORY_TEMPLATES.map((_, i) => i))];

  const description = descFn(name, blurb, cat, u, fmt, width);
  const story = storyFn(name, mood, cat, fabric, u2);
  const alt = `${name} — ${category} ${fmt} wall art, one-of-one limited edition by resembles.nothing, India`;

  return { description, story, alt };
}

module.exports = { generateProductSeoContent };
