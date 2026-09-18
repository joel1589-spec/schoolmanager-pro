const express = require("express");
const { query } = require("../db/pool");
const { requireAuth } = require("../lib/auth");

const router = express.Router();
router.use(requireAuth);

// Interlocuteurs autorisés :
// - Parent / Élève  -> administration et enseignants de son établissement
// - Personnel       -> tout le monde dans l'établissement
router.get("/contacts", async (req, res) => {
  const role = req.user.role;
  let roles;
  if (role === "Parent" || role === "Eleve") roles = ["Administrateur", "Enseignant", "Caissier"];
  else roles = ["Administrateur", "Enseignant", "Caissier", "Parent", "Eleve"];

  const r = await query(
    `SELECT id, nom, role FROM utilisateurs
     WHERE etablissement_id = $1 AND role = ANY($2) AND id <> $3
     ORDER BY role, nom`,
    [req.user.etablissementId, roles, req.user.id]
  );
  res.json(r.rows.map((u) => ({ ID: u.id, Nom: u.nom, Role: u.role })));
});

// Boîte de réception + messages envoyés, regroupés par correspondant
router.get("/", async (req, res) => {
  const r = await query(
    `SELECT m.id AS "ID", m.sujet AS "Sujet", m.corps AS "Corps", m.lu AS "Lu", m.type AS "Type",
            m.envoye_le AS "EnvoyeLe", m.expediteur_id AS "ExpediteurID", m.destinataire_id AS "DestinataireID",
            ue.nom AS "ExpediteurNom", ue.role AS "ExpediteurRole",
            ud.nom AS "DestinataireNom", ud.role AS "DestinataireRole",
            e.nom AS "EleveNom", e.prenom AS "ElevePrenom"
     FROM messages m
     LEFT JOIN utilisateurs ue ON ue.id = m.expediteur_id
     LEFT JOIN utilisateurs ud ON ud.id = m.destinataire_id
     LEFT JOIN eleves e ON e.id = m.id_eleve
     WHERE m.etablissement_id = $1 AND (m.destinataire_id = $2 OR m.expediteur_id = $2)
     ORDER BY m.envoye_le DESC LIMIT 200`,
    [req.user.etablissementId, req.user.id]
  );
  res.json(r.rows.map((m) => ({ ...m, recu: m.DestinataireID === req.user.id })));
});

router.get("/non-lus", async (req, res) => {
  const r = await query(
    "SELECT COUNT(*) FROM messages WHERE destinataire_id = $1 AND lu = false",
    [req.user.id]
  );
  res.json({ nonLus: Number(r.rows[0].count) });
});

router.post("/", async (req, res) => {
  const { DestinataireID, Sujet, Corps, IDEleve } = req.body;
  if (!DestinataireID || !Corps) return res.status(400).json({ error: "Destinataire et message sont requis" });

  const dest = await query(
    "SELECT 1 FROM utilisateurs WHERE id = $1 AND etablissement_id = $2",
    [DestinataireID, req.user.etablissementId]
  );
  if (!dest.rows.length) return res.status(404).json({ error: "Destinataire introuvable dans cet établissement" });

  const r = await query(
    `INSERT INTO messages (etablissement_id, expediteur_id, destinataire_id, id_eleve, sujet, corps)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id AS "ID", envoye_le AS "EnvoyeLe"`,
    [req.user.etablissementId, req.user.id, DestinataireID, IDEleve || null, Sujet || "", Corps]
  );
  res.status(201).json(r.rows[0]);
});

router.post("/:id/lu", async (req, res) => {
  const r = await query(
    "UPDATE messages SET lu = true WHERE id = $1 AND destinataire_id = $2",
    [req.params.id, req.user.id]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "Message introuvable" });
  res.json({ success: true });
});

module.exports = router;
