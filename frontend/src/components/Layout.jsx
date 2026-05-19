import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, CreditCard, BarChart2, Tag, Users, User, LogOut, Menu, X, Sun, Moon, Briefcase, Calendar as CalIcon, CalendarCheck, ListChecks } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { toast } from "sonner";
import NotificationBell from "./NotificationBell";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_brave-snyder-5/artifacts/s24znd7d_image.png";

const TOP_ROLES = ["Director", "Admin", "MD"];
const ROLE_LABEL = { Director: "Director", Admin: "Admin", MD: "Admin" };

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["Director", "Admin", "MD", "Manager", "User"], module: null },
  { path: "/employee", icon: Briefcase, label: "Employee Portal", roles: ["Director", "Admin", "MD", "Manager", "User"], module: null },
  { path: "/leaves", icon: CalendarCheck, label: "Leaves", roles: ["Director", "Admin", "MD", "Manager", "User"], module: null },
  { path: "/calendar", icon: CalIcon, label: "Team Calendar", roles: ["Director", "Admin", "MD", "Manager", "User"], module: null },
  { path: "/tasks", icon: ListChecks, label: "Tasks", roles: ["Director", "Admin", "MD", "Manager", "User"], module: null },
  { path: "/subscriptions", icon: CreditCard, label: "Subscriptions", roles: ["Director", "Admin", "MD", "Manager", "User"], module: "subscriptions" },
  { path: "/reports", icon: BarChart2, label: "Reports", roles: ["Director", "Admin", "MD", "Manager", "User"], module: "reports" },
  { path: "/categories", icon: Tag, label: "Categories", roles: ["Director", "Admin", "MD"], module: "categories" },
  { path: "/users", icon: Users, label: "User Management", roles: ["Director", "Admin", "MD"], module: "users" },
];

const ROLE_BADGE = {
  Director: "bg-purple-500/30 text-white",
  Admin: "bg-white/20 text-white",
  MD: "bg-white/20 text-white",
  Manager: "bg-white/20 text-white",
  User: "bg-white/20 text-white",
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const modulePerms = user?.module_permissions || {};
  const getAccess = (m) => {
    const v = modulePerms[m];
    if (!v) return null;
    if (typeof v === "string") return v;
    return v.access;
  };
  const allowedNav = navItems.filter(n => {
    if (!n.roles.includes(user?.role)) return false;
    if (n.module) {
      const access = getAccess(n.module);
      if (access === "none") return false;
      // For non-top-role users on admin-only modules (categories/users): require explicit access override
      if (!TOP_ROLES.includes(user?.role) && ["categories", "users"].includes(n.module)) {
        if (!access || access === "none") return false;
      }
    }
    return true;
  });

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-60 sidebar-bg flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Logo */}
        <div className="px-5 py-4 sidebar-border border-b">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg p-1 shadow-md flex-shrink-0">
              <img src={LOGO_URL} alt="Oswin Ply" className="h-9 w-9 object-contain" onError={e => { e.target.style.display = 'none'; }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold sidebar-text truncate" style={{ fontFamily: "Chivo" }}>Oswin Ply</p>
              <p className="text-xs sidebar-muted truncate">Resource Tracker</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {allowedNav.map(({ path, icon: Icon, label }) => (
            <NavLink key={path} to={path} data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 font-medium ${isActive ? "sidebar-active" : "sidebar-text sidebar-hover opacity-75 hover:opacity-100"}`}
              onClick={() => setSidebarOpen(false)}>
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom: Profile + Logout */}
        <div className="sidebar-border border-t p-3 space-y-0.5">
          <NavLink to="/profile" data-testid="nav-profile"
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all sidebar-text ${isActive ? "sidebar-active" : "sidebar-hover opacity-75 hover:opacity-100"}`}
            onClick={() => setSidebarOpen(false)}>
            <User size={16} /><span>Profile</span>
          </NavLink>
          <button onClick={handleLogout} data-testid="logout-button"
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-sm sidebar-text sidebar-hover opacity-75 hover:opacity-100 transition-all">
            <LogOut size={16} /><span>Logout</span>
          </button>
          <div className="px-3 pt-2 pb-1">
            <p className="text-xs sidebar-text font-semibold truncate">{user?.full_name}</p>
            <p className="text-xs sidebar-muted truncate">{user?.email}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_BADGE[user?.role] || "bg-white/20 text-white"}`}>{ROLE_LABEL[user?.role] || user?.role}</span>
              {user?.access_level === "viewer" && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-400/20 text-yellow-200">View Only</span>}
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground" data-testid="mobile-menu-button">
            <Menu size={20} />
          </button>
          <div className="hidden lg:block">
            <p className="text-xs text-muted-foreground">Welcome back,</p>
            <p className="text-sm font-semibold text-foreground">{user?.full_name}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <button onClick={toggleTheme} className="p-2 rounded-lg bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" data-testid="theme-toggle" title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
