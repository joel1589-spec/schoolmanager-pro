const express = require("express");
const { genererBulletinPDF } = require("../lib/bulletin");
const { requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();

// Génération des bulletins : réservée à l'Administrateur (Module 2.1)
router.get("/:idEleve", requireAuth, requireRole("Administrateur"), async (req, res) => {
  await genererBulletinPDF(req.params.idEleve, req.user.etablissementId, res);
});

module.exports = router;
