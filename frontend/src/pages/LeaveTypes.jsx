import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Calendar } from "lucide-react";
import api, { formatApiError } from "../utils/api";
import { toast } from "sonner";

const inpCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all";

function TypeModal({ type, onClose, onSaved }) {
  const isEdit = !!type;
  const [form, setForm] = useState({
    name: type?.name || "",
    color: type?.color || "#009d44",
    default_quota_days: type?.default_quota_days ?? 12,
    is_paid: type?.is_paid !== false,
    allow_half_day: type?.allow_half_day !== false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (isEdit) await api.put(`/leave-types/${type._id}`, form);
      else await api.post("/leave-types", form);
      toast.success(isEdit ? "Leave type updated" : "Leave type created");
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="leave-type-modal">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? "Edit" : "New"} Leave Type</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Name <span className="text-destructive">*</span></label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inpCls} required data-testid="lt-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Color</label>
              <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="w-full h-10 rounded-lg border border-border bg-background cursor-pointer p-1" data-testid="lt-color" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Annual Quota</label>
              <input type="number" step="0.5" min="0" value={form.default_quota_days} onChange={e => setForm(p => ({ ...p, default_quota_days: parseFloat(e.target.value || 0) }))} className={inpCls} required data-testid="lt-quota" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_paid} onChange={e => setForm(p => ({ ...p, is_paid: e.target.checked }))} className="w-4 h-4 accent-primary" data-testid="lt-paid" />
            <span className="text-sm text-foreground">Paid leave</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.allow_half_day} onChange={e => setForm(p => ({ ...p, allow_half_day: e.target.checked }))} className="w-4 h-4 accent-primary" data-testid="lt-halfday" />
            <span className="text-sm text-foreground">Allow half-day</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted" data-testid="lt-cancel">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50" data-testid="lt-save">
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeaveTypes() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editType, setEditType] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchTypes = async () => {
    setLoading(true);
    try { const res = await api.get("/leave-types"); setTypes(res.data); }
    catch { toast.error("Failed to load leave types"); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchTypes(); }, []);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/leave-types/${id}`);
      toast.success("Leave type deactivated");
      setDeleteConfirm(null); fetchTypes();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="space-y-5" data-testid="leave-types-page">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-light text-foreground flex items-center gap-2" style={{ fontFamily: "Chivo" }}>
            <Calendar size={22} className="text-primary" /> Leave Types
          </h1>
          <p className="text-sm text-muted-foreground">Configure leave categories and annual quotas · {types.length} active</p>
        </div>
        <button onClick={() => { setEditType(null); setModalOpen(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded-lg font-medium" data-testid="add-leave-type-button">
          <Plus size={14} /> New Type
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="leave-types-grid">
          {types.map(t => (
            <div key={t._id} className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow" data-testid={`leave-type-${t.name.toLowerCase().replace(/\s+/g,'-')}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded" style={{ background: t.color }} />
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditType(t); setModalOpen(true); }} className="p-1 text-muted-foreground hover:text-primary rounded" data-testid={`edit-lt-${t.name}`}><Edit2 size={12} /></button>
                  <button onClick={() => setDeleteConfirm(t._id)} className="p-1 text-muted-foreground hover:text-destructive rounded" data-testid={`delete-lt-${t.name}`}><Trash2 size={12} /></button>
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "Chivo" }}>{t.default_quota_days}</p>
              <p className="text-xs text-muted-foreground mt-0.5">days / year</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {t.is_paid && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">Paid</span>}
                {t.allow_half_day && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">Half-day OK</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && <TypeModal type={editType} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); fetchTypes(); }} />}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-xl" data-testid="delete-lt-confirm">
            <p className="text-foreground font-semibold mb-2">Deactivate leave type?</p>
            <p className="text-sm text-muted-foreground mb-6">It will be hidden from new applications. Existing leaves are preserved.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive font-medium">Deactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
