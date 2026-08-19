// Single source of truth for size/price tiers + tax metadata.
// Resembles.Nothing final price list, effective 2026-08-19.
//
// priceINR is in paise (what Razorpay actually charges); priceUSD is in
// whole dollars, reference-only display — Razorpay only ever bills INR.
//
// These prices are GST-INCLUSIVE final prices (what the buyer pays) — GST
// is not stored as a separate amount anywhere. taxBreakdown() below splits
// a final price into taxable value + GST at runtime, for invoicing/GST
// returns, per the pricing sheet's own rule: "GST is calculated at runtime
// rather than hardcoded into each product price."
//
// INR and USD are independent price lists, not currency conversions of each
// other (confirmed with the business) — don't derive one from the other.

const GST_RATES = {
  TAPESTRY: 0.05,
  CANVAS: 0.18,
  DIPTYCH: 0.18,
  TRIPTYCH: 0.18,
  QUADRIPTYCH: 0.18,
};

const HSN_CODES = {
  TAPESTRY: "6304",
  CANVAS: "49119100",
  DIPTYCH: "49119100",
  TRIPTYCH: "49119100",
  QUADRIPTYCH: "49119100",
};

// USD prices are understood to carry a buffer for US import duty on top of
// the "real" design value, but this rate is an unfinalized placeholder and
// US shipping/logistics isn't set up yet — nothing charges this separately
// right now, it's baked into the priceUSD numbers below as-is. Recheck
// before actually shipping to the US.
const US_DUTY_BUFFER_RATE = 0.15; // placeholder, unfinalized — do not treat as final

const TAPESTRY_SIZES = [
  { label: "Signature", dims: "70 × 100 cm", priceINR: 111100, priceUSD: 79 },
  { label: "Grand", dims: "100 × 150 cm", priceINR: 166600, priceUSD: 99 },
  { label: "Monument", dims: "130 × 180 cm", priceINR: 222200, priceUSD: 109 },
];

const CANVAS_SIZES = [
  { label: "Window", dims: "20 × 30 cm", priceINR: 179900, priceUSD: 99 },
  { label: "Gateway", dims: "30 × 30 cm", priceINR: 229900, priceUSD: 109 },
  { label: "Portal", dims: "30 × 40 cm", priceINR: 279900, priceUSD: 119 },
  { label: "Realm", dims: "50 × 70 cm", priceINR: 449900, priceUSD: 169 },
];

const DIPTYCH_SIZES = [
  { label: "Window", dims: "20 × 30 cm per panel", priceINR: 359900, priceUSD: 129 },
  { label: "Gateway", dims: "30 × 30 cm per panel", priceINR: 439900, priceUSD: 149 },
  { label: "Portal", dims: "30 × 40 cm per panel", priceINR: 559900, priceUSD: 179 },
  { label: "Realm", dims: "50 × 70 cm per panel", priceINR: 899900, priceUSD: 249 },
];

const TRIPTYCH_SIZES = [
  { label: "Window", dims: "20 × 30 cm per panel", priceINR: 519900, priceUSD: 179 },
  { label: "Gateway", dims: "30 × 30 cm per panel", priceINR: 649900, priceUSD: 199 },
  { label: "Portal", dims: "30 × 40 cm per panel", priceINR: 809900, priceUSD: 229 },
  { label: "Realm", dims: "50 × 70 cm per panel", priceINR: 1179900, priceUSD: 329 },
];

const QUADRIPTYCH_SIZES = [
  { label: "Window", dims: "20 × 30 cm per panel", priceINR: 679900, priceUSD: 219 },
  { label: "Gateway", dims: "30 × 30 cm per panel", priceINR: 839900, priceUSD: 269 },
  { label: "Portal", dims: "30 × 40 cm per panel", priceINR: 1069900, priceUSD: 319 },
  { label: "Realm", dims: "50 × 70 cm per panel", priceINR: 1569900, priceUSD: 429 },
];

const SIZE_TABLES = {
  TAPESTRY: TAPESTRY_SIZES,
  CANVAS: CANVAS_SIZES,
  DIPTYCH: DIPTYCH_SIZES,
  TRIPTYCH: TRIPTYCH_SIZES,
  QUADRIPTYCH: QUADRIPTYCH_SIZES,
};

function sizesFor(format) {
  return SIZE_TABLES[format] || CANVAS_SIZES;
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

function gstRateFor(format) {
  return GST_RATES[format] ?? GST_RATES.CANVAS;
}

function hsnFor(format) {
  return HSN_CODES[format] || HSN_CODES.CANVAS;
}

// finalPriceINR is GST-inclusive, in paise (what the buyer actually paid).
// Splits it into taxable value + GST amount for invoicing/GST-return
// purposes — this never changes what the buyer is charged, it only breaks
// down a number that was already final.
function taxBreakdown(format, finalPriceINR) {
  const rate = gstRateFor(format);
  const taxableValue = Math.round(finalPriceINR / (1 + rate));
  const gstAmount = finalPriceINR - taxableValue;
  return { rate, hsn: hsnFor(format), taxableValue, gstAmount, finalPriceINR };
}

module.exports = {
  TAPESTRY_SIZES,
  CANVAS_SIZES,
  DIPTYCH_SIZES,
  TRIPTYCH_SIZES,
  QUADRIPTYCH_SIZES,
  GST_RATES,
  HSN_CODES,
  US_DUTY_BUFFER_RATE,
  sizesFor,
  findSize,
  defaultSize,
  gstRateFor,
  hsnFor,
  taxBreakdown,
};
