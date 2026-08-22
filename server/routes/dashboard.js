const express = require("express");
const { query } = require("../db/pool");
const { moyenneEleve } = require("../lib/calculs");
const { getMention } = require("../lib/reference");
const { requireAuth } = require("../lib/auth");
const { getAffectationsForUser, filterStudentsForScope } = require("../lib/scope");

const router = express.Router();
router.use(requireAuth);

const NIVEAUX = ["Primaire", "College", "Lycee"];

router.get("/", async (req, res) => {
  const etabId = req.user.etablissementId;
  const etabRes = await query("SELECT periode_actuelle FROM etablissements WHERE id = $1", [etabId]);
  const periode = etabRes.rows[0].periode_actuelle;

  const elevesRes = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", niveau AS "Niveau", classe AS "Classe", serie AS "Serie"
     FROM eleves WHERE etablissement_id = $1`,
    [etabId]
  );
  let eleves = elevesRes.rows;

  // Un enseignant ne voit les statistiques que de ses classes assignées
  const affectations = await getAffectationsForUser(req.user);
  eleves = filterStudentsForScope(eleves, affectations);

  const parNiveau = {};
  for (const niveau of NIVEAUX) {
    const elevesNiveau = eleves.filter((e) => e.Niveau === niveau);

    // Répartition par classe (et par série au Lycée), pour éviter tout comptage manuel
    const parClasse = {};
    for (const e of elevesNiveau) {
      const cle = e.Classe;
      if (!parClasse[cle]) parClasse[cle] = { total: 0, series: {} };
      parClasse[cle].total++;
      if (e.Serie) parClasse[cle].series[e.Serie] = (parClasse[cle].series[e.Serie] || 0) + 1;
    }

    let sommeMoyennes = 0, compte = 0, admis = 0, major = null;
    for (const e of elevesNiveau) {
      const notesCount = await query(
        "SELECT COUNT(*) FROM notes WHERE id_eleve = $1 AND etablissement_id = $2 AND periode = $3",
        [e.ID, etabId, periode]
      );
      if (Number(notesCount.rows[0].count) === 0) continue;
      const m = await moyenneEleve(e.ID, e.Niveau, etabId, periode);
      sommeMoyennes += m;
      compte++;
      if (m >= 10) admis++;
      if (!major || m > major.moyenne) {
        major = { id: e.ID, nom: e.Nom, prenom: e.Prenom, classe: e.Classe, serie: e.Serie, moyenne: Math.round(m * 100) / 100 };
      }
    }

    parNiveau[niveau] = {
      totalEleves: elevesNiveau.length,
      parClasse: Object.fromEntries(Object.entries(parClasse).map(([classe, v]) => [classe, { total: v.total, series: v.series }])),
      moyenneNiveau: compte > 0 ? Math.round((sommeMoyennes / compte) * 100) / 100 : 0,
      tauxReussite: compte > 0 ? Math.round((admis / compte) * 1000) / 10 : 0,
      eleveMajor: major,
    };
  }

  // Répartition des mentions et moyennes par classe, toutes classes confondues (pour les graphiques)
  const moyenneParClasse = {};
  const mentionsCount = {};
  for (const e of eleves) {
    const notesCount = await query(
      "SELECT COUNT(*) FROM notes WHERE id_eleve = $1 AND etablissement_id = $2 AND periode = $3",
      [e.ID, etabId, periode]
    );
    if (Number(notesCount.rows[0].count) === 0) continue;
    const m = await moyenneEleve(e.ID, e.Niveau, etabId, periode);
    const cle = `${e.Classe}${e.Serie ? " " + e.Serie : ""}`;
    if (!moyenneParClasse[cle]) moyenneParClasse[cle] = { somme: 0, n: 0 };
    moyenneParClasse[cle].somme += m;
    moyenneParClasse[cle].n += 1;
    const mention = getMention(Math.round(m * 100) / 100);
    mentionsCount[mention] = (mentionsCount[mention] || 0) + 1;
  }

  res.json({
    periode,
    totalEleves: eleves.length,
    repartitionParNiveau: Object.fromEntries(NIVEAUX.map((n) => [n, parNiveau[n].totalEleves])),
    parNiveau,
    moyennesParClasse: Object.entries(moyenneParClasse).map(([classe, v]) => ({ classe, moyenne: Math.round((v.somme / v.n) * 100) / 100 })),
    repartitionMentions: Object.entries(mentionsCount).map(([mention, count]) => ({ mention, count })),
  });
});

module.exports = router;
