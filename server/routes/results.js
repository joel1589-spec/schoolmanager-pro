const express = require("express");
const { classement } = require("../lib/calculs");
const { requireAuth } = require("../lib/auth");
const { getAffectationsForUser, filterStudentsForScope } = require("../lib/scope");

const router = express.Router();
router.use(requireAuth);

// GET /api/results?niveau=Lycee&classe=Terminale&serie=D
router.get("/", async (req, res) => {
  const { niveau, classe, serie } = req.query;
  const rows = await classement({ etablissementId: req.user.etablissementId, niveau, classe, serie });
  const affectations = await getAffectationsForUser(req.user);
  res.json(filterStudentsForScope(rows, affectations));
});

module.exports = router;
