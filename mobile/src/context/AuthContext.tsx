import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, saveToken, saveRefreshToken, clearToken, getToken } from "../api/client";

interface User {
  id: string;
  _id?: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  access_level?: string;
  module_permissions?: Record<string, any>;
  phone?: string;
  date_of_birth?: string;
  blood_group?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  manager_id?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      try {
        const res = await api.get("/auth/me");
        setUser(res.data);
      } catch {
        await clearToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.post("/auth/login", { email, password });
    const { access_token, refresh_token, ...userData } = res.data;
    if (access_token) await saveToken(access_token);
    if (refresh_token) await saveRefreshToken(refresh_token);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    await clearToken();
    setUser(null);
  };

  const updateUser = (data: Partial<User>) =>
    setUser((prev) => (prev ? { ...prev, ...data } : prev));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
