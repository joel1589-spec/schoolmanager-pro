import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

const EMPTY = { Nom: "", Identifiant: "", MotDePasse: "", Role: "Enseignant", IDEnseignant: "" };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  function load() {
    api.getUsers().then(setUsers).catch((e) => setError(e.message));
    api.getTeachers().then(setTeachers);
  }
  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    try {
      await api.createUser(form);
      setForm(EMPTY);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function remove(id) {
    if (!confirm("Supprimer ce compte ?")) return;
    await api.deleteUser(id);
    load();
  }

  async function relink(userId, IDEnseignant) {
    await api.linkUserToTeacher(userId, IDEnseignant);
    load();
  }

  function teacherName(id) {
    const t = teachers.find((t) => String(t.ID) === String(id));
    return t ? `${t.Nom} ${t.Prenom}` : null;
  }

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Administration</div>
        <h1 className="page-title">Comptes utilisateurs</h1>
        <p className="page-subtitle">Administrateurs et enseignants ayant accès au logiciel.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 24, alignItems: "start" }}>
        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Ajouter un compte</h3>
          <form onSubmit={submit}>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Nom complet</label>
              <input required value={form.Nom} onChange={(e) => setForm({ ...form, Nom: e.target.value })} />
            </div>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Identifiant</label>
              <input required value={form.Identifiant} onChange={(e) => setForm({ ...form, Identifiant: e.target.value })} />
            </div>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Mot de passe</label>
              <input required type="password" value={form.MotDePasse} onChange={(e) => setForm({ ...form, MotDePasse: e.target.value })} />
            </div>
            <div className="form-field" style={{ marginBottom: 10 }}>
              <label>Rôle</label>
              <select value={form.Role} onChange={(e) => setForm({ ...form, Role: e.target.value, IDEnseignant: "" })}>
                <option value="Enseignant">Enseignant</option>
                <option value="Administrateur">Administrateur</option>
              </select>
            </div>
            {form.Role === "Enseignant" && (
              <div className="form-field" style={{ marginBottom: 16 }}>
                <label>Lier au profil enseignant</label>
                <select value={form.IDEnseignant} onChange={(e) => setForm({ ...form, IDEnseignant: e.target.value })}>
                  <option value="">— Aucun (pas d'accès aux classes) —</option>
                  {teachers.map((t) => <option key={t.ID} value={t.ID}>{t.Nom} {t.Prenom}</option>)}
                </select>
                <p style={{ fontSize: "0.76rem", color: "var(--text-soft)", marginTop: 4 }}>
                  Détermine les classes que cet enseignant pourra voir. Pas de fiche ? <Link to="/enseignants">Créez-en une d'abord</Link>.
                </p>
              </div>
            )}
            <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>Créer le compte</button>
          </form>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {error && <p className="error-text" style={{ padding: 16 }}>{error}</p>}
          <table>
            <thead>
              <tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Profil enseignant lié</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.nom}</td>
                  <td className="mono">{u.identifiant}</td>
                  <td><span className={`badge ${u.role === "Administrateur" ? "badge-brass" : "badge-sage"}`}>{u.role}</span></td>
                  <td>
                    {u.role === "Enseignant" ? (
                      <select value={u.idEnseignant || ""} onChange={(e) => relink(u.id, e.target.value)}>
                        <option value="">— Non lié —</option>
                        {teachers.map((t) => <option key={t.ID} value={t.ID}>{t.Nom} {t.Prenom}</option>)}
                      </select>
                    ) : (
                      <span style={{ color: "var(--text-soft)" }}>—</span>
                    )}
                  </td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => remove(u.id)}>Supprimer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
