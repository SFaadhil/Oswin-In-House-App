import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, Users, ChevronRight, Plus, User, Phone, Cake, Heart, AlertCircle } from "lucide-react";
import api from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

const STATUS_BADGE = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/employee/dashboard"), api.get("/leaves/balance")])
      .then(([d, b]) => { setData(d.data); setBalance(b.data); })
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6" data-testid="employee-dashboard-page">
      <div>
        <h1 className="text-2xl font-light text-foreground" style={{ fontFamily: "Chivo" }}>Employee Portal</h1>
        <p className="text-sm text-muted-foreground">Hi {user?.full_name?.split(" ")[0]} — manage your leaves and time off here</p>
      </div>

      {/* Quick stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/leaves" className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow group" data-testid="stat-pending-approvals">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending Approvals</p>
            <Clock size={16} className="text-yellow-600 dark:text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "Chivo" }}>{data?.pending_approvals || 0}</p>
          <p className="text-xs text-primary group-hover:translate-x-0.5 transition-transform mt-1 flex items-center gap-1">Review <ChevronRight size={11} /></p>
        </Link>
        <Link to="/leaves" className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow group" data-testid="stat-my-leaves">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My Leaves</p>
            <Calendar size={16} className="text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "Chivo" }}>{data?.my_recent_leaves?.length || 0}</p>
          <p className="text-xs text-primary mt-1 flex items-center gap-1">View all <ChevronRight size={11} /></p>
        </Link>
        <Link to="/calendar" className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow group" data-testid="stat-team-today">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Out Today</p>
            <Users size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "Chivo" }}>{data?.team_on_leave_today?.length || 0}</p>
          <p className="text-xs text-primary mt-1 flex items-center gap-1">See calendar <ChevronRight size={11} /></p>
        </Link>
        <Link to="/leaves" className="bg-primary/10 border border-primary/20 rounded-xl p-5 hover:bg-primary/15 transition-colors flex flex-col justify-between" data-testid="stat-apply-leave">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Apply Now</p>
            <Plus size={16} className="text-primary" />
          </div>
          <p className="text-base font-semibold text-foreground">Apply for Leave</p>
          <p className="text-xs text-muted-foreground mt-0.5">Submit a request</p>
        </Link>
      </div>

      {/* Balances */}
      {balance && (
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">My Leave Balance · {balance.year}</p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {balance.types.map(t => {
              const pct = t.quota > 0 ? Math.min(100, (t.used / t.quota) * 100) : 0;
              return (
                <div key={t.id} className="bg-background border border-border rounded-lg p-3" data-testid={`balance-${t.name.toLowerCase().replace(/\s+/g,'-')}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                    <p className="text-xs font-semibold text-foreground truncate">{t.name}</p>
                  </div>
                  <p className="text-lg font-bold text-foreground" style={{ fontFamily: "Chivo" }}>{t.remaining}<span className="text-xs text-muted-foreground font-normal"> / {t.quota}</span></p>
                  <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, background: t.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Personal info summary */}
        <div className="bg-card border border-border rounded-xl p-5" data-testid="personal-info-card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My Information</p>
            <Link to="/profile" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">Edit <ChevronRight size={11} /></Link>
          </div>
          {(!user?.phone && !user?.date_of_birth && !user?.blood_group) ? (
            <div className="text-center py-4 border-2 border-dashed border-border rounded-lg">
              <AlertCircle size={18} className="mx-auto mb-2 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">Add your personal details</p>
              <Link to="/profile" className="text-xs text-primary hover:text-primary/80 mt-1 inline-block">Complete profile →</Link>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {user?.phone && <div className="flex items-center gap-2"><Phone size={12} className="text-muted-foreground" /><span className="text-foreground">{user.phone}</span></div>}
              {user?.date_of_birth && <div className="flex items-center gap-2"><Cake size={12} className="text-muted-foreground" /><span className="text-foreground">{new Date(user.date_of_birth).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}</span></div>}
              {user?.blood_group && <div className="flex items-center gap-2"><Heart size={12} className="text-muted-foreground" /><span className="text-foreground">Blood Group {user.blood_group}</span></div>}
              {user?.emergency_contact_name && (
                <div className="pt-2 mt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-0.5">Emergency Contact</p>
                  <p className="text-sm text-foreground">{user.emergency_contact_name} · {user.emergency_contact_phone || "—"}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent leaves */}
        <div className="bg-card border border-border rounded-xl p-5" data-testid="recent-leaves-list">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">My Recent Leaves</p>
          {(!data?.my_recent_leaves || data.my_recent_leaves.length === 0) ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No leaves yet</p>
          ) : (
            <div className="space-y-2">
              {data.my_recent_leaves.map(l => (
                <div key={l._id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: l.leave_type?.color }} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{l.leave_type?.name}</p>
                      <p className="text-xs text-muted-foreground">{l.start_date} → {l.end_date} · {l.total_days} day{l.total_days !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_BADGE[l.status]}`}>{l.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team on leave today */}
        <div className="bg-card border border-border rounded-xl p-5" data-testid="team-today-list">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Team Out Today</p>
          {(!data?.team_on_leave_today || data.team_on_leave_today.length === 0) ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Everyone's in! 🎉</p>
          ) : (
            <div className="space-y-2">
              {data.team_on_leave_today.map(l => (
                <div key={l._id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">{l.user?.name?.[0]?.toUpperCase()}</div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{l.user?.name}</p>
                      <p className="text-xs text-muted-foreground">{l.leave_type?.name} · until {l.end_date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
