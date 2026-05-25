import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Edit2, Trash2, RotateCcw, ExternalLink, User } from "lucide-react";
import api, { formatCurrency, getDueStatus, formatApiError } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import SubscriptionModal from "../components/SubscriptionModal";

const STATUS_CLASSES = { Active: "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20", Inactive: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800/40", Trial: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20", Cancelled: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20" };
const DUE_CLASSES = { success: "text-green-600 dark:text-green-400", warning: "text-yellow-600 dark:text-yellow-400", urgent: "text-orange-600 dark:text-orange-400", danger: "text-red-600 dark:text-red-400", muted: "text-muted-foreground" };

export default function Subscriptions() {
  const { user } = useAuth();
  const [subs, setSubs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSub, setEditSub] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSubs, setArchivedSubs] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "", category_id: "", billing_cycle: "", responsible_person_id: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const subPerm = user?.module_permissions?.subscriptions;
  const subAccess = typeof subPerm === "string" ? subPerm : subPerm?.access;
  // Managers have view-only access to subscriptions by default unless explicitly overridden
  const managerViewOnly = user?.role === "Manager" && subAccess !== "edit";
  const isViewer = user?.access_level === "viewer" || subAccess === "view" || managerViewOnly;

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.billing_cycle) params.billing_cycle = filters.billing_cycle;
      if (filters.responsible_person_id) params.responsible_person_id = filters.responsible_person_id;
      const res = await api.get("/subscriptions", { params });
      setSubs(res.data);
    } catch { toast.error("Failed to load subscriptions"); }
    finally { setLoading(false); }
  }, [filters]);

  const fetchMeta = async () => {
    try {
      const [cRes, pRes] = await Promise.all([api.get("/categories"), api.get("/people")]);
      setCategories(cRes.data);
      setPeople(pRes.data);
    } catch {}
  };

  useEffect(() => { fetchSubs(); }, [fetchSubs]);
  useEffect(() => { fetchMeta(); }, []);

  const fetchArchived = async () => {
    try { const res = await api.get("/subscriptions/archived"); setArchivedSubs(res.data); } catch {}
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/subscriptions/${id}`);
      toast.success("Subscription deleted");
      setDeleteConfirm(null); fetchSubs();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const handleRestore = async (id) => {
    try {
      await api.put(`/subscriptions/${id}/restore`);
      toast.success("Subscription restored"); fetchArchived(); fetchSubs();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const selCls = "bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-5" data-testid="subscriptions-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-light text-foreground" style={{ fontFamily: "Chivo" }}>Subscriptions</h1>
          <p className="text-sm text-muted-foreground">{subs.length} subscription{subs.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          {["Director", "Admin", "MD"].includes(user?.role) && (
            <button onClick={() => { setShowArchived(p => !p); if (!showArchived) fetchArchived(); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              data-testid="toggle-archived-button">
              <RotateCcw size={14} /> Archived
            </button>
          )}
          {!isViewer && (
            <button onClick={() => { setEditSub(null); setModalOpen(true); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded-lg font-medium transition-colors"
              data-testid="add-subscription-button">
              <Plus size={14} /> Add Subscription
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-muted-foreground flex-shrink-0" />
            <input value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))}
              placeholder="Search subscriptions..." className="bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground w-full"
              data-testid="search-input" />
          </div>
          <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} className={selCls} data-testid="filter-status">
            <option value="">Status</option>
            {["Active", "Inactive", "Trial", "Cancelled"].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={filters.billing_cycle} onChange={e => setFilters(p => ({ ...p, billing_cycle: e.target.value }))} className={selCls} data-testid="filter-billing_cycle">
            <option value="">Billing Cycle</option>
            {["Monthly", "Quarterly", "Semi-Annual", "Annual", "One Time", "Custom"].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={filters.category_id} onChange={e => setFilters(p => ({ ...p, category_id: e.target.value }))} className={selCls} data-testid="filter-category">
            <option value="">Category</option>
            {categories.map(c => <option key={c._id} value={c._id}>{c.category_name}</option>)}
          </select>
          <select value={filters.responsible_person_id} onChange={e => setFilters(p => ({ ...p, responsible_person_id: e.target.value }))} className={selCls} data-testid="filter-person">
            <option value="">Person</option>
            {people.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => setFilters({ search: "", status: "", category_id: "", billing_cycle: "", responsible_person_id: "" })}
              className="text-sm text-muted-foreground hover:text-foreground px-2 transition-colors" data-testid="clear-filters-button">Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : subs.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3"><CreditIcon /></div>
            <p className="text-sm">No subscriptions found</p>
            {!isViewer && <button onClick={() => { setEditSub(null); setModalOpen(true); }} className="mt-2 text-sm text-primary hover:text-primary/80">Add your first subscription</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="subscriptions-table">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {["Name", "Cost", "Person", "Category", "Billing", "Status", "Due Date", ...(user?.role !== "User" ? ["Owner"] : []), ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map((sub, i) => {
                  const due = getDueStatus(sub.next_due_date);
                  return (
                    <tr key={sub._id} className="border-b border-border hover:bg-muted/30 transition-colors" data-testid={`subscription-row-${i}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {sub.category && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sub.category.color }} />}
                          <span className="font-semibold text-foreground truncate max-w-[160px]">{sub.subscription_name}</span>
                          {sub.management_link && <a href={sub.management_link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink size={11} /></a>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">{formatCurrency(sub.cost, sub.currency)}</td>
                      <td className="px-4 py-3">
                        {sub.responsible_person ? (
                          <div className="flex items-center gap-1.5 text-xs text-foreground">
                            <User size={11} className="text-muted-foreground" />{sub.responsible_person.name}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {sub.category ? <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ color: sub.category.color, background: sub.category.color + "20" }}>{sub.category.name}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{sub.billing_cycle}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${STATUS_CLASSES[sub.status] || ""}`}>{sub.status}</span></td>
                      <td className="px-4 py-3"><span className={`text-xs font-semibold ${DUE_CLASSES[due.variant]}`}>{sub.billing_cycle === "One Time" ? "—" : due.label}</span></td>
                      {user?.role !== "User" && <td className="px-4 py-3 text-xs text-muted-foreground">{sub.owner?.name || "—"}</td>}
                      <td className="px-4 py-3">
                        {!isViewer && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditSub(sub); setModalOpen(true); }} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" data-testid={`edit-subscription-${i}`}><Edit2 size={13} /></button>
                            <button onClick={() => setDeleteConfirm(sub._id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" data-testid={`delete-subscription-${i}`}><Trash2 size={13} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Archived */}
      {showArchived && user?.role === "MD" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid="archived-subscriptions">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Archived ({archivedSubs.length})</p>
          </div>
          {archivedSubs.length === 0 ? <p className="text-sm text-muted-foreground p-5">No archived subscriptions</p> : (
            <table className="w-full text-sm"><tbody>
              {archivedSubs.map((sub, i) => (
                <tr key={sub._id} className="border-b border-border">
                  <td className="px-4 py-3 text-muted-foreground">{sub.subscription_name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-right">{formatCurrency(sub.cost, sub.currency)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleRestore(sub._id)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80" data-testid={`restore-subscription-${i}`}>
                      <RotateCcw size={12} /> Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-xl" data-testid="delete-confirm-modal">
            <p className="text-foreground font-semibold mb-2">Delete Subscription?</p>
            <p className="text-sm text-muted-foreground mb-6">It will be archived and can be restored by an MD.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors" data-testid="delete-cancel-button">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive font-medium hover:bg-destructive/20 transition-colors" data-testid="delete-confirm-button">Delete</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && <SubscriptionModal subscription={editSub} categories={categories} people={people} onPeopleAdded={fetchMeta} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); fetchSubs(); }} />}
    </div>
  );
}

function CreditIcon() { return <Plus size={20} className="text-muted-foreground" />; }
