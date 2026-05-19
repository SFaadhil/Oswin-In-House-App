import { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("subtrack_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api.get("/auth/me")
      .then(res => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("subtrack_token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { access_token, ...userData } = res.data;
    if (access_token) localStorage.setItem("subtrack_token", access_token);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    localStorage.removeItem("subtrack_token");
    setUser(null);
  };

  const updateUser = (data) => setUser(prev => ({ ...prev, ...data }));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
