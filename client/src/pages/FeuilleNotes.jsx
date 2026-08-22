import { useEffect, useState } from "react";
import { api } from "../api";

const NIVEAUX_CLASSES = {
  Primaire: ["CP1", "CP2", "CE1", "CE2", "CM1", "CM2"],
  College: ["6ème", "5ème", "4ème", "3ème"],
  Lycee: ["Seconde", "Première", "Terminale"],
};
const SERIES = ["A4", "C", "D", "S", "G1", "G2", "G3", "G4", "F1", "F2", "F3", "F4"];
const CHAMPS = [
  { value: "Interro", label: "Interrogation" },
  { value: "Devoir", label: "Devoir" },
  { value: "Composition", label: "Composition" },
];

export default function FeuilleNotes() {
  const [settings, setSettings] = useState(null);
  const [niveau, setNiveau] = useState("Lycee");
  const [classe, setClasse] = useState("Terminale");
  const [serie, setSerie] = useState("D");
  const [periode, setPeriode] = useState("");
  const [matieresDisponibles, setMatieresDisponibles] = useState([]);
  const [matiere, setMatiere] = useState("");
  const [champ, setChamp] = useState("Interro");
  const [professeur, setProfesseur] = useState("");
  const [eleves, setEleves] = useState([]);
  const [valeurs, setValeurs] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const isLycee = niveau === "Lycee";

  useEffect(() => { api.getSettings().then((s) => { setSettings(s); setPeriode(s.PeriodeActuelle); }); }, []);

  useEffect(() => {
    const params = { niveau, classe };
    if (isLycee) params.serie = serie;
    api.getMatieres(params).then((list) => {
      setMatieresDisponibles(list);
      if (list.length && !list.find((m) => m.Nom === matiere)) setMatiere(list[0].Nom);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niveau, classe, serie]);

  function loadFeuille() {
    if (!matiere || !periode) return;
    setError(""); setSavedMsg("");
    const params = { niveau, classe, matiere, periode };
    if (isLycee) params.serie = serie;
    api.getFeuilleNotes(params).then((data) => {
      setEleves(data.eleves);
      const initial = {};
      for (const e of data.eleves) initial[e.ID] = e[champ] === "" ? "" : e[champ];
      setValeurs(initial);
    }).catch((e) => setError(e.message));
  }
  useEffect(loadFeuille, [matiere, periode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (eleves.length === 0) return;
    const initial = {};
    for (const e of eleves) initial[e.ID] = e[champ] === "" ? "" : e[champ];
    setValeurs(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champ]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setSavedMsg("");
    try {
      const Valeurs = Object.entries(valeurs)
        .filter(([, v]) => v !== "" && v !== null && v !== undefined)
        .map(([idEleve, valeur]) => ({ idEleve: Number(idEleve), valeur: Number(valeur) }));
      const payload = { Niveau: niveau, Classe: classe, Matiere: matiere, Periode: periode, Champ: champ, Professeur: professeur, Valeurs };
      if (isLycee) payload.Serie = serie;
      const res = await api.saveFeuilleNotes(payload);
      setSavedMsg(`${res.count} note(s) enregistrée(s).`);
      loadFeuille();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  if (!settings) return <p className="loading">Chargement…</p>;

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Module 4 — Saisie rapide</div>
        <h1 className="page-title">Feuille de notes</h1>
        <p className="page-subtitle">
          Choisissez la période, la classe, la matière et le type d'évaluation : la liste des élèves apparaît,
          il ne reste qu'à remplir chaque note et enregistrer en une fois.
        </p>
      </header>

      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <select value={periode} onChange={(e) => setPeriode(e.target.value)}>
          {settings.PeriodesDisponibles.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={niveau} onChange={(e) => { setNiveau(e.target.value); setClasse(NIVEAUX_CLASSES[e.target.value][0]); }}>
          {Object.keys(NIVEAUX_CLASSES).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={classe} onChange={(e) => setClasse(e.target.value)}>
          {NIVEAUX_CLASSES[niveau].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {isLycee && (
          <select value={serie} onChange={(e) => setSerie(e.target.value)}>
            {SERIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select value={matiere} onChange={(e) => setMatiere(e.target.value)} disabled={matieresDisponibles.length === 0}>
          {matieresDisponibles.length === 0 && <option>Aucune matière configurée</option>}
          {matieresDisponibles.map((m) => <option key={m.ID} value={m.Nom}>{m.Nom}</option>)}
        </select>
        {niveau !== "Primaire" && (
          <select value={champ} onChange={(e) => setChamp(e.target.value)}>
            {CHAMPS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {eleves.length === 0 ? (
        <div className="card"><div className="empty-state">Aucun élève dans cette classe pour le moment.</div></div>
      ) : (
        <form onSubmit={submit}>
          <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Élève</th>
                  <th style={{ width: 140 }}>{niveau === "Primaire" ? "Note /20" : CHAMPS.find((c) => c.value === champ)?.label}</th>
                  <th style={{ width: 100 }}>Moy. actuelle</th>
                </tr>
              </thead>
              <tbody>
                {eleves.map((el) => (
                  <tr key={el.ID}>
                    <td>{el.Nom} {el.Prenom}</td>
                    <td>
                      <input
                        type="number" min="0" max="20" step="0.25"
                        value={valeurs[el.ID] ?? ""}
                        onChange={(e) => setValeurs({ ...valeurs, [el.ID]: e.target.value })}
                        style={{ width: 90 }}
                        placeholder="—"
                      />
                    </td>
                    <td className="mono" style={{ color: "var(--text-soft)" }}>{el.NoteGenerale === "" ? "—" : el.NoteGenerale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="toolbar">
            <div className="form-field" style={{ maxWidth: 260 }}>
              <label>Professeur (optionnel)</label>
              <input value={professeur} onChange={(e) => setProfesseur(e.target.value)} placeholder="Nom du professeur" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
              {saving ? "Enregistrement…" : "Enregistrer toute la feuille"}
            </button>
          </div>
          {savedMsg && <p style={{ color: "var(--ink)", fontWeight: 600, marginTop: 10 }}>✓ {savedMsg}</p>}
        </form>
      )}
    </div>
  );
}
