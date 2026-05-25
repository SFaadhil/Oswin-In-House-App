import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Subscriptions from "./pages/Subscriptions";
import Reports from "./pages/Reports";
import Categories from "./pages/Categories";
import Users from "./pages/Users";
import Profile from "./pages/Profile";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import Leaves from "./pages/Leaves";
import CalendarPage from "./pages/CalendarPage";
import Tasks from "./pages/Tasks";
import LeaveTypes from "./pages/LeaveTypes";
import "./App.css";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="reports" element={<ProtectedRoute roles={["Director", "Admin", "MD", "Manager", "User"]}><Reports /></ProtectedRoute>} />
          <Route path="categories" element={<ProtectedRoute roles={["Director", "Admin", "MD"]}><Categories /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute roles={["Director", "Admin", "MD"]}><Users /></ProtectedRoute>} />
          <Route path="leave-types" element={<ProtectedRoute roles={["Director", "Admin", "MD"]}><LeaveTypes /></ProtectedRoute>} />
          <Route path="employee" element={<EmployeeDashboard />} />
          <Route path="leaves" element={<Leaves />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
