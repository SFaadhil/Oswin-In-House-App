import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Tag, CalendarCheck } from "lucide-react";
import api, { formatApiError } from "../utils/api";
import { toast } from "sonner";

const inpCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all";

function CategoryModal({ category, onClose, onSaved }) {
  const [form, setForm] = useState({ category_name: category?.category_name || "", color_code: category?.color_code || "#009d44" });
  const [loading, setLoading] = useState(false);
  const isEdit = !!category;
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (isEdit) { await api.put(`/categories/${category._id}`, form); toast.success("Updated"); }
      else { await api.post("/categories", form); toast.success("Created"); }
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="category-modal">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? "Edit" : "New"} Category</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Name</label>
            <input value={form.category_name} onChange={e => setForm(p => ({ ...p, category_name: e.target.value }))} className={inpCls} required data-testid="cat-name" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Color</label>
            <input type="color" value={form.color_code} onChange={e => setForm(p => ({ ...p, color_code: e.target.value }))} className="w-full h-10 rounded-lg border border-border bg-background cursor-pointer p-1" data-testid="cat-color" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted" data-testid="cat-cancel">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50" data-testid="cat-save">{loading ? "..." : isEdit ? "Update" : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LeaveTypeModal({ type, onClose, onSaved }) {
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
      toast.success(isEdit ? "Updated" : "Created"); onSaved();
    } catch (err) { toast.error(formatApiError(err)); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="leave-type-modal">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? "Edit" : "New"} Leave Type</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Name</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inpCls} required data-testid="lt-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Color</label>
              <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="w-full h-10 rounded-lg border border-border bg-background p-1" data-testid="lt-color" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Quota/yr</label>
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
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted" data-testid="lt-cancel">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50" data-testid="lt-save">{loading ? "..." : isEdit ? "Update" : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Categories() {
  const [tab, setTab] = useState("subscription");
  const [categories, setCategories] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catModal, setCatModal] = useState({ open: false, data: null });
  const [ltModal, setLtModal] = useState({ open: false, data: null });
  const [delConfirm, setDelConfirm] = useState(null); // {kind:'cat'|'lt', id, name}

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([api.get("/categories"), api.get("/leave-types")]);
      setCategories(c.data); setLeaveTypes(l.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async () => {
    if (!delConfirm) return;
    try {
      if (delConfirm.kind === "cat") await api.delete(`/categories/${delConfirm.id}`);
      else await api.delete(`/leave-types/${delConfirm.id}`);
      toast.success("Deleted");
      setDelConfirm(null); fetchAll();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const tabs = [
    { id: "subscription", label: "Subscription Categories", icon: Tag, count: categories.length },
    { id: "leave", label: "Leave Types", icon: CalendarCheck, count: leaveTypes.length },
  ];

  return (
    <div className="space-y-5" data-testid="categories-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-light text-foreground" style={{ fontFamily: "Chivo" }}>Categories</h1>
          <p className="text-sm text-muted-foreground">Manage subscription categories and leave types in one place</p>
        </div>
        {tab === "subscription" ? (
          <button onClick={() => setCatModal({ open: true, data: null })} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded-lg font-medium" data-testid="add-category-button">
            <Plus size={14} /> New Category
          </button>
        ) : (
          <button onClick={() => setLtModal({ open: true, data: null })} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded-lg font-medium" data-testid="add-leave-type-button">
            <Plus size={14} /> New Leave Type
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${tab === t.id ? "text-primary border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"}`}
                data-testid={`cat-tab-${t.id}`}>
                <Icon size={14} />
                {t.label}
                <span className="text-xs bg-muted text-muted-foreground px-1.5 rounded">{t.count}</span>
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : tab === "subscription" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="subscription-categories-grid">
              {categories.map(cat => (
                <div key={cat._id} className="bg-background border border-border rounded-xl p-4 hover:shadow-md transition-shadow" data-testid={`category-card-${cat.category_name}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded" style={{ background: cat.color_code }} />
                      <p className="text-sm font-semibold text-foreground">{cat.category_name}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setCatModal({ open: true, data: cat })} className="p-1 text-muted-foreground hover:text-primary rounded" data-testid={`edit-category-${cat.category_name}`}><Edit2 size={12} /></button>
                      <button onClick={() => setDelConfirm({ kind: "cat", id: cat._id, name: cat.category_name })} className="p-1 text-muted-foreground hover:text-destructive rounded" data-testid={`delete-category-${cat.category_name}`}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "Chivo" }}>{cat.subscription_count || 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">subscriptions</p>
                  {cat.is_default && <span className="inline-block mt-2 text-xs text-muted-foreground border border-border px-1.5 py-0.5 rounded">Default</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="leave-types-grid">
              {leaveTypes.map(t => (
                <div key={t._id} className="bg-background border border-border rounded-xl p-4 hover:shadow-md transition-shadow" data-testid={`leave-type-${t.name.toLowerCase().replace(/\s+/g,'-')}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded" style={{ background: t.color }} />
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setLtModal({ open: true, data: t })} className="p-1 text-muted-foreground hover:text-primary rounded" data-testid={`edit-lt-${t.name}`}><Edit2 size={12} /></button>
                      <button onClick={() => setDelConfirm({ kind: "lt", id: t._id, name: t.name })} className="p-1 text-muted-foreground hover:text-destructive rounded" data-testid={`delete-lt-${t.name}`}><Trash2 size={12} /></button>
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
        </div>
      </div>

      {delConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-xl" data-testid="delete-confirm">
            <p className="text-foreground font-semibold mb-2">Delete "{delConfirm.name}"?</p>
            <p className="text-sm text-muted-foreground mb-5">
              {delConfirm.kind === "cat" ? "Subscriptions will move to \"Others\" (or uncategorized if deleting Others)." : "This leave type will be deactivated and hidden from new applications."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelConfirm(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive font-medium hover:bg-destructive/20">Delete</button>
            </div>
          </div>
        </div>
      )}

      {catModal.open && <CategoryModal category={catModal.data} onClose={() => setCatModal({ open: false, data: null })} onSaved={() => { setCatModal({ open: false, data: null }); fetchAll(); }} />}
      {ltModal.open && <LeaveTypeModal type={ltModal.data} onClose={() => setLtModal({ open: false, data: null })} onSaved={() => { setLtModal({ open: false, data: null }); fetchAll(); }} />}
    </div>
  );
}
