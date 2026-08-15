// Single source of truth for size/price tiers, mirroring the constants in
// the frontend (resembles-nothing-shop.jsx). If you change a price here,
// change it there too — nothing keeps these two in sync automatically yet.
// INR is what Razorpay actually charges; USD is reference-only display.

const TAPESTRY_SIZES = [
  { label: "Signature", dims: "70 × 100 cm", priceINR: 999, priceUSD: 69 },
  { label: "Grand", dims: "100 × 150 cm", priceINR: 1499, priceUSD: 79 },
  { label: "Monument", dims: "130 × 180 cm", priceINR: 1999, priceUSD: 89 },
];

const CANVAS_SIZES = [
  { label: "Window", dims: "20 × 30 cm", priceINR: 3199, priceUSD: 79 },
  { label: "Gateway", dims: "30 × 30 cm", priceINR: 3899, priceUSD: 89 },
  { label: "Portal", dims: "30 × 40 cm", priceINR: 4999, priceUSD: 99 },
  { label: "Realm", dims: "50 × 70 cm", priceINR: 7999, priceUSD: 139 },
];

const TRIPTYCH_SIZES = [
  { label: "Signature", dims: "20 × 30 cm per panel", priceINR: 4599, priceUSD: 149 },
  { label: "Grand", dims: "30 × 30 cm per panel", priceINR: 5799, priceUSD: 169 },
  { label: "Monument", dims: "30 × 40 cm per panel", priceINR: 7199, priceUSD: 199 },
  { label: "Realm", dims: "50 × 70 cm per panel", priceINR: 10499, priceUSD: 279 },
];

function sizesFor(format) {
  if (format === "TRIPTYCH") return TRIPTYCH_SIZES;
  if (format === "CANVAS") return CANVAS_SIZES;
  return TAPESTRY_SIZES;
}

function findSize(format, label) {
  const match = sizesFor(format).find((s) => s.label === label);
  if (!match) throw new Error(`No "${label}" size tier for format ${format}`);
  return match;
}

function defaultSize(format, referencePriceINR) {
  const options = sizesFor(format);
  return options.find((s) => s.priceINR === referencePriceINR) || options[Math.floor(options.length / 2)];
}

module.exports = { TAPESTRY_SIZES, CANVAS_SIZES, TRIPTYCH_SIZES, sizesFor, findSize, defaultSize };
