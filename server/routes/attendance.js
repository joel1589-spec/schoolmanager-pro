const express = require("express");
const { query } = require("../db/pool");
const { requireAuth, requireRole } = require("../lib/auth");
const { getAffectationsForUser, studentInScope } = require("../lib/scope");

const router = express.Router();
router.use(requireAuth, requireRole("Administrateur", "Enseignant"));

function toPresenceJson(p) {
  return { ID: p.id, IDEleve: p.id_eleve, Date: p.date, Heure: p.heure, Statut: p.statut };
}

async function checkAccess(req, res, idEleve) {
  const r = await query(
    `SELECT id AS "ID", nom AS "Nom", niveau AS "Niveau", classe AS "Classe", serie AS "Serie"
     FROM eleves WHERE id = $1 AND etablissement_id = $2`,
    [idEleve, req.user.etablissementId]
  );
  const eleve = r.rows[0];
  if (!eleve) { res.status(404).json({ error: "Élève introuvable" }); return null; }
  const affectations = await getAffectationsForUser(req.user);
  if (!studentInScope(eleve, affectations)) {
    res.status(403).json({ error: "Vous n'êtes pas affecté à la classe de cet élève" });
    return null;
  }
  return eleve;
}

router.get("/", async (req, res) => {
  const { idEleve } = req.query;
  if (idEleve && !(await checkAccess(req, res, idEleve))) return;
  const r = idEleve
    ? await query("SELECT * FROM presences WHERE id_eleve = $1 AND etablissement_id = $2 ORDER BY date DESC", [idEleve, req.user.etablissementId])
    : await query("SELECT * FROM presences WHERE etablissement_id = $1 ORDER BY date DESC", [req.user.etablissementId]);
  res.json(r.rows.map(toPresenceJson));
});

router.post("/", async (req, res) => {
  const { IDEleve, Date: date, Heure, Statut } = req.body;
  if (!IDEleve || !date || !Statut) return res.status(400).json({ error: "IDEleve, Date et Statut sont requis" });
  if (!(await checkAccess(req, res, IDEleve))) return;
  const r = await query(
    `INSERT INTO presences (etablissement_id, id_eleve, date, heure, statut) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.etablissementId, IDEleve, date, Heure || "", Statut]
  );
  res.status(201).json(toPresenceJson(r.rows[0]));
});

router.delete("/:id", async (req, res) => {
  const existing = await query("SELECT * FROM presences WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  if (!existing.rows.length) return res.status(404).json({ error: "Enregistrement introuvable" });
  if (!(await checkAccess(req, res, existing.rows[0].id_eleve))) return;
  await query("DELETE FROM presences WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

router.get("/stats/:idEleve", async (req, res) => {
  if (!(await checkAccess(req, res, req.params.idEleve))) return;
  const r = await query("SELECT statut FROM presences WHERE id_eleve = $1 AND etablissement_id = $2", [req.params.idEleve, req.user.etablissementId]);
  const rows = r.rows;
  const total = rows.length;
  const absences = rows.filter((x) => x.statut === "Absent").length;
  const retards = rows.filter((x) => x.statut === "Retard").length;
  const presences = rows.filter((x) => x.statut === "Présent").length;
  const taux = total > 0 ? Math.round((presences / total) * 1000) / 10 : 100;
  res.json({ total, presences, absences, retards, tauxPresence: taux });
});

module.exports = router;
