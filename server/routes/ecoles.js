const express = require("express");
const { pool, query } = require("../db/pool");
const { hashPassword, createToken, requireAuth, requireRole } = require("../lib/auth");
const { seedMatieresForEtablissement } = require("../lib/matieresSeed");

const router = express.Router();
router.use(requireAuth, requireRole("SuperAdmin"));

function toEcoleJson(e) {
  return {
    ID: e.id, Nom: e.nom, Type: e.type, NiveauxActifs: e.niveaux_actifs, Active: e.active,
    Ministere: e.ministere, DirectionRegionale: e.direction_regionale, IESG: e.iesg,
    Adresse: e.adresse, Telephone: e.telephone, BP: e.bp,
    hasLogo: !!e.logo, CreatedAt: e.created_at,
  };
}

router.get("/", async (req, res) => {
  const r = await query("SELECT * FROM etablissements ORDER BY nom");
  const counts = await query("SELECT etablissement_id, COUNT(*) AS n FROM eleves GROUP BY etablissement_id");
  const countMap = Object.fromEntries(counts.rows.map((c) => [c.etablissement_id, Number(c.n)]));

  // Nombre de comptes par rôle, par école (visibilité utile pour le SuperAdmin)
  const comptesRes = await query("SELECT etablissement_id, role, COUNT(*) AS n FROM utilisateurs WHERE etablissement_id IS NOT NULL GROUP BY etablissement_id, role");
  const comptesMap = {};
  for (const row of comptesRes.rows) {
    const id = row.etablissement_id;
    if (!comptesMap[id]) comptesMap[id] = { Administrateur: 0, Enseignant: 0, Eleve: 0 };
    comptesMap[id][row.role] = Number(row.n);
  }

  res.json(r.rows.map((e) => ({
    ...toEcoleJson(e),
    effectifTotal: countMap[e.id] || 0,
    comptes: comptesMap[e.id] || { Administrateur: 0, Enseignant: 0, Eleve: 0 },
  })));
});

// Détail d'une école : comptes Administrateur/Enseignant (pour réinitialisation de mot de passe)
router.get("/:id/comptes", async (req, res) => {
  const r = await query(
    "SELECT id, nom, identifiant, role FROM utilisateurs WHERE etablissement_id = $1 AND role IN ('Administrateur','Enseignant') ORDER BY role, nom",
    [req.params.id]
  );
  res.json(r.rows.map((u) => ({ ID: u.id, Nom: u.nom, Identifiant: u.identifiant, Role: u.role })));
});

// Le SuperAdmin peut réinitialiser le mot de passe de n'importe quel compte d'une école
// (utile si un administrateur d'école a oublié son mot de passe).
router.post("/:id/comptes/:userId/reinitialiser", async (req, res) => {
  const crypto = require("crypto");
  const nouveauMotDePasse = crypto.randomBytes(5).toString("hex");
  const { hash, salt } = hashPassword(nouveauMotDePasse);
  const r = await query(
    "UPDATE utilisateurs SET mot_de_passe_hash = $1, mot_de_passe_sel = $2 WHERE id = $3 AND etablissement_id = $4 RETURNING identifiant",
    [hash, salt, req.params.userId, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Compte introuvable" });
  res.json({ identifiant: r.rows[0].identifiant, motDePasse: nouveauMotDePasse });
});

// Crée une nouvelle école ET son premier compte Administrateur, en une seule opération.
router.post("/", async (req, res) => {
  const { Nom, Type, NiveauxActifs, AdminNom, AdminIdentifiant, AdminMotDePasse } = req.body;
  if (!Nom || !AdminNom || !AdminIdentifiant || !AdminMotDePasse) {
    return res.status(400).json({ error: "Nom de l'école et informations du premier administrateur requis" });
  }
  const existing = await query("SELECT 1 FROM utilisateurs WHERE identifiant = $1", [AdminIdentifiant]);
  if (existing.rows.length) return res.status(409).json({ error: "Cet identifiant administrateur existe déjà" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ecoleRes = await client.query(
      `INSERT INTO etablissements (nom, type, niveaux_actifs)
       VALUES ($1, $2, $3) RETURNING *`,
      [Nom, Type || "Prive", NiveauxActifs && NiveauxActifs.length ? NiveauxActifs : ["Primaire", "College", "Lycee"]]
    );
    const ecole = ecoleRes.rows[0];

    await seedMatieresForEtablissement(client, ecole.id);

    const { hash, salt } = hashPassword(AdminMotDePasse);
    await client.query(
      `INSERT INTO utilisateurs (etablissement_id, nom, identifiant, mot_de_passe_hash, mot_de_passe_sel, role)
       VALUES ($1, $2, $3, $4, $5, 'Administrateur')`,
      [ecole.id, AdminNom, AdminIdentifiant, hash, salt]
    );

    await client.query("COMMIT");
    res.status(201).json(toEcoleJson(ecole));
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Erreur lors de la création de l'école : " + err.message });
  } finally {
    client.release();
  }
});

router.put("/:id", async (req, res) => {
  const { Nom, Type, NiveauxActifs, Active } = req.body;
  const r = await query(
    `UPDATE etablissements SET
       nom = COALESCE($1, nom),
       type = COALESCE($2, type),
       niveaux_actifs = COALESCE($3, niveaux_actifs),
       active = COALESCE($4, active)
     WHERE id = $5 RETURNING *`,
    [Nom, Type, NiveauxActifs, Active, req.params.id]
  );
  if (!r.rows.length) return res.status(404).json({ error: "École introuvable" });
  res.json(toEcoleJson(r.rows[0]));
});

router.delete("/:id", async (req, res) => {
  const r = await query("DELETE FROM etablissements WHERE id = $1", [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: "École introuvable" });
  res.json({ success: true });
});

module.exports = router;
