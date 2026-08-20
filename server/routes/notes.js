const express = require("express");
const { pool, query } = require("../db/pool");
const { calculerNote } = require("../lib/calculs");
const { requireAuth, requireRole } = require("../lib/auth");
const { getAffectationsForUser, studentInScope } = require("../lib/scope");
const { getMatieresFor } = require("../lib/matieres");

const router = express.Router();
router.use(requireAuth, requireRole("Administrateur", "Enseignant"));

function toNoteJson(n) {
  return {
    ID: n.id, IDEleve: n.id_eleve, Matiere: n.matiere, Interro: Number(n.interro),
    Devoir: Number(n.devoir), Composition: Number(n.composition), Coefficient: Number(n.coefficient),
    NoteGenerale: Number(n.note_generale), NoteFinale: Number(n.note_finale),
    Professeur: n.professeur, Absences: n.absences,
  };
}

async function getEleve(id, etablissementId) {
  const r = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", niveau AS "Niveau", classe AS "Classe", serie AS "Serie"
     FROM eleves WHERE id = $1 AND etablissement_id = $2`,
    [id, etablissementId]
  );
  return r.rows[0] || null;
}

async function checkAccess(req, res, idEleve) {
  const eleve = await getEleve(idEleve, req.user.etablissementId);
  if (!eleve) { res.status(404).json({ error: "Élève introuvable" }); return null; }
  const affectations = await getAffectationsForUser(req.user);
  if (!studentInScope(eleve, affectations)) {
    res.status(403).json({ error: "Vous n'êtes pas affecté à la classe de cet élève" });
    return null;
  }
  return eleve;
}

// ---------- Notes par élève (fiche élève) ----------

router.get("/", async (req, res) => {
  const { idEleve } = req.query;
  if (idEleve && !(await checkAccess(req, res, idEleve))) return;
  const r = idEleve
    ? await query("SELECT * FROM notes WHERE id_eleve = $1 AND etablissement_id = $2", [idEleve, req.user.etablissementId])
    : await query("SELECT * FROM notes WHERE etablissement_id = $1", [req.user.etablissementId]);
  res.json(r.rows.map(toNoteJson));
});

router.post("/", async (req, res) => {
  const { IDEleve, Matiere, Interro, Devoir, Composition, Coefficient, Professeur, Absences } = req.body;
  if (!IDEleve || !Matiere) return res.status(400).json({ error: "IDEleve et Matiere sont requis" });
  if (!(await checkAccess(req, res, IDEleve))) return;

  const { noteGenerale, noteFinale } = calculerNote({ interro: Interro, devoir: Devoir, composition: Composition, coefficient: Coefficient });
  const r = await query(
    `INSERT INTO notes (etablissement_id, id_eleve, matiere, interro, devoir, composition, coefficient, note_generale, note_finale, professeur, absences)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [req.user.etablissementId, IDEleve, Matiere, Interro || 0, Devoir || 0, Composition || 0, Coefficient || 1,
      Math.round(noteGenerale * 100) / 100, Math.round(noteFinale * 100) / 100, Professeur || "", Absences || 0]
  );
  res.status(201).json(toNoteJson(r.rows[0]));
});

