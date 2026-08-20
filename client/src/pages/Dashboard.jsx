import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api";

const NIVEAU_COLORS = { Primaire: "#B08D57", College: "#1F3B33", Lycee: "#8C3A3A" };
const MENTION_COLORS = ["#8C3A3A", "#B08D57", "#DCE3D3", "#2E5347", "#1F3B33", "#D9C79A"];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p className="loading">Chargement…</p>;

  const repartitionData = Object.entries(data.repartitionParNiveau)
    .map(([niveau, value]) => ({ name: niveau, value }))
    .filter((d) => d.value > 0);

  return (
    <div>
      <header className="page-header">
        <div className="page-eyebrow">Vue d'ensemble</div>
        <h1 className="page-title">Tableau de bord</h1>
        <p className="page-subtitle">L'état de l'établissement, en un coup d'œil.</p>
      </header>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Élèves inscrits</div>
          <div className="stat-value">{data.totalEleves}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Moyenne générale</div>
          <div className="stat-value">{data.moyenneEtablissement} / 20</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Taux de réussite</div>
          <div className="stat-value">{data.tauxReussite}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Élève major</div>
          <div className="stat-value" style={{ fontSize: "1.15rem" }}>
            {data.eleveMajor ? `${data.eleveMajor.nom} ${data.eleveMajor.prenom}` : "—"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20, marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Répartition par niveau</h3>
          {repartitionData.length === 0 ? (
            <p className="loading">Aucun élève enregistré.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={repartitionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {repartitionData.map((entry) => (
                    <Cell key={entry.name} fill={NIVEAU_COLORS[entry.name] || "#B08D57"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontFamily: "var(--font-display)", marginTop: 0 }}>Moyenne par classe</h3>
          {data.moyennesParClasse.length === 0 ? (
            <p className="loading">Aucune note enregistrée pour le moment.</p>
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
              <Pie
                data={data.repartitionMentions}
                dataKey="count"
                nameKey="mention"
                cx="50%"
                cy="50%"
                outerRadius={75}
                label
              >
                {data.repartitionMentions.map((entry, i) => (
                  <Cell key={entry.mention} fill={MENTION_COLORS[i % MENTION_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
