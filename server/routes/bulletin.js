const express = require("express");
const { genererBulletinPDF, genererBulletinsClassePDF, MODELES_DISPONIBLES } = require("../lib/bulletin");
const { requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();

// Liste des modèles de bulletin disponibles (pour les Paramètres établissement)
router.get("/modeles", requireAuth, (req, res) => res.json(MODELES_DISPONIBLES));

// Bulletins de toute une classe, rangés par ordre de mérite (1er, 2e, 3e...)
router.get("/classe", requireAuth, requireRole("Administrateur"), async (req, res) => {
  const { niveau, classe, serie, periode } = req.query;
  if (!niveau || !classe) return res.status(400).json({ error: "Niveau et classe sont requis" });
  await genererBulletinsClassePDF(
    { etablissementId: req.user.etablissementId, niveau, classe, serie: serie || "", periode: periode || null },
    res
  );
});

// Bulletin individuel
router.get("/:idEleve", requireAuth, requireRole("Administrateur"), async (req, res) => {
  await genererBulletinPDF(req.params.idEleve, req.user.etablissementId, req.query.periode || null, res);
});

module.exports = router;
