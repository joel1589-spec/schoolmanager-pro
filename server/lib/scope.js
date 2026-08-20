const { query } = require("../db/pool");

// Renvoie les affectations (Niveau/Classe/Série) d'un enseignant connecté.
// null = pas de restriction (Administrateur / SuperAdmin).
async function getAffectationsForUser(user) {
  if (!user || user.role !== "Enseignant") return null;
  const res = await query(
    `SELECT a.niveau AS "Niveau", a.classe AS "Classe", a.serie AS "Serie", a.matiere AS "Matiere"
     FROM utilisateurs u
     JOIN affectations a ON a.id_enseignant = u.id_enseignant AND a.etablissement_id = u.etablissement_id
     WHERE u.id = $1 AND u.id_enseignant IS NOT NULL`,
    [user.id]
  );
  return res.rows; // [] si le compte n'est lié à aucune fiche enseignant
}

function studentInScope(eleve, affectations) {
  if (affectations === null) return true;
  return affectations.some(
    (a) => a.Niveau === eleve.Niveau && a.Classe === eleve.Classe && (!a.Serie || a.Serie === eleve.Serie)
  );
}

function filterStudentsForScope(eleves, affectations) {
  if (affectations === null) return eleves;
  return eleves.filter((e) => studentInScope(e, affectations));
}

module.exports = { getAffectationsForUser, studentInScope, filterStudentsForScope };
