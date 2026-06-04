import axios from "axios";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "oswin_token";
const REFRESH_TOKEN_KEY = "oswin_refresh_token";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api`
  : "http://localhost:8000/api";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
          const newToken = res.data.access_token;
          await SecureStore.setItemAsync(TOKEN_KEY, newToken);
          if (res.data.refresh_token) {
            await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, res.data.refresh_token);
          }
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    }
    return Promise.reject(err);
  }
);

export const saveToken = (token: string) =>
  SecureStore.setItemAsync(TOKEN_KEY, token);

export const saveRefreshToken = (token: string) =>
  SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);

export const clearToken = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
};

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);

export const formatApiError = (err: any): string => {
  const detail = err.response?.data?.detail;
  if (!detail) return err.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
  return String(detail);
};

export const formatCurrency = (amount: number, currency = "INR"): string => {
  if (currency === "INR") return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (currency === "USD") return `$${Number(amount).toFixed(2)}`;
  if (currency === "EUR") return `€${Number(amount).toFixed(2)}`;
  if (currency === "GBP") return `£${Number(amount).toFixed(2)}`;
  return `${Number(amount).toFixed(2)} ${currency}`;
};

export const getDueStatus = (dueDateStr?: string) => {
  if (!dueDateStr) return { label: "—", color: "#9ca3af", days: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr.slice(0, 10));
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: "Overdue", color: "#ef4444", days };
  if (days === 0) return { label: "Due Today", color: "#ef4444", days };
  if (days <= 3) return { label: `${days}d`, color: "#f97316", days };
  if (days <= 7) return { label: `${days}d`, color: "#eab308", days };
  return { label: due.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }), color: "#22c55e", days };
};
