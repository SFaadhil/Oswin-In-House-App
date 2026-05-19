import { useState, useEffect, useCallback } from "react";
import { Plus, Calendar as CalIcon, Check, X, Trash2, AlertCircle, Search, Filter, User as UserIcon } from "lucide-react";
import api, { formatApiError } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import LeaveModal from "../components/LeaveModal";

const STATUS_BADGE = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

const SUPERVISOR_ROLES = ["Director", "Admin", "MD", "Manager"];

function FilterRow({ filters, setFilters, types, showStatusFilter = true }) {
  const set = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  return (
    <div className="flex flex-wrap gap-2 p-3 border-b border-border bg-muted/20" data-testid="leave-filters">
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 flex-1 min-w-[180px]">
        <Search size={13} className="text-muted-foreground" />
        <input value={filters.search} onChange={e => set("search", e.target.value)} placeholder="Search name or reason..." className="bg-transparent text-sm text-foreground outline-none w-full" data-testid="leave-filter-search" />
      </div>
      <select value={filters.type} onChange={e => set("type", e.target.value)} className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none" data-testid="leave-filter-type">
        <option value="">All types</option>
        {types.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
      </select>
      {showStatusFilter && (
        <select value={filters.status} onChange={e => set("status", e.target.value)} className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none" data-testid="leave-filter-status">
          <option value="">All status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      )}
      <input type="date" value={filters.from} onChange={e => set("from", e.target.value)} className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none" title="From date" data-testid="leave-filter-from" />
      <input type="date" value={filters.to} onChange={e => set("to", e.target.value)} className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none" title="To date" data-testid="leave-filter-to" />
      {(filters.search || filters.type || filters.status || filters.from || filters.to) && (
        <button onClick={() => setFilters({ search: "", type: "", status: "", from: "", to: "" })} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground" data-testid="leave-filter-clear">Clear</button>
      )}
    </div>
  );
}

function ByEmployeeView({ types }) {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [balance, setBalance] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/users").then(res => setUsers(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedUserId) { setBalance(null); setLeaves([]); return; }
    setLoading(true);
    Promise.all([
      api.get(`/users/${selectedUserId}/leave-balance`),
      api.get(`/leaves?scope=user&user_id=${selectedUserId}`),
    ]).then(([b, l]) => { setBalance(b.data); setLeaves(l.data); })
      .catch(err => toast.error(formatApiError(err)))
      .finally(() => setLoading(false));
  }, [selectedUserId]);

  const selectedUser = users.find(u => u._id === selectedUserId);

  return (
    <div className="p-4 space-y-4" data-testid="by-employee-view">
      <div className="flex items-center gap-2 max-w-md">
        <UserIcon size={16} className="text-muted-foreground" />
        <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" data-testid="employee-select">
          <option value="">Select an employee to view their leave breakdown...</option>
          {users.map(u => <option key={u._id} value={u._id}>{u.full_name} · {u.role} {u.email ? `(${u.email})` : ""}</option>)}
        </select>
      </div>

      {loading && <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}

      {!loading && balance && (
        <>
          <div className="bg-background border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">{selectedUser?.full_name?.[0]?.toUpperCase()}</div>
              <div>
                <p className="text-base font-semibold text-foreground">{selectedUser?.full_name}</p>
                <p className="text-xs text-muted-foreground">{selectedUser?.email} · {selectedUser?.role} · Balance for {balance.year}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {balance.types.map(t => {
                const pct = t.quota > 0 ? Math.min(100, (t.used / t.quota) * 100) : 0;
                return (
                  <div key={t.id} className="bg-card border border-border rounded-lg p-3" data-testid={`emp-balance-${t.name.toLowerCase().replace(/\s+/g,'-')}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                      <p className="text-xs font-semibold text-foreground truncate">{t.name}</p>
                    </div>
                    <p className="text-xl font-bold text-foreground" style={{ fontFamily: "Chivo" }}>{t.remaining}<span className="text-xs text-muted-foreground font-normal"> / {t.quota}</span></p>
                    <p className="text-xs text-muted-foreground">{t.used} used</p>
                    <div className="h-1 bg-muted rounded-full mt-2 overflow-hidden">
                      <div className="h-full" style={{ width: `${pct}%`, background: t.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-background border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Leave History · {leaves.length} records</p>
            </div>
            {leaves.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No leaves yet</p>
            ) : (
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="border-b border-border">
                      {["Type","Period","Days","Status","Reason","Supervisor"].map(h => <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map(l => (
                      <tr key={l._id} className="border-b border-border">
                        <td className="px-4 py-2.5"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: l.leave_type?.color }} /><span className="text-foreground text-xs">{l.leave_type?.name}</span></div></td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.start_date} → {l.end_date}{l.half_day && " (½)"}</td>
                        <td className="px-4 py-2.5 font-semibold text-foreground text-xs">{l.total_days}</td>
                        <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_BADGE[l.status]}`}>{l.status}</span></td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate" title={l.reason}>{l.reason}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.supervisor?.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!loading && !balance && (
        <div className="text-center py-14 text-muted-foreground">
          <UserIcon size={28} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Pick an employee from the dropdown to see their full leave breakdown</p>
        </div>
      )}
    </div>
  );
}

export default function Leaves() {
  const { user } = useAuth();
  const isSupervisor = SUPERVISOR_ROLES.includes(user?.role);
  const [scope, setScope] = useState(isSupervisor ? "pending" : "mine");
  const [leaves, setLeaves] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [filters, setFilters] = useState({ search: "", type: "", status: "", from: "", to: "" });

  const fetchLeaves = useCallback(async () => {
    if (scope === "employee") { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get(`/leaves?scope=${scope}`);
      setLeaves(res.data);
    } catch { toast.error("Failed to load leaves"); }
    finally { setLoading(false); }
  }, [scope]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);
  useEffect(() => {
    api.get("/leave-types").then(res => setTypes(res.data)).catch(() => {});
    api.get("/leaves/balance").then(res => setBalance(res.data)).catch(() => {});
  }, []);

  const handleApprove = async (id) => {
    try { await api.put(`/leaves/${id}/approve`); toast.success("Leave approved"); fetchLeaves(); }
    catch (err) { toast.error(formatApiError(err)); }
  };
  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await api.put(`/leaves/${rejectTarget}/reject`, { rejection_reason: rejectReason.trim() });
      toast.success("Leave rejected");
      setRejectTarget(null); setRejectReason(""); fetchLeaves();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  const handleCancel = async (id) => {
    try { await api.delete(`/leaves/${id}`); toast.success("Leave cancelled"); fetchLeaves(); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  // Apply filters client-side
  const filteredLeaves = leaves.filter(l => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!(l.user?.name?.toLowerCase().includes(s) || l.reason?.toLowerCase().includes(s) || l.supervisor?.name?.toLowerCase().includes(s))) return false;
    }
    if (filters.type && l.leave_type?.id !== filters.type) return false;
    if (filters.status && l.status !== filters.status) return false;
    if (filters.from && l.start_date < filters.from) return false;
    if (filters.to && l.end_date > filters.to) return false;
    return true;
  });

  const tabs = [
    { id: "mine", label: "My Leaves" },
    ...(isSupervisor ? [{ id: "pending", label: "Pending Approvals" }] : []),
    ...(isSupervisor ? [{ id: "all", label: "All Leaves" }] : []),
    ...(isSupervisor ? [{ id: "employee", label: "By Employee" }] : []),
  ];

  return (
    <div className="space-y-5" data-testid="leaves-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-light text-foreground" style={{ fontFamily: "Chivo" }}>Leaves</h1>
          <p className="text-sm text-muted-foreground">Apply for leave and manage approvals</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded-lg font-medium" data-testid="apply-leave-button">
          <Plus size={14} /> Apply for Leave
        </button>
      </div>

      {balance && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {balance.types.map(t => (
            <div key={t.id} className="bg-card border border-border rounded-xl p-4" data-testid={`balance-${t.name.toLowerCase().replace(/\s+/g,'-')}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.name}</p>
              </div>
              <p className="text-xl font-bold text-foreground" style={{ fontFamily: "Chivo" }}>{t.remaining}<span className="text-sm text-muted-foreground font-normal"> / {t.quota}</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">remaining · {t.used} used</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setScope(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${scope === tab.id ? "text-primary border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"}`}
              data-testid={`leave-tab-${tab.id}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {scope === "employee" ? (
          <ByEmployeeView types={types} />
        ) : (
          <>
            <FilterRow filters={filters} setFilters={setFilters} types={types} showStatusFilter={scope !== "pending"} />

            {loading ? (
              <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : filteredLeaves.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <CalIcon size={28} className="mx-auto mb-3 text-muted-foreground/60" />
                <p className="text-sm">{leaves.length === 0 ? "No leaves found" : "No leaves match your filters"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="leaves-table">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {[scope === "mine" ? null : "Employee", "Type", "Period", "Days", "Status", "Reason", "Supervisor", ""].filter(Boolean).map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaves.map((l, i) => (
                      <tr key={l._id} className="border-b border-border hover:bg-muted/30" data-testid={`leave-row-${i}`}>
                        {scope !== "mine" && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">{l.user?.name?.[0]?.toUpperCase()}</div>
                              <span className="text-foreground font-medium">{l.user?.name}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: l.leave_type?.color }} />
                            <span className="text-foreground">{l.leave_type?.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{l.start_date} → {l.end_date}{l.half_day && " (½)"}</td>
                        <td className="px-4 py-3 font-semibold text-foreground">{l.total_days}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STATUS_BADGE[l.status]}`}>{l.status}</span></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px] truncate" title={l.reason}>{l.reason}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{l.supervisor?.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {l.status === "pending" && isSupervisor && (
                              <>
                                <button onClick={() => handleApprove(l._id)} className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-500/10 rounded-lg" title="Approve" data-testid={`approve-leave-${i}`}><Check size={13} /></button>
                                <button onClick={() => setRejectTarget(l._id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg" title="Reject" data-testid={`reject-leave-${i}`}><X size={13} /></button>
                              </>
                            )}
                            {l.status === "pending" && l.user?.id === user?._id && (
                              <button onClick={() => handleCancel(l._id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" title="Cancel" data-testid={`cancel-leave-${i}`}><Trash2 size={13} /></button>
                            )}
                            {l.status === "rejected" && l.rejection_reason && (
                              <span title={l.rejection_reason} className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} /></span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && <LeaveModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); fetchLeaves(); api.get("/leaves/balance").then(r => setBalance(r.data)); }} />}

      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-xl" data-testid="reject-modal">
            <p className="text-foreground font-semibold mb-2">Reject this leave?</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason (optional)" rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none mt-2"
              data-testid="reject-reason-input" />
            <div className="flex gap-3 pt-3">
              <button onClick={() => { setRejectTarget(null); setRejectReason(""); }} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted" data-testid="reject-cancel">Cancel</button>
              <button onClick={handleReject} className="flex-1 px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive font-medium hover:bg-destructive/20" data-testid="reject-confirm">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
