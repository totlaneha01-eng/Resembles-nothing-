require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Public marketing site (public/index.html) — a static landing page, not the
// interactive shop. It sends buyers to Instagram/WhatsApp DMs to order, so it
// doesn't call any of the /api routes below.
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/artists", require("./routes/artists"));
app.use("/api/payouts", require("./routes/payouts"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/quiz", require("./routes/quiz"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/admin", require("./routes/admin"));
app.use("/webhooks/whatsapp", require("./routes/whatsappWebhook"));

app.get("/health", (req, res) => res.json({ ok: true }));

// Centralized error handler — every route above can just `throw` or reject
// and it lands here instead of crashing the process or leaking stack traces.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Something went wrong" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`resembles.nothing API running on :${PORT}`));
