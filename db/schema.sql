-- Schéma PostgreSQL multi-établissements pour SchoolManager Pro
-- Compatible Neon (aucune extension propriétaire utilisée)

CREATE TABLE IF NOT EXISTS etablissements (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  slug TEXT UNIQUE, -- réservé pour un usage futur (sous-domaine, lien direct...)
  type TEXT NOT NULL DEFAULT 'Prive', -- 'Prive' | 'Public'
  ministere TEXT DEFAULT 'MINISTÈRE DES ENSEIGNEMENTS PRIMAIRE ET SECONDAIRE',
  direction_regionale TEXT DEFAULT '',
  iesg TEXT DEFAULT '',
  adresse TEXT DEFAULT '',
  telephone TEXT DEFAULT '',
  bp TEXT DEFAULT '',
  logo BYTEA,
  logo_mimetype TEXT,
  niveaux_actifs TEXT[] NOT NULL DEFAULT ARRAY['Primaire','College','Lycee'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Les identifiants de connexion sont uniques sur toute la plateforme (pas de sélection
-- d'établissement au login : le compte détermine lui-même l'établissement).
-- etablissement_id = NULL uniquement pour le rôle SuperAdmin (gère la liste des écoles).
CREATE TABLE IF NOT EXISTS utilisateurs (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER REFERENCES etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  identifiant TEXT NOT NULL UNIQUE,
  mot_de_passe_hash TEXT NOT NULL,
  mot_de_passe_sel TEXT NOT NULL,
  role TEXT NOT NULL, -- 'SuperAdmin' | 'Administrateur' | 'Enseignant'
  id_enseignant INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enseignants (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  telephone TEXT DEFAULT '',
  email TEXT DEFAULT ''
);

ALTER TABLE utilisateurs
  ADD CONSTRAINT fk_utilisateurs_enseignant
  FOREIGN KEY (id_enseignant) REFERENCES enseignants(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS affectations (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  id_enseignant INTEGER NOT NULL REFERENCES enseignants(id) ON DELETE CASCADE,
  niveau TEXT NOT NULL,
  classe TEXT NOT NULL,
  serie TEXT DEFAULT '',
  matiere TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS eleves (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  niveau TEXT NOT NULL,
  classe TEXT NOT NULL,
  serie TEXT DEFAULT '',
  annee TEXT DEFAULT '',
  trimestre TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  id_eleve INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  matiere TEXT NOT NULL,
  interro NUMERIC DEFAULT 0,
  devoir NUMERIC DEFAULT 0,
  composition NUMERIC DEFAULT 0,
  coefficient NUMERIC DEFAULT 1,
  note_generale NUMERIC DEFAULT 0,
  note_finale NUMERIC DEFAULT 0,
  professeur TEXT DEFAULT '',
  absences INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS presences (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  id_eleve INTEGER NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  heure TEXT DEFAULT '',
  statut TEXT NOT NULL -- 'Présent' | 'Absent' | 'Retard'
);

CREATE TABLE IF NOT EXISTS emploi_du_temps (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  niveau TEXT NOT NULL,
  classe TEXT NOT NULL,
  serie TEXT DEFAULT '',
  jour TEXT NOT NULL,
  heure_debut TEXT NOT NULL,
  heure_fin TEXT NOT NULL,
  matiere TEXT NOT NULL,
  id_enseignant INTEGER REFERENCES enseignants(id) ON DELETE SET NULL,
  salle TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS examens (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  type TEXT DEFAULT 'Composition',
  date_debut DATE NOT NULL,
  date_fin DATE,
  niveau TEXT DEFAULT '',
  classe TEXT DEFAULT '',
  serie TEXT DEFAULT '',
  statut TEXT DEFAULT 'Planifié'
);

CREATE TABLE IF NOT EXISTS matieres (
  id SERIAL PRIMARY KEY,
  etablissement_id INTEGER NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  niveau TEXT NOT NULL,
  classe TEXT DEFAULT '', -- vide = s'applique à toutes les classes du niveau (ex : Lycée par série)
  serie TEXT DEFAULT '',  -- vide = s'applique à toutes les séries
  categorie TEXT NOT NULL,
  nom TEXT NOT NULL,
  coefficient NUMERIC NOT NULL DEFAULT 1
);

-- Index de performance : toutes les requêtes filtrent quasi systématiquement par établissement
CREATE INDEX IF NOT EXISTS idx_utilisateurs_etab ON utilisateurs(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_enseignants_etab ON enseignants(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_affectations_etab ON affectations(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_eleves_etab ON eleves(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_notes_etab ON notes(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_notes_eleve ON notes(id_eleve);
CREATE INDEX IF NOT EXISTS idx_presences_etab ON presences(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_presences_eleve ON presences(id_eleve);
CREATE INDEX IF NOT EXISTS idx_edt_etab ON emploi_du_temps(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_examens_etab ON examens(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_matieres_etab ON matieres(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_matieres_lookup ON matieres(etablissement_id, niveau, classe, serie);

-- ============================================================================
-- MIGRATION : périodes (trimestre/semestre), comptes élèves, portail élève
-- Ce bloc est idempotent (peut être ré-exécuté sans risque sur une base existante).
-- ============================================================================

-- Une note appartient désormais à une période précise (1er Trimestre, 2e Semestre, ...)
-- au lieu d'être une valeur unique et permanente par matière.
ALTER TABLE notes ADD COLUMN IF NOT EXISTS periode TEXT NOT NULL DEFAULT '1er Trimestre';
DROP INDEX IF EXISTS idx_notes_eleve_matiere_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_eleve_matiere_periode
  ON notes(etablissement_id, id_eleve, matiere, periode);

-- Période actuellement active pour une école (sert de valeur par défaut à la saisie)
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS periode_actuelle TEXT NOT NULL DEFAULT '1er Trimestre';

-- Un compte utilisateur peut désormais être un élève (auto-créé à son inscription)
-- ou, plus tard, un parent.
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS id_eleve INTEGER;
DO $$ BEGIN
  ALTER TABLE utilisateurs ADD CONSTRAINT fk_utilisateurs_eleve
    FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_utilisateurs_eleve ON utilisateurs(id_eleve);

-- Permet au Super Administrateur de suspendre temporairement l'accès à une école
-- (ex : problème à régler) sans supprimer ses données.
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;


