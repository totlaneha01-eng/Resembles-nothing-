// Sends messages via Meta's WhatsApp Business Cloud API.
// Setup (one-time, in Meta Business Manager):
//   1. Create a WhatsApp Business app, get a phone number ID and a permanent access token.
//   2. Pre-approve message templates for anything sent outside a 24h customer-initiated
//      window (order status updates, cart reminders, gift reminders all need templates —
//      free-form text only works if the customer messaged you in the last 24h).
//   3. Put WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in your .env.
const prisma = require("./prisma");

const GRAPH_URL = `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

async function sendWhatsAppTemplate(toNumber, templateName, params = []) {
  const res = await fetch(GRAPH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toNumber,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en" },
        components: params.length ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: String(p) })) }] : [],
      },
    }),
  });
  return res.json();
}

// Wraps a send + writes a NotificationLog row so the in-app notification bell
// and WhatsApp always show the same history — this is what the frontend's
// "sent to your WhatsApp" copy is actually backed by once this is wired up.
async function notifyUser(userId, { title, body, templateName, templateParams = [] }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  let status = "queued";

  if (user?.whatsappOptIn && user?.whatsappNumber) {
    try {
      const result = await sendWhatsAppTemplate(user.whatsappNumber, templateName, templateParams);
      status = result.messages ? "sent" : "failed";
    } catch (err) {
      status = "failed";
    }
  } else {
    status = "skipped_no_optin";
  }

  await prisma.notificationLog.create({
    data: { userId, channel: "whatsapp", title, body, status },
  });
}

// Maps each order status to a pre-approved template name + human-readable copy.
// Register these exact templates in Meta Business Manager before going live.
const ORDER_STATUS_TEMPLATES = {
  PLACED: { template: "order_placed", body: (o) => `Order confirmed — we've got it, ${o.itemCount} piece(s), ₹${o.total / 100}.` },
  BEING_MADE: { template: "order_being_made", body: () => "Your piece is being made by hand right now." },
  PACKED: { template: "order_packed", body: () => "Packed carefully and ready to ship." },
  SHIPPED: { template: "order_shipped", body: (o) => `Shipped! Tracking: ${o.trackingId || "on its way"}.` },
  OUT_FOR_DELIVERY: { template: "order_out_for_delivery", body: () => "Out for delivery today." },
  DELIVERED: { template: "order_delivered", body: () => "Delivered — enjoy the wall. Tag us if you post it!" },
};

async function notifyOrderStatus(orderId, status) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  const cfg = ORDER_STATUS_TEMPLATES[status];
  if (!order || !cfg) return;
  await notifyUser(order.userId, {
    title: `Order ${status.replace(/_/g, " ").toLowerCase()}`,
    body: cfg.body({ itemCount: order.items.length, total: order.totalAmount }),
    templateName: cfg.template,
    templateParams: [order.id.slice(0, 8)],
  });
}

module.exports = { sendWhatsAppTemplate, notifyUser, notifyOrderStatus };
