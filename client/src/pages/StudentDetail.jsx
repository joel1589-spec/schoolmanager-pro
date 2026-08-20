import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const EMPTY_ATT = { Date: new Date().toISOString().slice(0, 10), Heure: "", Statut: "Présent" };

export default function StudentDetail() {
  const { user } = useAuth();
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [notes, setNotes] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState(null);
  const [matieres, setMatieres] = useState([]);
  const [selectedMatiere, setSelectedMatiere] = useState("");
  const [noteValues, setNoteValues] = useState({ Interro: "", Devoir: "", Composition: "", Professeur: "" });
  const [attForm, setAttForm] = useState(EMPTY_ATT);
  const [error, setError] = useState("");

  function load() {
    api.getStudent(id).then((s) => {
      setStudent(s);
      api.getMatieres({ niveau: s.Niveau, classe: s.Classe, serie: s.Serie || "" }).then(setMatieres);
    }).catch((e) => setError(e.message));
    api.getNotes(id).then(setNotes);
    api.getAttendance(id).then(setAttendance);
    api.getAttendanceStats(id).then(setStats);
  }

  useEffect(load, [id]);

  const isPrimaire = student?.Niveau === "Primaire";
  const notedMatieres = new Set(notes.map((n) => n.Matiere));
  const availableMatieres = matieres.filter((m) => !notedMatieres.has(m.Nom));
  const selected = matieres.find((m) => m.Nom === selectedMatiere);

  async function addNote(e) {
    e.preventDefault();
    if (!selected) return;
    try {
      const payload = {
        IDEleve: Number(id),
        Matiere: selected.Nom,
        Coefficient: selected.Coefficient,
        Professeur: noteValues.Professeur,
        Interro: isPrimaire ? noteValues.Interro : noteValues.Interro,
        Devoir: isPrimaire ? noteValues.Interro : noteValues.Devoir,
        Composition: isPrimaire ? noteValues.Interro : noteValues.Composition,
      };
      await api.createNote(payload);
      setSelectedMatiere("");
      setNoteValues({ Interro: "", Devoir: "", Composition: "", Professeur: "" });
      load();
    } catch (err) { alert(err.message); }
  }

  async function removeNote(noteId) {
    await api.deleteNote(noteId);
    load();
  }

  async function addAttendance(e) {
    e.preventDefault();
    try {
      await api.createAttendance({ ...attForm, IDEleve: Number(id) });
      setAttForm(EMPTY_ATT);
      load();
    } catch (err) { alert(err.message); }
  }

  async function removeAttendance(recId) {
    await api.deleteAttendance(recId);
    load();
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!student) return <p className="loading">Chargement…</p>;

  return (
    <div>
      <header className="page-header">
        <Link to="/eleves" style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>&larr; Retour à la liste</Link>
        <div className="page-eyebrow">Fiche élève</div>
        <h1 className="page-title">{student.Nom} {student.Prenom}</h1>
        <p className="page-subtitle">
          {student.Niveau} · {student.Classe}{student.Serie ? ` · Série ${student.Serie}` : ""} · Moyenne actuelle : <strong>{Math.round(student.moyenne * 100) / 100} / 20</strong>
        </p>
        {user?.role === "Administrateur" && (
          <a
            href={api.bulletinUrl(id)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-brass"
            style={{ display: "inline-block", marginTop: 12, textDecoration: "none" }}
          >
            📄 Générer le bulletin PDF
          </a>
        )}
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Notes */}
        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Module 4 — Notes</h3>
          <table>
            <thead>
              <tr>
                <th>Matière</th>
                {!isPrimaire && <><th>Interro</th><th>Devoir</th><th>Compo</th><th>Coeff</th></>}
                <th>Moy.</th>
                {!isPrimaire && <th>Note finale</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n.ID}>
                  <td>{n.Matiere}</td>
                  {!isPrimaire && <><td className="mono">{n.Interro}</td><td className="mono">{n.Devoir}</td><td className="mono">{n.Composition}</td><td className="mono">{n.Coefficient}</td></>}
                  <td className="mono">{n.NoteGenerale}</td>
                  {!isPrimaire && <td className="mono">{n.NoteFinale}</td>}
                  <td><button className="btn btn-danger btn-sm" onClick={() => removeNote(n.ID)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          {availableMatieres.length === 0 ? (
            <p style={{ color: "var(--text-soft)", fontSize: "0.85rem", marginTop: 14 }}>
              Toutes les matières de cette classe ont déjà une note.{" "}
              <Link to="/matieres">Gérer les matières</Link>
            </p>
          ) : (
            <form onSubmit={addNote} style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
              <div className="form-field" style={{ flex: "1 1 160px" }}>
                <label>Matière</label>
                <select required value={selectedMatiere} onChange={(e) => setSelectedMatiere(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {availableMatieres.map((m) => (
                    <option key={m.ID} value={m.Nom}>{m.Nom} (coef {m.Coefficient})</option>
                  ))}
                </select>
              </div>
              {!isPrimaire ? (
                <>
                  <div className="form-field" style={{ width: 70 }}>
                    <label>Interro</label>
                    <input type="number" step="0.25" value={noteValues.Interro} onChange={(e) => setNoteValues({ ...noteValues, Interro: e.target.value })} />
                  </div>
                  <div className="form-field" style={{ width: 70 }}>
                    <label>Devoir</label>
                    <input type="number" step="0.25" value={noteValues.Devoir} onChange={(e) => setNoteValues({ ...noteValues, Devoir: e.target.value })} />
                  </div>
                  <div className="form-field" style={{ width: 70 }}>
                    <label>Compo</label>
                    <input type="number" step="0.25" value={noteValues.Composition} onChange={(e) => setNoteValues({ ...noteValues, Composition: e.target.value })} />
                  </div>
                  <div className="form-field" style={{ width: 65 }}>
                    <label>Coeff</label>
                    <input value={selected ? selected.Coefficient : ""} disabled />
                  </div>
                </>
              ) : (
                <div className="form-field" style={{ width: 80 }}>
                  <label>Note /20</label>
                  <input type="number" step="0.25" value={noteValues.Interro} onChange={(e) => setNoteValues({ ...noteValues, Interro: e.target.value })} />
                </div>
              )}
              <div className="form-field" style={{ flex: "1 1 120px" }}>
                <label>Professeur</label>
                <input value={noteValues.Professeur} onChange={(e) => setNoteValues({ ...noteValues, Professeur: e.target.value })} />
              </div>
              <button className="btn btn-primary btn-sm" type="submit">Ajouter</button>
            </form>
          )}
        </div>

        {/* Présences */}
        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Module 7 — Présences</h3>
          {stats && (
            <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
              <span className="badge badge-sage">{stats.presences} présences</span>
              <span className="badge badge-alert">{stats.absences} absences</span>
              <span className="badge badge-brass">{stats.tauxPresence}% de présence</span>
            </div>
          )}
          <form onSubmit={addAttendance} style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <input type="date" value={attForm.Date} onChange={(e) => setAttForm({ ...attForm, Date: e.target.value })} />
            <select value={attForm.Statut} onChange={(e) => setAttForm({ ...attForm, Statut: e.target.value })}>
              <option>Présent</option>
              <option>Absent</option>
              <option>Retard</option>
            </select>
            <button className="btn btn-primary btn-sm" type="submit">Enregistrer</button>
          </form>
          <table>
            <tbody>
              {attendance.slice(0, 8).map((a) => (
                <tr key={a.ID}>
                  <td className="mono">{a.Date}</td>
                  <td>
                    <span className={`badge ${a.Statut === "Absent" ? "badge-alert" : a.Statut === "Retard" ? "badge-brass" : "badge-sage"}`}>
                      {a.Statut}
                    </span>
                  </td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => removeAttendance(a.ID)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
