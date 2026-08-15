const express = require("express");
const router = express.Router();

// Meta calls this once with a GET request to verify you own the endpoint
// when you first configure the webhook in Meta Business Manager.
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Inbound messages (replies, delivery/read receipts) land here. Useful later
// for things like "customer replied STOP" -> turn off whatsappOptIn, or
// routing an artist<->customer chat reply back into the app.
router.post("/", express.json(), (req, res) => {
  // console.log(JSON.stringify(req.body, null, 2));
  // TODO: parse req.body.entry[].changes[].value.messages[] and react —
  // e.g. update NotificationLog delivery status, or forward chat replies.
  res.sendStatus(200);
});

module.exports = router;
