// Generates a GST-compliant invoice PDF for one order, using the same
// tax math the pricing sheet was already built for (see taxBreakdown in
// pricing.js) — this just puts it on paper instead of only in code.
const PDFDocument = require("pdfkit");
const { taxBreakdown } = require("./pricing");

const GOLD = "#c9a24b";
const INK = "#0a0a09";

function money(paise) {
  return "Rs. " + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Streams the PDF straight to res (an Express response) rather than
// building a Buffer in memory — fine at this scale, and one less thing to
// hold onto.
function streamInvoice(order, res) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.id.slice(0, 8)}.pdf"`);
  doc.pipe(res);

  doc.fillColor(INK).fontSize(20).font("Helvetica-Bold").text("resembles.nothing", { continued: false });
  doc.fontSize(9).font("Helvetica").fillColor("#666").text("Art Beyond Comparison");
  doc.moveDown(1.2);

  doc.fillColor(INK).fontSize(14).font("Helvetica-Bold").text("TAX INVOICE");
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica").fillColor("#333");
  doc.text(`Invoice / Order ID: ${order.id}`);
  doc.text(`Date: ${new Date(order.paymentConfirmedAt || order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`);
  doc.text(`Payment: ${order.paymentMethod === "UPI_MANUAL" ? "UPI (direct)" : "Razorpay"} — ${order.paymentConfirmed ? "Confirmed" : "Awaiting confirmation"}`);
  doc.moveDown(0.8);

  const addr = order.shippingAddress || {};
  doc.font("Helvetica-Bold").text("Billed To");
  doc.font("Helvetica").text(addr.name || order.user?.name || "—");
  if (addr.address) doc.text(addr.address);
  if (addr.pin) doc.text(`PIN: ${addr.pin}`);
  doc.moveDown(1);

  // Table header
  const startX = 50;
  let y = doc.y;
  const cols = [
    { key: "name", label: "Design", w: 150 },
    { key: "format", label: "Format / Size", w: 110 },
    { key: "hsn", label: "HSN", w: 55 },
    { key: "taxable", label: "Taxable", w: 75 },
    { key: "gst", label: "GST", w: 65 },
    { key: "total", label: "Total", w: 75 },
  ];
  doc.font("Helvetica-Bold").fontSize(9).fillColor(GOLD);
  let x = startX;
  for (const c of cols) { doc.text(c.label, x, y, { width: c.w }); x += c.w; }
  y += 16;
  doc.moveTo(startX, y).lineTo(x, y).strokeColor("#ccc").stroke();
  y += 6;

  doc.font("Helvetica").fontSize(9).fillColor("#222");
  let taxableTotal = 0, gstTotal = 0;
  for (const item of order.items) {
    const { taxableValue, gstAmount, rate, hsn } = taxBreakdown(item.format, item.priceINR);
    taxableTotal += taxableValue;
    gstTotal += gstAmount;
    x = startX;
    const row = [
      item.product?.name || "Design",
      `${item.format} — ${item.sizeLabel}`,
      hsn,
      money(taxableValue),
      `${money(gstAmount)} (${(rate * 100).toFixed(0)}%)`,
      money(item.priceINR),
    ];
    const rowHeight = 24;
    row.forEach((val, i) => { doc.text(String(val), x, y, { width: cols[i].w }); x += cols[i].w; });
    y += rowHeight;
  }
  doc.moveTo(startX, y).lineTo(x, y).strokeColor("#ccc").stroke();
  y += 10;

  doc.font("Helvetica-Bold").fontSize(10);
  doc.text(`Taxable Value: ${money(taxableTotal)}`, startX, y, { width: 300 });
  y += 16;
  doc.text(`GST: ${money(gstTotal)}`, startX, y, { width: 300 });
  y += 16;
  doc.fontSize(12).fillColor(INK).text(`Total Paid: ${money(order.totalAmount)}`, startX, y, { width: 300 });

  doc.moveDown(3);
  doc.font("Helvetica").fontSize(8).fillColor("#888").text(
    "Every piece is made to order, one-of-one or a capped small edition — thank you for making room for it on your wall.",
    { width: 500 }
  );

  doc.end();
}

module.exports = { streamInvoice };