router.put("/:id", async (req, res) => {
  const existingRes = await query("SELECT * FROM notes WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  const existing = existingRes.rows[0];
  if (!existing) return res.status(404).json({ error: "Note introuvable" });
  if (!(await checkAccess(req, res, existing.id_eleve))) return;

  const merged = { ...existing, ...req.body };
  const { noteGenerale, noteFinale } = calculerNote({
    interro: merged.Interro ?? merged.interro, devoir: merged.Devoir ?? merged.devoir,
    composition: merged.Composition ?? merged.composition, coefficient: merged.Coefficient ?? merged.coefficient,
  });
  const r = await query(
    `UPDATE notes SET interro=$1, devoir=$2, composition=$3, coefficient=$4, note_generale=$5, note_finale=$6, professeur=$7, absences=$8
     WHERE id = $9 RETURNING *`,
    [merged.Interro ?? merged.interro, merged.Devoir ?? merged.devoir, merged.Composition ?? merged.composition,
      merged.Coefficient ?? merged.coefficient, Math.round(noteGenerale * 100) / 100, Math.round(noteFinale * 100) / 100,
      merged.Professeur ?? merged.professeur, merged.Absences ?? merged.absences, req.params.id]
  );
  res.json(toNoteJson(r.rows[0]));
});

router.delete("/:id", async (req, res) => {
  const existingRes = await query("SELECT * FROM notes WHERE id = $1 AND etablissement_id = $2", [req.params.id, req.user.etablissementId]);
  const existing = existingRes.rows[0];
  if (!existing) return res.status(404).json({ error: "Note introuvable" });
  if (!(await checkAccess(req, res, existing.id_eleve))) return;
  await query("DELETE FROM notes WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

// ---------- Feuille de notes collective (saisie par classe entière) ----------
// Le professeur choisit Niveau + Classe + Série + Matière + type d'évaluation
// (Interro / Devoir / Composition), voit tous les élèves de la classe déjà listés,
// et enregistre toutes les valeurs en une seule fois — comme sur une vraie feuille papier.

async function teacherCanAccessClass(req, { niveau, classe, serie, matiere }) {
  const affectations = await getAffectationsForUser(req.user);
  if (affectations === null) return true; // Administrateur
  return affectations.some(
    (a) =>
      a.Niveau === niveau && a.Classe === classe && (!a.Serie || a.Serie === serie) &&
      (!a.Matiere || a.Matiere === matiere) // matière vide = enseignant du primaire, toutes matières
  );
}

router.get("/feuille", async (req, res) => {
  const { niveau, classe, serie, matiere } = req.query;
  if (!niveau || !classe || !matiere) {
    return res.status(400).json({ error: "Niveau, classe et matière sont requis" });
  }
  if (!(await teacherCanAccessClass(req, { niveau, classe, serie, matiere }))) {
    return res.status(403).json({ error: "Vous n'êtes pas affecté à cette classe/matière" });
  }

  const matieresConfig = await getMatieresFor({ etablissementId: req.user.etablissementId, niveau, classe, serie });
  const matiereInfo = matieresConfig.find((m) => m.Nom === matiere);
  if (!matiereInfo) return res.status(404).json({ error: "Cette matière n'est pas configurée pour cette classe" });

  const conditions = ["etablissement_id = $1", "niveau = $2", "classe = $3"];
  const params = [req.user.etablissementId, niveau, classe];
  if (serie) { params.push(serie); conditions.push(`serie = $${params.length}`); }

  const elevesRes = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom" FROM eleves
     WHERE ${conditions.join(" AND ")} ORDER BY nom, prenom`,
    params
  );

  const notesRes = await query(
    `SELECT * FROM notes WHERE etablissement_id = $1 AND matiere = $2 AND id_eleve = ANY($3::int[])`,
    [req.user.etablissementId, matiere, elevesRes.rows.map((e) => e.ID)]
  );
  const notesByEleve = Object.fromEntries(notesRes.rows.map((n) => [n.id_eleve, n]));

  const eleves = elevesRes.rows.map((e) => {
    const n = notesByEleve[e.ID];
    return {
      ID: e.ID, Nom: e.Nom, Prenom: e.Prenom,
      Interro: n ? Number(n.interro) : "", Devoir: n ? Number(n.devoir) : "",
      Composition: n ? Number(n.composition) : "", NoteGenerale: n ? Number(n.note_generale) : "",
    };
  });

  res.json({ matiere: matiereInfo, eleves });
});

router.post("/feuille", async (req, res) => {
  const { Niveau, Classe, Serie, Matiere, Champ, Professeur, Valeurs } = req.body;
  if (!Niveau || !Classe || !Matiere || !Champ || !Array.isArray(Valeurs)) {
    return res.status(400).json({ error: "Niveau, classe, matière, champ et valeurs sont requis" });
  }
  if (!["Interro", "Devoir", "Composition"].includes(Champ)) {
    return res.status(400).json({ error: "Champ invalide (Interro, Devoir ou Composition attendu)" });
  }
  if (!(await teacherCanAccessClass(req, { niveau: Niveau, classe: Classe, serie: Serie, matiere: Matiere }))) {
    return res.status(403).json({ error: "Vous n'êtes pas affecté à cette classe/matière" });
  }

  const matieresConfig = await getMatieresFor({ etablissementId: req.user.etablissementId, niveau: Niveau, classe: Classe, serie: Serie });
  const matiereInfo = matieresConfig.find((m) => m.Nom === Matiere);
  if (!matiereInfo) return res.status(404).json({ error: "Cette matière n'est pas configurée pour cette classe" });
  const coefficient = Number(matiereInfo.Coefficient);
  const champColonne = { Interro: "interro", Devoir: "devoir", Composition: "composition" }[Champ];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let count = 0;
    for (const { idEleve, valeur } of Valeurs) {
      if (valeur === "" || valeur === null || valeur === undefined) continue;

      const existingRes = await client.query(
        "SELECT * FROM notes WHERE etablissement_id = $1 AND id_eleve = $2 AND matiere = $3",
        [req.user.etablissementId, idEleve, Matiere]
      );
      const existing = existingRes.rows[0];
      const interro = champColonne === "interro" ? valeur : (existing ? existing.interro : 0);
      const devoir = champColonne === "devoir" ? valeur : (existing ? existing.devoir : 0);
      const composition = champColonne === "composition" ? valeur : (existing ? existing.composition : 0);
      const { noteGenerale, noteFinale } = calculerNote({ interro, devoir, composition, coefficient });

      if (existing) {
        await client.query(
          `UPDATE notes SET interro=$1, devoir=$2, composition=$3, coefficient=$4, note_generale=$5, note_finale=$6, professeur=COALESCE(NULLIF($7,''), professeur)
           WHERE id = $8`,
          [interro, devoir, composition, coefficient, Math.round(noteGenerale * 100) / 100, Math.round(noteFinale * 100) / 100, Professeur || "", existing.id]
        );
      } else {
        await client.query(
          `INSERT INTO notes (etablissement_id, id_eleve, matiere, interro, devoir, composition, coefficient, note_generale, note_finale, professeur)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [req.user.etablissementId, idEleve, Matiere, interro, devoir, composition, coefficient,
            Math.round(noteGenerale * 100) / 100, Math.round(noteFinale * 100) / 100, Professeur || ""]
        );
      }
      count++;
    }
    await client.query("COMMIT");
    res.json({ success: true, count });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Erreur lors de l'enregistrement : " + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
