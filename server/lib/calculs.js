const { query } = require("../db/pool");
const { getMention } = require("./reference");

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Calcule NoteGenerale et NoteFinale pour une note (Module 4) — pure, pas de DB
function calculerNote({ interro, devoir, composition, coefficient }) {
  const noteClasse = (num(interro) + num(devoir)) / 2;
  const noteGenerale = (noteClasse + num(composition)) / 2;
  const noteFinale = noteGenerale * num(coefficient || 1);
  return { noteGenerale, noteFinale };
}

// Moyenne générale d'un élève pour UNE période donnée (Module 5)
async function moyenneEleve(idEleve, niveau, etablissementId, periode) {
  const res = await query(
    `SELECT note_generale AS "NoteGenerale", note_finale AS "NoteFinale", coefficient
     FROM notes WHERE id_eleve = $1 AND etablissement_id = $2 AND periode = $3`,
    [idEleve, etablissementId, periode]
  );
  const notes = res.rows;
  if (notes.length === 0) return 0;

  if (niveau === "Primaire") {
    const somme = notes.reduce((acc, n) => acc + num(n.NoteGenerale), 0);
    return somme / notes.length;
  }
  const sommeFinales = notes.reduce((acc, n) => acc + num(n.NoteFinale), 0);
  const sommeCoeffs = notes.reduce((acc, n) => acc + num(n.coefficient), 0);
  return sommeCoeffs > 0 ? sommeFinales / sommeCoeffs : 0;
}

// Classement automatique par niveau/classe/série, pour une période, au sein d'un établissement (Module 6)
async function classement({ etablissementId, niveau, classe, serie, periode }) {
  const conditions = ["etablissement_id = $1"];
  const params = [etablissementId];
  if (niveau) { params.push(niveau); conditions.push(`niveau = $${params.length}`); }
  if (classe) { params.push(classe); conditions.push(`classe = $${params.length}`); }
  if (serie) { params.push(serie); conditions.push(`serie = $${params.length}`); }

  const res = await query(
    `SELECT id AS "ID", nom AS "Nom", prenom AS "Prenom", niveau AS "Niveau", classe AS "Classe",
            serie AS "Serie", annee AS "Annee"
     FROM eleves WHERE ${conditions.join(" AND ")}`,
    params
  );

  const avecMoyenne = await Promise.all(
    res.rows.map(async (e) => ({
      ...e,
      moyenne: Math.round((await moyenneEleve(e.ID, e.Niveau, etablissementId, periode)) * 100) / 100,
    }))
  );
  avecMoyenne.sort((a, b) => b.moyenne - a.moyenne);

  return avecMoyenne.map((e, i) => ({ ...e, rang: i + 1, mention: getMention(e.moyenne) }));
}

// Statistiques de la classe pour le bulletin (effectif, moyenne, min, max), pour une période
async function classStats({ etablissementId, niveau, classe, serie, periode }) {
  const rows = await classement({ etablissementId, niveau, classe, serie, periode });
  const moyennes = rows.map((r) => r.moyenne);
  return {
    effectif: rows.length,
    moyenneClasse: moyennes.length ? Math.round((moyennes.reduce((a, b) => a + b, 0) / moyennes.length) * 100) / 100 : 0,
    min: moyennes.length ? Math.min(...moyennes) : 0,
    max: moyennes.length ? Math.max(...moyennes) : 0,
  };
}

// Rang d'un élève dans une matière donnée, au sein de sa classe, pour une période (bulletin format "privé")
async function rangMatiere({ idEleve, matiere, niveau, classe, serie, etablissementId, periode }) {
  const conditions = ["etablissement_id = $1", "niveau = $2", "classe = $3"];
  const params = [etablissementId, niveau, classe];
  if (serie) { params.push(serie); conditions.push(`serie = $${params.length}`); }

  const eleves = await query(`SELECT id AS "ID" FROM eleves WHERE ${conditions.join(" AND ")}`, params);

  const avecNote = await Promise.all(
    eleves.rows.map(async (e) => {
      const noteRes = await query(
        `SELECT note_generale FROM notes WHERE id_eleve = $1 AND etablissement_id = $2 AND matiere = $3 AND periode = $4`,
        [e.ID, etablissementId, matiere, periode]
      );
      return { id: e.ID, note: noteRes.rows[0] ? Number(noteRes.rows[0].note_generale) || 0 : 0 };
    })
  );
  avecNote.sort((a, b) => b.note - a.note);
  const rang = avecNote.findIndex((e) => Number(e.id) === Number(idEleve)) + 1;
  return rang || null;
}

module.exports = { calculerNote, moyenneEleve, classement, classStats, rangMatiere };
