import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const EMPTY = {
  Nom: "", Type: "Prive", Ministere: "MINISTÈRE DES ENSEIGNEMENTS PRIMAIRE ET SECONDAIRE",
  DirectionRegionale: "", IESG: "", Adresse: "", Telephone: "", BP: "",
};

export default function Settings() {
  const [form, setForm] = useState(EMPTY);
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  function load() {
    api.getSettings().then((s) => {
      setForm(s);
      if (s.logoUrl) setLogoUrl(api.logoUrl());
    }).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    try {
      await api.updateSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) { alert(err.message); }
  }

  async function uploadLogo(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await api.uploadLogo(file);
      setLogoUrl(api.logoUrl());
    } catch (err) { alert(err.message); }
  }

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Configuration</div>
        <h1 className="page-title">Paramètres de l'établissement</h1>
        <p className="page-subtitle">
          Ces informations apparaissent en en-tête des bulletins PDF. Le format du bulletin
          (privé ou officiel) change automatiquement selon le type choisi ci-dessous.
        </p>
      </header>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, alignItems: "start" }}>
        <div className="card">
          <form onSubmit={submit}>
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>Nom de l'établissement</label>
              <input required value={form.Nom} onChange={(e) => setForm({ ...form, Nom: e.target.value })} />
            </div>

            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>Type d'établissement (détermine le format du bulletin)</label>
              <select value={form.Type} onChange={(e) => setForm({ ...form, Type: e.target.value })}>
                <option value="Prive">Privé — bulletin détaillé par matière (notes de classe, compo, rang, appréciation)</option>
                <option value="Public">Public / Officiel — bulletin groupé par catégorie (scientifiques, littéraires…)</option>
              </select>
            </div>

            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>Période actuelle (trimestre / semestre en cours)</label>
              <select value={form.PeriodeActuelle} onChange={(e) => setForm({ ...form, PeriodeActuelle: e.target.value })}>
                {(form.PeriodesDisponibles || ["1er Trimestre", "2e Trimestre", "3e Trimestre", "1er Semestre", "2e Semestre"]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <p style={{ fontSize: "0.76rem", color: "var(--text-soft)", marginTop: 4 }}>
                Sert de valeur par défaut à la saisie des notes et au tableau de bord. Changez-la quand l'école passe à la période suivante.
              </p>
            </div>

            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>Modèle de bulletin</label>
              <select value={form.ModeleBulletin || "Prive"} onChange={(e) => setForm({ ...form, ModeleBulletin: e.target.value })}>
                <option value="Prive">Privé — détaillé par matière (notes de classe, compo, rang)</option>
                <option value="Public">Public / Officiel — groupé par catégorie</option>
                <option value="Compact">Compact — une ligne par matière, économe en papier</option>
                <option value="Detaille">Détaillé — toutes les évaluations + appréciations</option>
                <option value="Primaire">Primaire — sans coefficients, niveau atteint</option>
              </select>
            </div>

            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>Devise (écolage et reçus)</label>
              <input value={form.Devise || "FCFA"} onChange={(e) => setForm({ ...form, Devise: e.target.value })} />
            </div>

            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>Ministère (ligne d'en-tête)</label>
              <input value={form.Ministere} onChange={(e) => setForm({ ...form, Ministere: e.target.value })} />
            </div>

            <div className="form-grid" style={{ marginBottom: 12 }}>
              <div className="form-field">
                <label>Direction régionale</label>
                <input value={form.DirectionRegionale} onChange={(e) => setForm({ ...form, DirectionRegionale: e.target.value })} placeholder="Ex : DRE Grand Lomé" />
              </div>
              <div className="form-field">
                <label>IESG</label>
                <input value={form.IESG} onChange={(e) => setForm({ ...form, IESG: e.target.value })} placeholder="Ex : IESG Golfe" />
              </div>
            </div>

            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>Adresse</label>
              <input value={form.Adresse} onChange={(e) => setForm({ ...form, Adresse: e.target.value })} placeholder="Ex : Lomé, 12 BP 292 Lomé 12" />
            </div>

            <div className="form-grid" style={{ marginBottom: 20 }}>
              <div className="form-field">
                <label>Téléphone</label>
                <input value={form.Telephone} onChange={(e) => setForm({ ...form, Telephone: e.target.value })} />
              </div>
              <div className="form-field">
                <label>Boîte postale (BP)</label>
                <input value={form.BP} onChange={(e) => setForm({ ...form, BP: e.target.value })} />
              </div>
            </div>

            <button className="btn btn-primary" type="submit">
              {saved ? "✓ Enregistré" : "Enregistrer"}
            </button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Logo de l'établissement</h3>
          <p style={{ fontSize: "0.8rem", color: "var(--text-soft)", marginBottom: 14 }}>
            Ce logo apparaît en haut à gauche des bulletins PDF générés. Formats acceptés : PNG, JPEG (3 Mo max).
          </p>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo établissement" style={{ width: 90, height: 90, objectFit: "contain", border: "1px solid var(--line)", borderRadius: 6, marginBottom: 14, background: "#fff" }} />
          ) : (
            <div style={{ width: 90, height: 90, border: "1px dashed var(--line)", borderRadius: 6, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-soft)", fontSize: "0.7rem", textAlign: "center" }}>
              Aucun logo
            </div>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={uploadLogo} style={{ display: "none" }} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()}>
              {logoUrl ? "Changer le logo" : "Téléverser un logo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
