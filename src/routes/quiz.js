const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/result", requireAuth, async (req, res) => {
  const { personaId, personaName } = req.body;
  const result = await prisma.quizResult.upsert({
    where: { userId: req.user.id },
    update: { personaId, personaName },
    create: { userId: req.user.id, personaId, personaName },
  });
  res.json({ result });
});

router.get("/result", requireAuth, async (req, res) => {
  const result = await prisma.quizResult.findUnique({ where: { userId: req.user.id } });
  res.json({ result });
});

module.exports = router;
