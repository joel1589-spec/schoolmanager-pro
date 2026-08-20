const express = require("express");
const { query } = require("../db/pool");
const { requireAuth, requireRole } = require("../lib/auth");
const { getAffectationsForUser, studentInScope, filterStudentsForScope } = require("../lib/scope");

const router = express.Router();
router.use(requireAuth);

function toEleveJson(e) {
  return {
    ID: e.id, Nom: e.nom, Prenom: e.prenom, Niveau: e.niveau, Classe: e.classe,
    Serie: e.serie, Annee: e.annee, Trimestre: e.trimestre,
  };
}

// GET /api/students?search=&classe=&serie=&niveau=
router.get("/", async (req, res) => {
  const { search, classe, serie, niveau } = req.query;
  const conditions = ["etablissement_id = $1"];
  const params = [req.user.etablissementId];
  if (niveau) { params.push(niveau); conditions.push(`niveau = $${params.length}`); }
  if (classe) { params.push(classe); conditions.push(`classe = $${params.length}`); }
  if (serie) { params.push(serie); conditions.push(`serie = $${params.length}`); }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(nom) LIKE $${params.length} OR LOWER(prenom) LIKE $${params.length})`);
  }

  const r = await query(
    `SELECT * FROM eleves WHERE ${conditions.join(" AND ")} ORDER BY nom, prenom`,
    params
  );
  let eleves = r.rows.map(toEleveJson);

  const affectations = await getAffectationsForUser(req.user);
  eleves = filterStudentsForScope(eleves, affectations);
  res.json(eleves);
});

router.get("/:id", async (req, res) => {
  const r = await query("SELECT * FROM eleves WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (!r.rows.length) return res.status(404).json({ error: "Élève introuvable" });
  const eleve = toEleveJson(r.rows[0]);

  const affectations = await getAffectationsForUser(req.user);
  if (!studentInScope(eleve, affectations)) {
    return res.status(403).json({ error: "Vous n'êtes pas affecté à la classe de cet élève" });
  }

  const { moyenneEleve } = require("../lib/calculs");
  const moyenne = await moyenneEleve(eleve.ID, eleve.Niveau, req.user.etablissementId);
  res.json({ ...eleve, moyenne });
});

router.post("/", requireRole("Administrateur"), async (req, res) => {
  const { Nom, Prenom, Niveau, Classe, Serie, Annee, Trimestre } = req.body;
  if (!Nom || !Prenom || !Niveau || !Classe) {
    return res.status(400).json({ error: "Nom, Prénom, Niveau et Classe sont requis" });
  }
  const r = await query(
    `INSERT INTO eleves (etablissement_id, nom, prenom, niveau, classe, serie, annee, trimestre)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.user.etablissementId, Nom, Prenom, Niveau, Classe, Serie || "", Annee || "", Trimestre || ""]
  );
  res.status(201).json(toEleveJson(r.rows[0]));
});

router.put("/:id", requireRole("Administrateur"), async (req, res) => {
  const { Nom, Prenom, Niveau, Classe, Serie, Annee, Trimestre } = req.body;
  const r = await query(
    `UPDATE eleves SET nom=COALESCE($1,nom), prenom=COALESCE($2,prenom), niveau=COALESCE($3,niveau),
       classe=COALESCE($4,classe), serie=COALESCE($5,serie), annee=COALESCE($6,annee), trimestre=COALESCE($7,trimestre)
     WHERE id = $8 AND etablissement_id = $9 RETURNING *`,
    [Nom, Prenom, Niveau, Classe, Serie, Annee, Trimestre, req.params.id, req.user.etablissementId]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Élève introuvable" });
  res.json(toEleveJson(r.rows[0]));
});

router.delete("/:id", requireRole("Administrateur"), async (req, res) => {
  // ON DELETE CASCADE supprime automatiquement ses notes et présences
  const r = await query("DELETE FROM eleves WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (r.rowCount === 0) return res.status(404).json({ error: "Élève introuvable" });
  res.json({ success: true });
});

module.exports = router;
