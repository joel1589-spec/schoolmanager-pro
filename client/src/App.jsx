import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Students from "./pages/Students.jsx";
import StudentDetail from "./pages/StudentDetail.jsx";
import Results from "./pages/Results.jsx";
import Users from "./pages/Users.jsx";
import Teachers from "./pages/Teachers.jsx";
import Timetable from "./pages/Timetable.jsx";
import Exams from "./pages/Exams.jsx";
import Matieres from "./pages/Matieres.jsx";
import FeuilleNotes from "./pages/FeuilleNotes.jsx";
import Settings from "./pages/Settings.jsx";
import Ecoles from "./pages/Ecoles.jsx";
import Login from "./pages/Login.jsx";
import { useAuth } from "./AuthContext";
import { api } from "./api";

function Shell({ links, brandEyebrow, children }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-eyebrow">{brandEyebrow}</div>
        <div className="brand">SchoolManager Pro</div>
        <nav style={{ marginTop: 18, flex: 1 }}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid rgba(246,241,230,0.15)" }}>
          <div style={{ fontSize: "0.82rem", opacity: 0.85 }}>{user.nom}</div>
          <div className="mono" style={{ fontSize: "0.68rem", opacity: 0.6, marginBottom: 10 }}>{user.role}</div>
          {user.role === "Administrateur" && (
            <a href={api.exportUrl()} className="nav-link" style={{ display: "block", fontSize: "0.82rem", padding: "6px 12px" }}>
              ⭳ Exporter les données
            </a>
          )}
          <button
            className="nav-link"
            style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", fontSize: "0.82rem", padding: "6px 12px" }}
            onClick={logout}
          >
            ↩ Déconnexion
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

// Le SuperAdmin gère la plateforme (liste des écoles) — pas rattaché à un établissement,
// il n'a donc pas accès aux pages "métier" (élèves, notes, etc.) d'une école en particulier.
function SuperAdminApp() {
  return (
    <Shell brandEyebrow="Plateforme" links={[{ to: "/", label: "Écoles", end: true }]}>
      <Routes>
        <Route path="*" element={<Ecoles />} />
      </Routes>
    </Shell>
  );
}

function EcoleApp() {
  const { user } = useAuth();

  const links = [
    { to: "/", label: "Tableau de bord", end: true },
    { to: "/eleves", label: "Élèves" },
    { to: "/notes-rapides", label: "Feuille de notes" },
    { to: "/resultats", label: "Résultats & classement" },
    { to: "/enseignants", label: "Enseignants" },
    { to: "/emploi-du-temps", label: "Emploi du temps" },
    { to: "/examens", label: "Examens" },
    { to: "/matieres", label: "Matières" },
  ];
  if (user.role === "Administrateur") {
    links.push({ to: "/utilisateurs", label: "Comptes utilisateurs" });
    links.push({ to: "/parametres", label: "Paramètres établissement" });
  }

  return (
    <Shell brandEyebrow="Établissement" links={links}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/eleves" element={<Students />} />
        <Route path="/eleves/:id" element={<StudentDetail />} />
        <Route path="/notes-rapides" element={<FeuilleNotes />} />
        <Route path="/resultats" element={<Results />} />
        <Route path="/enseignants" element={<Teachers />} />
        <Route path="/emploi-du-temps" element={<Timetable />} />
        <Route path="/examens" element={<Exams />} />
        <Route path="/matieres" element={<Matieres />} />
        <Route path="/utilisateurs" element={user.role === "Administrateur" ? <Users /> : <Navigate to="/" />} />
        <Route path="/parametres" element={user.role === "Administrateur" ? <Settings /> : <Navigate to="/" />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  const { user } = useAuth();

  if (!user) return <Login />;
  if (user.role === "SuperAdmin") return <SuperAdminApp />;
  return <EcoleApp />;
}
