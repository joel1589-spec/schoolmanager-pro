import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const NIVEAU_LABEL = { Primaire: "Primaire", College: "Collège", Lycee: "Lycée" };
const NIVEAU_COLORS = { Primaire: "#B08D57", College: "#1F3B39", Lycee: "#8C3A3A" };
const MENTION_COLORS = ["#8C3A3A", "#B08D57", "#DCE3D3", "#2E5347", "#1F3B39", "#D9C79A"];

function NiveauCard({ niveau, data }) {
  const [expanded, setExpanded] = useState(false);
  const classes = Object.entries(data.parClasse);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", margin: 0 }}>{NIVEAU_LABEL[niveau]}</h3>
          <p style={{ color: "var(--text-soft)", fontSize: "0.82rem", margin: "4px 0 0" }}>
            {data.totalEleves} élève(s)
          </p>
        </div>
        {classes.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Masquer le détail" : "Voir par classe"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 24, marginTop: 14, flexWrap: "wrap" }}>
        <div>
          <div className="mono" style={{ fontSize: "1.4rem", fontWeight: 600 }}>{data.moyenneNiveau} / 20</div>
          <div style={{ color: "var(--text-soft)", fontSize: "0.8rem" }}>Moyenne</div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: "1.4rem", fontWeight: 600 }}>{data.tauxReussite}%</div>
          <div style={{ color: "var(--text-soft)", fontSize: "0.8rem" }}>Taux de réussite</div>
        </div>
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>
            {data.eleveMajor ? `${data.eleveMajor.nom} ${data.eleveMajor.prenom}` : "—"}
          </div>
          <div style={{ color: "var(--text-soft)", fontSize: "0.8rem" }}>
            Meilleur élève {data.eleveMajor ? `(${data.eleveMajor.moyenne}/20)` : ""}
          </div>
        </div>
      </div>

      {expanded && classes.length > 0 && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <table>
            <thead><tr><th>Classe</th><th>Effectif</th><th>Détail séries</th></tr></thead>
            <tbody>
              {classes.map(([classe, v]) => (
                <tr key={classe}>
                  <td>{classe}</td>
                  <td className="mono">{v.total}</td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>
                    {Object.keys(v.series).length > 0
                      ? Object.entries(v.series).map(([s, n]) => `${s} (${n})`).join(", ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p className="loading">Chargement…</p>;

  const repartitionData = Object.entries(data.repartitionParNiveau)
    .map(([niveau, value]) => ({ name: NIVEAU_LABEL[niveau], value, niveau }))
    .filter((d) => d.value > 0);

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Vue d'ensemble — {data.periode}</div>
        <h1 className="page-title">Tableau de bord</h1>
        <p className="page-subtitle">
          {user?.role === "Enseignant"
            ? "Statistiques limitées à vos classes assignées."
            : "Statistiques détaillées par niveau, classe et série."}
        </p>
      </header>

      <div className="stat-card" style={{ marginBottom: 20, display: "inline-block", minWidth: 220 }}>
        <div className="stat-label">Total élèves (tous niveaux)</div>
        <div className="stat-value">{data.totalEleves}</div>
      </div>

      {["Primaire", "College", "Lycee"].map((niveau) => (
        data.parNiveau[niveau].totalEleves > 0 && <NiveauCard key={niveau} niveau={niveau} data={data.parNiveau[niveau]} />
      ))}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20, marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Répartition par niveau</h3>
          {repartitionData.length === 0 ? (
            <p className="loading">Aucun élève enregistré.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={repartitionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {repartitionData.map((entry) => <Cell key={entry.name} fill={NIVEAU_COLORS[entry.niveau] || "#B08D57"} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Moyenne par classe</h3>
          {data.moyennesParClasse.length === 0 ? (
            <p className="loading">Aucune note enregistrée pour cette période.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.moyennesParClasse}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="classe" tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
                <Tooltip />
                <Bar dataKey="moyenne" fill="var(--ink)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {data.repartitionMentions.length > 0 && (
        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Répartition des mentions</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.repartitionMentions} dataKey="count" nameKey="mention" cx="50%" cy="50%" outerRadius={75} label>
                {data.repartitionMentions.map((entry, i) => <Cell key={entry.mention} fill={MENTION_COLORS[i % MENTION_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
