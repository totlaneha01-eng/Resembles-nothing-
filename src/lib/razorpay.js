// All Razorpay calls must happen server-side — the key secret can never be
// shipped to the browser. The frontend only ever sees the order_id this
// creates and your RAZORPAY_KEY_ID (public, safe to expose).
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// amountInPaise: Razorpay works in the smallest currency unit (paise for INR)
async function createRazorpayOrder(amountInPaise, receiptId) {
  return razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: receiptId,
  });
}

// Called from the checkout success handler, using the values Razorpay's
// Checkout.js returns to the browser after payment: order_id, payment_id, signature.
function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return expected === razorpaySignature;
}

// Called from the Razorpay webhook (recommended in addition to client-side
// verification, since webhooks fire even if the user closes the tab mid-payment).
function verifyWebhookSignature(rawBody, signatureHeader) {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return expected === signatureHeader;
}

module.exports = { razorpay, createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature };
