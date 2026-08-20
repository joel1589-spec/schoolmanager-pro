const express = require("express");
const { query } = require("../db/pool");
const { moyenneEleve } = require("../lib/calculs");
const { getMention } = require("../lib/reference");
const { requireAuth } = require("../lib/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const etabId = req.user.etablissementId;
  const elevesRes = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", niveau AS "Niveau", classe AS "Classe", serie AS "Serie"
     FROM eleves WHERE etablissement_id = $1`,
    [etabId]
  );
  const eleves = elevesRes.rows;

  const repartition = { Primaire: 0, College: 0, Lycee: 0 };
  for (const e of eleves) if (repartition[e.Niveau] !== undefined) repartition[e.Niveau]++;

  let major = null;
  let sommeMoyennes = 0;
  let compte = 0;
  const moyenneParClasse = {};
  const mentionsCount = {};

  for (const e of eleves) {
    const notesCount = await query("SELECT COUNT(*) FROM notes WHERE id_eleve = $1 AND etablissement_id = $2", [e.ID, etabId]);
    if (Number(notesCount.rows[0].count) === 0) continue;

    const m = await moyenneEleve(e.ID, e.Niveau, etabId);
    sommeMoyennes += m;
    compte++;
    if (!major || m > major.moyenne) {
      major = { id: e.ID, nom: e.Nom, prenom: e.Prenom, moyenne: Math.round(m * 100) / 100 };
    }
    const cle = `${e.Classe}${e.Serie ? " " + e.Serie : ""}`;
    if (!moyenneParClasse[cle]) moyenneParClasse[cle] = { somme: 0, n: 0 };
    moyenneParClasse[cle].somme += m;
    moyenneParClasse[cle].n += 1;

    const mention = getMention(Math.round(m * 100) / 100);
    mentionsCount[mention] = (mentionsCount[mention] || 0) + 1;
  }

  const moyenneEtablissement = compte > 0 ? Math.round((sommeMoyennes / compte) * 100) / 100 : 0;

  // Taux de réussite = proportion d'élèves (parmi ceux notés) avec moyenne >= 10
  let admis = 0;
  for (const e of eleves) {
    const notesCount = await query("SELECT COUNT(*) FROM notes WHERE id_eleve = $1 AND etablissement_id = $2", [e.ID, etabId]);
    if (Number(notesCount.rows[0].count) === 0) continue;
    const m = await moyenneEleve(e.ID, e.Niveau, etabId);
    if (m >= 10) admis++;
  }
  const tauxReussiteFinal = compte > 0 ? Math.round((admis / compte) * 1000) / 10 : 0;

  const moyennesParClasse = Object.entries(moyenneParClasse).map(([classe, v]) => ({
    classe, moyenne: Math.round((v.somme / v.n) * 100) / 100,
  }));

  res.json({
    totalEleves: eleves.length,
    repartitionParNiveau: repartition,
    moyenneEtablissement,
    tauxReussite: tauxReussiteFinal,
    eleveMajor: major,
    moyennesParClasse,
    repartitionMentions: Object.entries(mentionsCount).map(([mention, count]) => ({ mention, count })),
  });
});

module.exports = router;
