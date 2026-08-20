const BASE = "/api";

function getToken() {
  return localStorage.getItem("smp_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (res.status === 401) {
    localStorage.removeItem("smp_token");
    localStorage.removeItem("smp_user");
    window.location.reload();
    throw new Error("Session expirée");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Authentification
  authStatus: () => request("/auth/status"),
  bootstrap: (data) => request("/auth/bootstrap", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  getUsers: () => request("/auth/users"),
  createUser: (data) => request("/auth/users", { method: "POST", body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/auth/users/${id}`, { method: "DELETE" }),

  // Élèves
  getStudents: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/students${q ? `?${q}` : ""}`);
  },
  getStudent: (id) => request(`/students/${id}`),
  createStudent: (data) => request("/students", { method: "POST", body: JSON.stringify(data) }),
  updateStudent: (id, data) => request(`/students/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStudent: (id) => request(`/students/${id}`, { method: "DELETE" }),

  // Référence
  getNiveaux: () => request("/reference/niveaux"),
  getSeries: () => request("/reference/series"),

  // Matières (configurables)
  getMatieres: (params) => request(`/matieres?${new URLSearchParams(params)}`),
  createMatiere: (data) => request("/matieres", { method: "POST", body: JSON.stringify(data) }),
  deleteMatiere: (id) => request(`/matieres/${id}`, { method: "DELETE" }),

  // Notes
  getNotes: (idEleve) => request(`/notes?idEleve=${idEleve}`),
  createNote: (data) => request("/notes", { method: "POST", body: JSON.stringify(data) }),
  updateNote: (id, data) => request(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteNote: (id) => request(`/notes/${id}`, { method: "DELETE" }),

  // Présences
  getAttendance: (idEleve) => request(`/attendance?idEleve=${idEleve}`),
  createAttendance: (data) => request("/attendance", { method: "POST", body: JSON.stringify(data) }),
  deleteAttendance: (id) => request(`/attendance/${id}`, { method: "DELETE" }),
  getAttendanceStats: (idEleve) => request(`/attendance/stats/${idEleve}`),

  // Résultats
  getResults: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/results${q ? `?${q}` : ""}`);
  },

  // Dashboard
  getDashboard: () => request("/dashboard"),

  // Enseignants
  getTeachers: () => request("/teachers"),
  createTeacher: (data) => request("/teachers", { method: "POST", body: JSON.stringify(data) }),
  updateTeacher: (id, data) => request(`/teachers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTeacher: (id) => request(`/teachers/${id}`, { method: "DELETE" }),
  addAffectation: (teacherId, data) => request(`/teachers/${teacherId}/affectations`, { method: "POST", body: JSON.stringify(data) }),
  removeAffectation: (affId) => request(`/teachers/affectations/${affId}`, { method: "DELETE" }),
  linkUserToTeacher: (userId, IDEnseignant) => request(`/auth/users/${userId}`, { method: "PUT", body: JSON.stringify({ IDEnseignant }) }),

  // Emploi du temps
  getTimetable: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/timetable${q ? `?${q}` : ""}`);
  },
  createTimetableEntry: (data) => request("/timetable", { method: "POST", body: JSON.stringify(data) }),
  deleteTimetableEntry: (id) => request(`/timetable/${id}`, { method: "DELETE" }),

  // Examens
  getExams: () => request("/exams"),
  createExam: (data) => request("/exams", { method: "POST", body: JSON.stringify(data) }),
  updateExam: (id, data) => request(`/exams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteExam: (id) => request(`/exams/${id}`, { method: "DELETE" }),

  bulletinUrl: (idEleve) => `${BASE}/bulletin/${idEleve}?token=${encodeURIComponent(getToken() || "")}`,
  exportUrl: () => `${BASE}/export?token=${encodeURIComponent(getToken() || "")}`,
  getToken,

  // Paramètres établissement
  getSettings: () => request("/settings"),
  updateSettings: (data) => request("/settings", { method: "PUT", body: JSON.stringify(data) }),
  uploadLogo: async (file) => {
    const formData = new FormData();
    formData.append("logo", file);
    const token = getToken();
    const res = await fetch(`${BASE}/settings/logo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Erreur ${res.status}`);
    }
    return res.json();
  },
  logoUrl: () => `${BASE}/settings/logo?token=${encodeURIComponent(getToken() || "")}&t=${Date.now()}`,

  // Écoles (SuperAdmin uniquement)
  getEcoles: () => request("/ecoles"),
  createEcole: (data) => request("/ecoles", { method: "POST", body: JSON.stringify(data) }),
  updateEcole: (id, data) => request(`/ecoles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteEcole: (id) => request(`/ecoles/${id}`, { method: "DELETE" }),

  // Feuille de notes collective (saisie par classe entière)
  getFeuilleNotes: (params) => request(`/notes/feuille?${new URLSearchParams(params)}`),
  saveFeuilleNotes: (data) => request("/notes/feuille", { method: "POST", body: JSON.stringify(data) }),
};
