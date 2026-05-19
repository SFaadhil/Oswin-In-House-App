import { useState, useEffect } from "react";
import { UserPlus, Edit2, X, Shield, Lock, Eye, Pencil, Trash2, UserX } from "lucide-react";
import api, { formatApiError } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

const ROLES = ["Director", "Admin", "MD", "Manager", "User"];
const TOP_ROLES = ["Director", "Admin", "MD"];
const ROLE_COLORS = {
  Director: "text-purple-600 bg-purple-100 border border-purple-200 dark:text-purple-400 dark:bg-purple-900/20 dark:border-purple-800",
  Admin: "text-primary bg-primary/10 border border-primary/20",
  MD: "text-primary bg-primary/10 border border-primary/20",
  Manager: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20",
  User: "text-muted-foreground bg-muted",
};
const MODULES = [
  { key: "subscriptions", label: "Subscriptions" },
  { key: "reports", label: "Reports" },
  { key: "categories", label: "Categories" },
  { key: "users", label: "User Management" },
];
const ACCESS_OPTIONS = ["default", "edit", "view", "none"];
const SCOPE_OPTIONS = ["individual", "overall"];

const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all";

function PermissionEditor({ value, onChange }) {
  const setPerm = (moduleKey, field, val) => {
    const current = value?.[moduleKey];
    let entry = typeof current === "object" && current ? { ...current } : (typeof current === "string" ? { access: current, scope: "individual" } : {});
    if (field === "access") {
      if (val === "default") {
        const next = { ...(value || {}) };
        delete next[moduleKey];
        onChange(next);
        return;
      }
      entry.access = val;
      if (!entry.scope) entry.scope = "individual";
      if (val === "none") entry.scope = "individual";
    } else {
      entry.scope = val;
    }
    onChange({ ...(value || {}), [moduleKey]: entry });
  };

  const getEntry = (moduleKey) => {
    const v = value?.[moduleKey];
    if (!v) return { access: "default", scope: "individual" };
    if (typeof v === "string") return { access: v, scope: "individual" };
    return { access: v.access || "default", scope: v.scope || "individual" };
  };

  return (
    <div className="space-y-2" data-testid="module-permissions-editor">
      <p className="text-xs text-muted-foreground">Override role defaults per module. <b>Individual</b> = own records only · <b>Overall</b> = everyone's.</p>
      <div className="space-y-1.5">
        {MODULES.map(m => {
          const entry = getEntry(m.key);
          const showScope = entry.access !== "default" && entry.access !== "none";
          return (
            <div key={m.key} className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
              <span className="text-sm text-foreground flex-1 min-w-0 truncate">{m.label}</span>
              <select value={entry.access} onChange={e => setPerm(m.key, "access", e.target.value)}
                className="bg-card border border-border rounded-md px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                data-testid={`perm-access-${m.key}`}>
                {ACCESS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {showScope && (
                <select value={entry.scope} onChange={e => setPerm(m.key, "scope", e.target.value)}
                  className="bg-card border border-border rounded-md px-2 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                  data-testid={`perm-scope-${m.key}`}>
                  {SCOPE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreateUserModal({ managers, onClose, onSaved }) {
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "User", access_level: "editor", manager_id: "" });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const payload = { ...form, manager_id: form.manager_id || null };
      await api.post("/users/admin-create", payload);
      toast.success(`User ${form.email} created`);
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="create-user-modal">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-base font-semibold text-foreground">Create New User</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Full Name <span className="text-destructive">*</span></label>
            <input value={form.full_name} onChange={e => set("full_name", e.target.value)} className={inputCls} required data-testid="new-user-name" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email <span className="text-destructive">*</span></label>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} className={inputCls} required data-testid="new-user-email" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Temporary Password <span className="text-destructive">*</span></label>
            <input type="text" value={form.password} onChange={e => set("password", e.target.value)} className={inputCls} placeholder="Min 8 characters" required data-testid="new-user-password" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Role</label>
              <select value={form.role} onChange={e => set("role", e.target.value)} className={inputCls} data-testid="new-user-role">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Access Level</label>
              <select value={form.access_level} onChange={e => set("access_level", e.target.value)} className={inputCls} data-testid="new-user-access">
                <option value="editor">Editor (full)</option>
                <option value="viewer">Viewer (read-only)</option>
              </select>
            </div>
          </div>
          {form.role === "User" && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Assign to Manager</label>
              <select value={form.manager_id} onChange={e => set("manager_id", e.target.value)} className={inputCls} data-testid="new-user-manager">
                <option value="">No manager</option>
                {managers.map(m => <option key={m._id} value={m._id}>{m.full_name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted" data-testid="new-user-cancel">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50" data-testid="new-user-submit">
              {loading ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({ user: editUser, managers, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: editUser?.full_name || "",
    role: editUser?.role || "User",
    is_active: editUser?.is_active !== false,
    manager_id: editUser?.manager_id || "",
    access_level: editUser?.access_level || "editor",
    module_permissions: editUser?.module_permissions || {},
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const payload = {
        ...form,
        manager_id: form.manager_id || null,
        module_permissions: Object.keys(form.module_permissions || {}).length ? form.module_permissions : null,
      };
      await api.put(`/users/${editUser._id}`, payload);
      toast.success("User updated");
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="edit-user-modal">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-base font-semibold text-foreground">Edit User</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Email</p>
            <p className="text-sm text-foreground">{editUser?.email}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Full Name</label>
            <input value={form.full_name} onChange={e => set("full_name", e.target.value)} className={inputCls} data-testid="edit-user-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Role</label>
              <select value={form.role} onChange={e => set("role", e.target.value)} className={inputCls} data-testid="edit-user-role">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Access Level</label>
              <select value={form.access_level} onChange={e => set("access_level", e.target.value)} className={inputCls} data-testid="edit-user-access">
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          {form.role === "User" && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Manager</label>
              <select value={form.manager_id} onChange={e => set("manager_id", e.target.value)} className={inputCls} data-testid="edit-user-manager">
                <option value="">No manager</option>
                {managers.map(m => <option key={m._id} value={m._id}>{m.full_name}</option>)}
              </select>
            </div>
          )}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-primary" />
              <label className="text-sm font-semibold text-foreground">Module Permissions</label>
            </div>
            <PermissionEditor value={form.module_permissions} onChange={v => set("module_permissions", v)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="w-4 h-4 accent-primary" data-testid="edit-user-active" />
            <span className="text-sm text-foreground">Active</span>
          </label>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted" data-testid="edit-user-cancel">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50" data-testid="edit-user-submit">
              {loading ? "Saving..." : "Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // {user, hard}

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [usersRes, mgrRes] = await Promise.all([api.get("/users"), api.get("/users/managers")]);
      setUsers(usersRes.data);
      setManagers(mgrRes.data);
    } catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/${deleteTarget.user._id}${deleteTarget.hard ? "?hard=true" : ""}`);
      toast.success(deleteTarget.hard ? "User permanently deleted" : "User deactivated");
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const getManagerName = (mid) => managers.find(m => m._id === mid)?.full_name || "—";

  return (
    <div className="space-y-5" data-testid="users-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-light text-foreground" style={{ fontFamily: "Chivo" }}>User Management</h1>
          <p className="text-sm text-muted-foreground">{users.length} user{users.length !== 1 ? "s" : ""} · Manage access and permissions</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded-lg font-medium" data-testid="create-user-button">
          <UserPlus size={14} /> New User
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="users-table">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {["User", "Email", "Role", "Access", "Status", "Manager", "Permissions", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const mp = u.module_permissions || {};
                  const overrideCount = Object.values(mp).filter(v => {
                    if (!v || v === "default") return false;
                    if (typeof v === "string") return true;
                    return v.access && v.access !== "default";
                  }).length;
                  return (
                    <tr key={u._id} className={`border-b border-border hover:bg-muted/30 transition-colors ${!u.is_active ? "opacity-50" : ""}`} data-testid={`user-row-${i}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {u.full_name?.[0]?.toUpperCase()}
                          </div>
                          <span className="text-foreground font-medium">{u.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-md font-medium ${ROLE_COLORS[u.role] || ""}`}>{u.role === "MD" ? "Admin" : u.role}</span></td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 ${u.access_level === "viewer" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400" : "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"}`}>
                          {u.access_level === "viewer" ? <Eye size={10} /> : <Pencil size={10} />} {u.access_level || "editor"}
                        </span>
                      </td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-md ${u.is_active ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20" : "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20"}`}>{u.is_active ? "Active" : "Inactive"}</span></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{u.manager_id ? getManagerName(u.manager_id) : "—"}</td>
                      <td className="px-4 py-3">
                        {overrideCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-primary"><Shield size={11} /> {overrideCount} override{overrideCount > 1 ? "s" : ""}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {u._id !== currentUser?._id && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditUser(u)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg" data-testid={`edit-user-${i}`} title="Edit">
                              <Edit2 size={13} />
                            </button>
                            {u.is_active && (
                              <button onClick={() => setDeleteTarget({ user: u, hard: false })} className="p-1.5 text-muted-foreground hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg" data-testid={`deactivate-user-${i}`} title="Deactivate (soft)">
                                <UserX size={13} />
                              </button>
                            )}
                            <button onClick={() => setDeleteTarget({ user: u, hard: true })} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" data-testid={`delete-user-${i}`} title="Delete permanently">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {createOpen && <CreateUserModal managers={managers} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); fetchUsers(); }} />}
      {editUser && <EditUserModal user={editUser} managers={managers.filter(m => m._id !== editUser._id)} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); fetchUsers(); }} />}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="delete-user-confirm">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-xl">
            <p className="text-foreground font-semibold mb-2 flex items-center gap-2">
              {deleteTarget.hard ? <Trash2 size={16} className="text-destructive" /> : <UserX size={16} className="text-yellow-600 dark:text-yellow-400" />}
              {deleteTarget.hard ? "Permanently delete user?" : "Deactivate user?"}
            </p>
            <p className="text-sm text-muted-foreground mb-1">
              <b className="text-foreground">{deleteTarget.user.full_name}</b> ({deleteTarget.user.email})
            </p>
            {deleteTarget.hard ? (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive space-y-1">
                <p className="font-semibold">This cannot be undone:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>User record and login credentials will be removed</li>
                  <li>Their subscriptions will be archived</li>
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">User loses access but their data is preserved. You can reactivate them later.</p>
            )}
            <div className="flex gap-3 pt-4">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted" data-testid="delete-user-cancel">Cancel</button>
              <button onClick={handleDelete} className={`flex-1 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${deleteTarget.hard ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20"}`} data-testid="delete-user-confirm-btn">
                {deleteTarget.hard ? "Delete Permanently" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
