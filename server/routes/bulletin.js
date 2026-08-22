const express = require("express");
const { genererBulletinPDF } = require("../lib/bulletin");
const { requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();

// Génération des bulletins : réservée à l'Administrateur (Module 2.1)
// ?periode=1er Trimestre (ou 2e Semestre, etc.) — par défaut, la période active de l'école.
router.get("/:idEleve", requireAuth, requireRole("Administrateur"), async (req, res) => {
  await genererBulletinPDF(req.params.idEleve, req.user.etablissementId, req.query.periode || null, res);
});

module.exports = router;
