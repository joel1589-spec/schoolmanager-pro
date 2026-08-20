import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [needsBootstrap, setNeedsBootstrap] = useState(null);
  const [form, setForm] = useState({ Nom: "", Identifiant: "", MotDePasse: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.authStatus().then((s) => setNeedsBootstrap(s.needsSuperAdminBootstrap)).catch(() => setNeedsBootstrap(false));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = needsBootstrap ? await api.bootstrap(form) : await api.login(form);
      login(res.token, res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (needsBootstrap === null) return null;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--ink)",
    }}>
      <div className="card" style={{ width: 380, background: "var(--paper)" }}>
        <div className="page-eyebrow">SchoolManager Pro</div>
        <h1 className="page-title" style={{ fontSize: "1.5rem", marginBottom: 4 }}>
          {needsBootstrap ? "Créer le compte plateforme" : "Connexion"}
        </h1>
        <p className="page-subtitle" style={{ marginBottom: 20 }}>
          {needsBootstrap
            ? "Première utilisation de la plateforme : créez le compte administrateur général, qui pourra ensuite créer les écoles."
            : "Connectez-vous avec votre identifiant."}
        </p>

        <form onSubmit={submit}>
          {needsBootstrap && (
            <div className="form-field" style={{ marginBottom: 12 }}>
              <label>Nom complet</label>
              <input required value={form.Nom} onChange={(e) => setForm({ ...form, Nom: e.target.value })} />
            </div>
          )}
          <div className="form-field" style={{ marginBottom: 12 }}>
            <label>Identifiant</label>
            <input required value={form.Identifiant} onChange={(e) => setForm({ ...form, Identifiant: e.target.value })} />
          </div>
          <div className="form-field" style={{ marginBottom: 16 }}>
            <label>Mot de passe</label>
            <input required type="password" value={form.MotDePasse} onChange={(e) => setForm({ ...form, MotDePasse: e.target.value })} />
          </div>
          {error && <p className="error-text" style={{ marginTop: 0 }}>{error}</p>}
          <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={loading}>
            {loading ? "…" : needsBootstrap ? "Créer le compte" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
