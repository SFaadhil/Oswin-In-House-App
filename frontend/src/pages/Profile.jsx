import { useState } from "react";
import { Lock, Shield, Eye, Pencil, User, Phone, Cake, Heart, Home as HomeIcon } from "lucide-react";
import api, { formatApiError } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all";
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const ROLE_COLORS = {
  Director: "text-purple-600 bg-purple-100 border border-purple-200 dark:text-purple-400 dark:bg-purple-900/20 dark:border-purple-800",
  Admin: "text-primary bg-primary/10 border border-primary/20",
  MD: "text-primary bg-primary/10 border border-primary/20",
  Manager: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20",
  User: "text-muted-foreground bg-muted",
};
const ROLE_LABEL = { Director: "Director", Admin: "Admin", MD: "Admin" };

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [info, setInfo] = useState({
    full_name: user?.full_name || "",
    phone: user?.phone || "",
    date_of_birth: user?.date_of_birth ? user.date_of_birth.slice(0, 10) : "",
    blood_group: user?.blood_group || "",
    emergency_contact_name: user?.emergency_contact_name || "",
    emergency_contact_phone: user?.emergency_contact_phone || "",
    address: user?.address || "",
  });
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [infoLoading, setInfoLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const setField = (k, v) => setInfo(p => ({ ...p, [k]: v }));

  const handleInfoSave = async (e) => {
    e.preventDefault();
    if (!info.full_name.trim()) return;
    setInfoLoading(true);
    try {
      const res = await api.patch("/auth/profile", info);
      updateUser(res.data);
      toast.success("Profile updated");
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setInfoLoading(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) return toast.error("Passwords don't match");
    if (pwForm.new_password.length < 8) return toast.error("Password must be at least 8 characters");
    setPwLoading(true);
    try {
      await api.post("/auth/change-password", { current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwForm({ current_password: "", new_password: "", confirm_password: "" });
      toast.success("Password changed successfully");
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setPwLoading(false); }
  };

  const modulePerms = user?.module_permissions || {};
  const normalizedPerms = Object.entries(modulePerms)
    .map(([k, v]) => {
      if (!v || v === "default") return null;
      if (typeof v === "string") return [k, { access: v, scope: "individual" }];
      return [k, { access: v.access || "default", scope: v.scope || "individual" }];
    })
    .filter(Boolean);
  const hasOverrides = normalizedPerms.length > 0;

  return (
    <div className="space-y-6 max-w-3xl" data-testid="profile-page">
      <div>
        <h1 className="text-2xl font-light text-foreground" style={{ fontFamily: "Chivo" }}>Profile</h1>
        <p className="text-sm text-muted-foreground">Personal details, emergency contact & security</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-xl font-bold text-primary" style={{ fontFamily: "Chivo" }}>{user?.full_name?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">{user?.full_name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${ROLE_COLORS[user?.role] || ""}`}>{ROLE_LABEL[user?.role] || user?.role}</span>
              <span className={`text-xs px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 ${user?.access_level === "viewer" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400" : "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"}`}>
                {user?.access_level === "viewer" ? <Eye size={10} /> : <Pencil size={10} />} {user?.access_level || "editor"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleInfoSave} className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User size={16} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">Personal Information</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Full Name</label>
            <input value={info.full_name} onChange={e => setField("full_name", e.target.value)} className={inputCls} required data-testid="profile-name-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email</label>
            <input value={user?.email || ""} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} data-testid="profile-email-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><Phone size={11} /> Phone Number</label>
            <input value={info.phone} onChange={e => setField("phone", e.target.value)} className={inputCls} placeholder="+91 98765 43210" data-testid="profile-phone-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><Cake size={11} /> Date of Birth</label>
            <input type="date" value={info.date_of_birth} onChange={e => setField("date_of_birth", e.target.value)} className={inputCls} data-testid="profile-dob-input" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><Heart size={11} /> Blood Group</label>
            <select value={info.blood_group} onChange={e => setField("blood_group", e.target.value)} className={inputCls} data-testid="profile-bloodgroup-input">
              <option value="">Select...</option>
              {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><HomeIcon size={11} /> Home Address</label>
            <input value={info.address} onChange={e => setField("address", e.target.value)} className={inputCls} placeholder="Street, City, Postal code" data-testid="profile-address-input" />
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Emergency Contact</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Contact Name</label>
              <input value={info.emergency_contact_name} onChange={e => setField("emergency_contact_name", e.target.value)} className={inputCls} placeholder="Parent / Spouse / Sibling name" data-testid="profile-emerName-input" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Contact Phone</label>
              <input value={info.emergency_contact_phone} onChange={e => setField("emergency_contact_phone", e.target.value)} className={inputCls} placeholder="+91 98765 43210" data-testid="profile-emerPhone-input" />
            </div>
          </div>
        </div>
        <button type="submit" disabled={infoLoading} className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors disabled:opacity-50" data-testid="save-profile-button">
          {infoLoading ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {hasOverrides && (
        <div className="bg-card border border-border rounded-xl p-6" data-testid="profile-permissions">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground">Your Module Access</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {normalizedPerms.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
                <span className="text-sm text-foreground capitalize">{k}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${v.access === "edit" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" : v.access === "view" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400" : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>{v.access}</span>
                  {v.access !== "none" && <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-muted text-muted-foreground">{v.scope}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock size={16} className="text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Change Password</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Current Password</label>
            <input type="password" value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} className={inputCls} required placeholder="••••••••" data-testid="current-password-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">New Password</label>
            <input type="password" value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} className={inputCls} required placeholder="Min. 8 characters" data-testid="new-password-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Confirm New Password</label>
            <input type="password" value={pwForm.confirm_password} onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))} className={inputCls} required placeholder="Repeat new password" data-testid="confirm-password-input" />
          </div>
          <button type="submit" disabled={pwLoading} className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors disabled:opacity-50" data-testid="change-password-button">
            {pwLoading ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
