import { useEffect, useState } from "react";
import { api } from "../api";

const EMPTY = {
  Nom: "", Type: "Prive", NiveauxActifs: ["Primaire", "College", "Lycee"],
  AdminNom: "", AdminIdentifiant: "", AdminMotDePasse: "",
};
const NIVEAUX = ["Primaire", "College", "Lycee"];

export default function Ecoles() {
  const [ecoles, setEcoles] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  function load() {
    api.getEcoles().then(setEcoles).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  function toggleNiveau(n) {
    setForm((f) => ({
      ...f,
      NiveauxActifs: f.NiveauxActifs.includes(n) ? f.NiveauxActifs.filter((x) => x !== n) : [...f.NiveauxActifs, n],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    if (form.NiveauxActifs.length === 0) return alert("Choisissez au moins un niveau enseigné par cette école.");
    try {
      await api.createEcole(form);
      setForm(EMPTY);
      setModalOpen(false);
      load();
    } catch (err) { alert(err.message); }
  }

  async function remove(id) {
    try {
      await api.deleteEcole(id);
      setConfirmDelete(null);
      load();
    } catch (err) { alert(err.message); }
  }

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Plateforme SchoolManager Pro</div>
        <h1 className="page-title">Écoles</h1>
        <p className="page-subtitle">
          {ecoles.length} établissement(s) sur la plateforme. Chaque école a ses propres comptes,
          élèves et données — totalement isolés des autres écoles.
        </p>
      </header>

      <div className="toolbar">
        <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => setModalOpen(true)}>
          + Ajouter une école
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {ecoles.length === 0 ? (
          <div className="empty-state">Aucune école pour le moment.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Nom</th><th>Type</th><th>Niveaux</th><th>Élèves</th><th></th></tr>
            </thead>
            <tbody>
              {ecoles.map((e) => (
                <tr key={e.ID}>
                  <td>{e.Nom}</td>
                  <td><span className={`badge ${e.Type === "Public" ? "badge-brass" : "badge-sage"}`}>{e.Type === "Public" ? "Public" : "Privé"}</span></td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>{(e.NiveauxActifs || []).join(", ")}</td>
                  <td className="mono">{e.effectifTotal}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(e)}>Supprimer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Ajouter une école</h3>
            <form onSubmit={submit}>
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label>Nom de l'école</label>
                <input required value={form.Nom} onChange={(e) => setForm({ ...form, Nom: e.target.value })} />
              </div>
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label>Type (détermine le format du bulletin)</label>
                <select value={form.Type} onChange={(e) => setForm({ ...form, Type: e.target.value })}>
                  <option value="Prive">Privé</option>
                  <option value="Public">Public / Officiel</option>
                </select>
              </div>
              <div className="form-field" style={{ marginBottom: 16 }}>
                <label>Niveaux enseignés par cette école</label>
                <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                  {NIVEAUX.map((n) => (
                    <label key={n} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.86rem", fontWeight: 400 }}>
                      <input type="checkbox" checked={form.NiveauxActifs.includes(n)} onChange={() => toggleNiveau(n)} />
                      {n}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginBottom: 4 }}>
                <p style={{ fontSize: "0.82rem", color: "var(--text-soft)", marginBottom: 10 }}>
                  Premier compte administrateur de cette école
                </p>
              </div>
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label>Nom complet</label>
                <input required value={form.AdminNom} onChange={(e) => setForm({ ...form, AdminNom: e.target.value })} />
              </div>
              <div className="form-field" style={{ marginBottom: 10 }}>
                <label>Identifiant</label>
                <input required value={form.AdminIdentifiant} onChange={(e) => setForm({ ...form, AdminIdentifiant: e.target.value })} />
              </div>
              <div className="form-field" style={{ marginBottom: 16 }}>
                <label>Mot de passe</label>
                <input required type="password" value={form.AdminMotDePasse} onChange={(e) => setForm({ ...form, AdminMotDePasse: e.target.value })} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Créer l'école</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3>Confirmer la suppression</h3>
            <p>
              Supprimer définitivement <strong>{confirmDelete.Nom}</strong> ? Toutes ses données
              (élèves, notes, comptes, etc.) seront perdues. Cette action est irréversible.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={() => remove(confirmDelete.ID)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
