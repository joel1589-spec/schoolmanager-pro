const express = require("express");
const { query } = require("../db/pool");
const { hashPassword, verifyPassword, createToken, requireAuth, requireRole } = require("../lib/auth");

const router = express.Router();

function toUserJson(u) {
  return {
    id: u.id, nom: u.nom, identifiant: u.identifiant, role: u.role,
    idEnseignant: u.id_enseignant || "", etablissementId: u.etablissement_id || null,
  };
}

// Indique si la plateforme n'a encore aucun compte (affiche l'écran de création du SuperAdmin)
router.get("/status", async (req, res) => {
  const r = await query("SELECT COUNT(*) FROM utilisateurs");
  res.json({ needsSuperAdminBootstrap: Number(r.rows[0].count) === 0 });
});

// Création du tout premier compte de la plateforme : le SuperAdmin (gère la liste des écoles).
// N'est possible que si aucun utilisateur n'existe encore, nulle part.
router.post("/bootstrap", async (req, res) => {
  const count = await query("SELECT COUNT(*) FROM utilisateurs");
  if (Number(count.rows[0].count) > 0) {
    return res.status(403).json({ error: "Un compte existe déjà sur la plateforme." });
  }
  const { Nom, Identifiant, MotDePasse } = req.body;
  if (!Nom || !Identifiant || !MotDePasse) {
    return res.status(400).json({ error: "Nom, identifiant et mot de passe requis" });
  }
  const { hash, salt } = hashPassword(MotDePasse);
  const r = await query(
    `INSERT INTO utilisateurs (nom, identifiant, mot_de_passe_hash, mot_de_passe_sel, role)
     VALUES ($1, $2, $3, $4, 'SuperAdmin') RETURNING *`,
    [Nom, Identifiant, hash, salt]
  );
  const user = r.rows[0];
  const token = createToken({ id: user.id, identifiant: user.identifiant, nom: user.nom, role: "SuperAdmin", etablissementId: null });
  res.status(201).json({ token, user: toUserJson(user) });
});

router.post("/login", async (req, res) => {
  const { Identifiant, MotDePasse } = req.body;
  const r = await query("SELECT * FROM utilisateurs WHERE identifiant = $1", [Identifiant]);
  const user = r.rows[0];
  if (!user || !verifyPassword(MotDePasse || "", user.mot_de_passe_hash, user.mot_de_passe_sel)) {
    return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
  }
  const token = createToken({
    id: user.id, identifiant: user.identifiant, nom: user.nom, role: user.role,
    etablissementId: user.etablissement_id || null,
  });
  res.json({ token, user: toUserJson(user) });
});

router.get("/me", requireAuth, (req, res) => res.json(req.user));

// Un administrateur d'école crée les comptes enseignants de SON établissement (Module 2.1)
router.post("/users", requireAuth, requireRole("Administrateur"), async (req, res) => {
  const { Nom, Identifiant, MotDePasse, Role, IDEnseignant } = req.body;
  if (!Nom || !Identifiant || !MotDePasse || !Role) {
    return res.status(400).json({ error: "Tous les champs sont requis" });
  }
  if (Role === "SuperAdmin") {
    return res.status(403).json({ error: "Un administrateur d'école ne peut pas créer de compte SuperAdmin" });
  }
  const existing = await query("SELECT 1 FROM utilisateurs WHERE identifiant = $1", [Identifiant]);
  if (existing.rows.length) return res.status(409).json({ error: "Cet identifiant existe déjà" });

  const { hash, salt } = hashPassword(MotDePasse);
  const r = await query(
    `INSERT INTO utilisateurs (etablissement_id, nom, identifiant, mot_de_passe_hash, mot_de_passe_sel, role, id_enseignant)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.user.etablissementId, Nom, Identifiant, hash, salt, Role, Role === "Enseignant" ? (IDEnseignant || null) : null]
  );
  res.status(201).json(toUserJson(r.rows[0]));
});

router.put("/users/:id", requireAuth, requireRole("Administrateur"), async (req, res) => {
  const { IDEnseignant } = req.body;
  const r = await query(
    `UPDATE utilisateurs SET id_enseignant = $1
     WHERE id = $2 AND etablissement_id = $3 RETURNING *`,
    [IDEnseignant || null, req.params.id, req.user.etablissementId]
  );
  if (!r.rows.length) return res.status(404).json({ error: "Utilisateur introuvable" });
  res.json(toUserJson(r.rows[0]));
});

router.get("/users", requireAuth, requireRole("Administrateur"), async (req, res) => {
  const r = await query(
    "SELECT * FROM utilisateurs WHERE etablissement_id = $1 ORDER BY nom",
    [req.user.etablissementId]
  );
  res.json(r.rows.map(toUserJson));
});

router.delete("/users/:id", requireAuth, requireRole("Administrateur"), async (req, res) => {
  const r = await query(
    "DELETE FROM utilisateurs WHERE id = $1 AND etablissement_id = $2",
    [req.params.id, req.user.etablissementId]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: "Utilisateur introuvable" });
  res.json({ success: true });
});

module.exports = router;
