import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("smp_user");
    return raw ? JSON.parse(raw) : null;
  });

  function login(token, u) {
    localStorage.setItem("smp_token", token);
    localStorage.setItem("smp_user", JSON.stringify(u));
    setUser(u);
  }

  function logout() {
    localStorage.removeItem("smp_token");
    localStorage.removeItem("smp_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
