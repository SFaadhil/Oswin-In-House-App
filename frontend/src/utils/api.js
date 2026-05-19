import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
});

// Attach token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem("subtrack_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 - clear token and redirect to login
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      if (!err.config.url?.includes("/auth/")) {
        localStorage.removeItem("subtrack_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export const formatApiError = (err) => {
  const detail = err.response?.data?.detail;
  if (!detail) return err.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e.msg || JSON.stringify(e)).join(", ");
  return String(detail);
};

export const formatCurrency = (amount, currency = "INR") => {
  if (currency === "INR") return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (currency === "USD") return `$${Number(amount).toFixed(2)}`;
  if (currency === "EUR") return `€${Number(amount).toFixed(2)}`;
  if (currency === "GBP") return `£${Number(amount).toFixed(2)}`;
  return `${Number(amount).toFixed(2)} ${currency}`;
};

export const getDueStatus = (dueDateStr) => {
  if (!dueDateStr) return { label: "—", variant: "muted", days: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr.slice(0, 10));
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return { label: `Overdue`, variant: "danger", days };
  if (days === 0) return { label: "Due Today", variant: "danger", days };
  if (days <= 3) return { label: `${days}d`, variant: "urgent", days };
  if (days <= 7) return { label: `${days}d`, variant: "warning", days };
  return { label: due.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }), variant: "success", days };
};

export default api;
