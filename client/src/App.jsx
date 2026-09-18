import { useEffect, useState } from "react";
import { tailleFileAttente, surChangementFile, synchroniser } from "./lib/offline";
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
import EspaceEleve from "./pages/EspaceEleve.jsx";
import Ecolage from "./pages/Ecolage.jsx";
import Parents from "./pages/Parents.jsx";
import Messagerie from "./pages/Messagerie.jsx";
import EspaceParent from "./pages/EspaceParent.jsx";
import MonEmploiDuTemps from "./pages/MonEmploiDuTemps.jsx";
import Login from "./pages/Login.jsx";
import { useAuth } from "./AuthContext";
import { api } from "./api";

// Bandeau d'état : prévient quand on travaille hors connexion et combien de saisies
// restent à synchroniser.
function BandeauHorsLigne() {
  const [horsLigne, setHorsLigne] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  const [enAttente, setEnAttente] = useState(tailleFileAttente());

  useEffect(() => {
    const on = () => setHorsLigne(false);
    const off = () => setHorsLigne(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const desabo = surChangementFile(setEnAttente);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); desabo(); };
  }, []);

  if (!horsLigne && enAttente === 0) return null;

  return (
    <div style={{
      background: horsLigne ? "#8C3A3A" : "#B08D57", color: "#fff",
      padding: "7px 16px", fontSize: "0.82rem", display: "flex",
      justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
    }}>
      <span>
        {horsLigne
          ? "Hors connexion — vos saisies de notes et présences sont enregistrées sur l'appareil."
          : "Connexion rétablie."}
        {enAttente > 0 && ` ${enAttente} saisie(s) en attente de synchronisation.`}
      </span>
      {!horsLigne && enAttente > 0 && (
        <button
          onClick={async () => { await synchroniser(); setEnAttente(tailleFileAttente()); }}
          style={{ background: "rgba(255,255,255,.2)", color: "#fff", border: "none", borderRadius: 4, padding: "3px 10px", fontSize: "0.78rem", cursor: "pointer" }}
        >
          Synchroniser maintenant
        </button>
      )}
    </div>
  );
}

function Shell({ links, brandName, brandEyebrow, children }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-eyebrow">{brandEyebrow}</div>
        <div className="brand">{brandName}</div>
        <nav style={{ marginTop: 18, flex: 1 }}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
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
          <button className="nav-link" style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", fontSize: "0.82rem", padding: "6px 12px" }} onClick={logout}>
            ↩ Déconnexion
          </button>
        </div>
      </aside>
      <main className="main" style={{ padding: 0 }}>
        <BandeauHorsLigne />
        <div style={{ padding: "36px 44px" }}>{children}</div>
      </main>
    </div>
  );
}

function SuperAdminApp() {
  return (
    <Shell brandEyebrow="Plateforme" brandName="SchoolManager Pro" links={[{ to: "/", label: "Écoles", end: true }]}>
      <Routes><Route path="*" element={<Ecoles />} /></Routes>
    </Shell>
  );
}

function EcoleApp() {
  const { user } = useAuth();
  const [ecoleName, setEcoleName] = useState(null);

  useEffect(() => { api.getSettings().then((s) => setEcoleName(s.Nom)).catch(() => setEcoleName("SchoolManager Pro")); }, []);

  // Le caissier n'a accès qu'à la caisse et à la messagerie
  if (user.role === "Caissier") {
    return (
      <Shell brandEyebrow="Caisse" brandName={ecoleName || "…"}
        links={[{ to: "/", label: "Écolage / Caisse", end: true }, { to: "/messagerie", label: "Messagerie" }]}>
        <Routes>
          <Route path="/messagerie" element={<Messagerie />} />
          <Route path="*" element={<Ecolage />} />
        </Routes>
      </Shell>
    );
  }

  const links = [{ to: "/", label: "Tableau de bord", end: true }, { to: "/eleves", label: "Élèves" }];
  if (user.role === "Enseignant") {
    links.push({ to: "/notes-rapides", label: "Feuille de notes" });
    links.push({ to: "/mon-emploi-du-temps", label: "Mon emploi du temps" });
  }
  links.push(
    { to: "/resultats", label: "Résultats & classement" },
    { to: "/enseignants", label: "Enseignants" },
    { to: "/emploi-du-temps", label: "Emploi du temps" },
    { to: "/examens", label: "Examens" },
    { to: "/matieres", label: "Matières" },
  );
  if (user.role === "Administrateur") links.push({ to: "/ecolage", label: "Écolage / Caisse" });
  links.push({ to: "/messagerie", label: "Messagerie" });
  if (user.role === "Administrateur") {
    links.push({ to: "/parents", label: "Comptes parents" });
    links.push({ to: "/utilisateurs", label: "Comptes utilisateurs" });
    links.push({ to: "/parametres", label: "Paramètres établissement" });
  }

  return (
    <Shell brandEyebrow="Établissement" brandName={ecoleName || "…"} links={links}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/eleves" element={<Students />} />
        <Route path="/eleves/:id" element={<StudentDetail />} />
        {user.role === "Enseignant" && <Route path="/notes-rapides" element={<FeuilleNotes />} />}
        {user.role === "Enseignant" && <Route path="/mon-emploi-du-temps" element={<MonEmploiDuTemps />} />}
        <Route path="/messagerie" element={<Messagerie />} />
        <Route path="/ecolage" element={user.role === "Administrateur" ? <Ecolage /> : <Navigate to="/" />} />
        <Route path="/parents" element={user.role === "Administrateur" ? <Parents /> : <Navigate to="/" />} />
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

function EleveApp() {
  return (
    <Shell brandEyebrow="Espace élève" brandName="SchoolManager Pro"
      links={[{ to: "/", label: "Mon espace", end: true }, { to: "/messagerie", label: "Messagerie" }]}>
      <Routes>
        <Route path="/messagerie" element={<Messagerie />} />
        <Route path="*" element={<EspaceEleve />} />
      </Routes>
    </Shell>
  );
}

function ParentApp() {
  return (
    <Shell brandEyebrow="Espace parent" brandName="SchoolManager Pro"
      links={[{ to: "/", label: "Mes enfants", end: true }, { to: "/messagerie", label: "Messagerie" }]}>
      <Routes>
        <Route path="/messagerie" element={<Messagerie />} />
        <Route path="*" element={<EspaceParent />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  const { user } = useAuth();

  if (!user) return <Login />;
  if (user.role === "SuperAdmin") return <SuperAdminApp />;
  if (user.role === "Eleve") return <EleveApp />;
  if (user.role === "Parent") return <ParentApp />;
  return <EcoleApp />;
}
