import { useState, useEffect } from "react";
import { X, Plus, User } from "lucide-react";
import api, { formatApiError } from "../utils/api";
import { toast } from "sonner";

const BILLING_CYCLES = ["Monthly", "Quarterly", "Semi-Annual", "Annual", "One Time", "Custom"];
const STATUSES = ["Active", "Inactive", "Trial", "Cancelled"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

const inpCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground";
const Field = ({ label, required, children }) => (
  <div><label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}{required && <span className="text-destructive ml-0.5">*</span>}</label>{children}</div>
);

export default function SubscriptionModal({ subscription, categories, people: initialPeople, onPeopleAdded, onClose, onSaved }) {
  const isEdit = !!subscription;
  const [form, setForm] = useState({
    subscription_name: "", cost: "", currency: "INR", billing_cycle: "Monthly",
    next_due_date: "", category_id: "", responsible_person_id: "", status: "Active",
    management_link: "", payment_method: "", notes: "",
    ...(subscription ? {
      ...subscription,
      cost: String(subscription.cost),
      category_id: subscription.category_id || "",
      responsible_person_id: subscription.responsible_person_id || "",
      next_due_date: subscription.next_due_date?.slice(0, 10) || "",
      management_link: subscription.management_link || "",
      payment_method: subscription.payment_method || "",
      notes: subscription.notes || "",
    } : {}),
  });
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState(initialPeople || []);
  const [newPersonName, setNewPersonName] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleAddPerson = async () => {
    if (!newPersonName.trim()) return;
    setAddingPerson(true);
    try {
      const res = await api.post("/people", { name: newPersonName.trim() });
      const updated = [...people, res.data];
      setPeople(updated);
      set("responsible_person_id", res.data._id);
      setNewPersonName(""); setShowAddPerson(false);
      toast.success(`Person "${res.data.name}" added`);
      if (onPeopleAdded) onPeopleAdded();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setAddingPerson(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subscription_name || !form.cost || !form.billing_cycle) {
      toast.error("Please fill required fields"); return;
    }
    if (form.billing_cycle !== "One Time" && !form.next_due_date) {
      toast.error("Please set a due date"); return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        cost: parseFloat(form.cost),
        category_id: form.category_id || null,
        responsible_person_id: form.responsible_person_id || null,
        management_link: form.management_link || null,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        next_due_date: form.billing_cycle === "One Time" ? (form.next_due_date || new Date().toISOString().slice(0, 10)) : form.next_due_date,
      };
      if (isEdit) {
        await api.put(`/subscriptions/${subscription._id}`, payload);
        toast.success("Subscription updated");
      } else {
        await api.post("/subscriptions", payload);
        toast.success("Subscription added");
      }
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const isOneTime = form.billing_cycle === "One Time";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" data-testid="subscription-modal">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-lg font-semibold text-foreground">{isEdit ? "Edit Subscription" : "Add Subscription"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="modal-close-button"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Subscription Name" required>
                <input value={form.subscription_name} onChange={e => set("subscription_name", e.target.value)} className={inpCls} placeholder="e.g. Netflix, AWS, Laptop lease" required data-testid="sub-name-input" />
              </Field>
            </div>
            <Field label="Cost" required>
              <input type="number" value={form.cost} onChange={e => set("cost", e.target.value)} className={inpCls} placeholder="0.00" step="0.01" min="0" required data-testid="sub-cost-input" />
            </Field>
            <Field label="Currency">
              <select value={form.currency} onChange={e => set("currency", e.target.value)} className={inpCls} data-testid="sub-currency-select">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Billing Cycle" required>
              <select value={form.billing_cycle} onChange={e => set("billing_cycle", e.target.value)} className={inpCls} required data-testid="sub-billing-select">
                {BILLING_CYCLES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {isOneTime && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">One-time cost won't appear in monthly/annual totals</p>}
            </Field>
            {!isOneTime && (
              <Field label="Next Due Date" required>
                <input type="date" value={form.next_due_date} onChange={e => set("next_due_date", e.target.value)} className={inpCls} required data-testid="sub-due-date-input" />
              </Field>
            )}
            <Field label="Category">
              <select value={form.category_id} onChange={e => set("category_id", e.target.value)} className={inpCls} data-testid="sub-category-select">
                <option value="">No category</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.category_name}</option>)}
              </select>
            </Field>

            {/* Responsible Person */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Responsible Person</label>
              <div className="flex gap-2">
                <select value={form.responsible_person_id} onChange={e => set("responsible_person_id", e.target.value)} className={`${inpCls} flex-1`} data-testid="sub-person-select">
                  <option value="">No person assigned</option>
                  {people.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowAddPerson(p => !p)}
                  className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  data-testid="add-person-toggle">
                  <User size={13} /><Plus size={11} />
                </button>
              </div>
              {showAddPerson && (
                <div className="flex gap-2 mt-2">
                  <input value={newPersonName} onChange={e => setNewPersonName(e.target.value)} placeholder="Enter person name..." className={`${inpCls} flex-1`}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddPerson())}
                    data-testid="new-person-name-input" />
                  <button type="button" onClick={handleAddPerson} disabled={addingPerson || !newPersonName.trim()}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50 hover:bg-primary/90"
                    data-testid="save-new-person-button">
                    {addingPerson ? "..." : "Add"}
                  </button>
                </div>
              )}
            </div>

            <Field label="Status">
              <select value={form.status} onChange={e => set("status", e.target.value)} className={inpCls} data-testid="sub-status-select">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Payment Method">
              <input value={form.payment_method} onChange={e => set("payment_method", e.target.value)} className={inpCls} placeholder="e.g. Credit Card, UPI" data-testid="sub-payment-input" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Management Link">
                <input value={form.management_link} onChange={e => set("management_link", e.target.value)} className={inpCls} placeholder="https://..." data-testid="sub-link-input" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <textarea value={form.notes} onChange={e => set("notes", e.target.value)} className={`${inpCls} resize-none`} rows={3} data-testid="sub-notes-input" />
              </Field>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors" data-testid="modal-cancel-button">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold transition-colors disabled:opacity-50" data-testid="modal-save-button">
              {loading ? "Saving..." : isEdit ? "Update" : "Add Subscription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
