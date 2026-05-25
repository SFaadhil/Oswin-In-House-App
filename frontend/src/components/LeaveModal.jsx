import { useState, useEffect } from "react";
import { X } from "lucide-react";
import api, { formatApiError } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import DatePicker from "./DatePicker";

const inpCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all";

export default function LeaveModal({ onClose, onSaved }) {
  const { user } = useAuth();
  const [types, setTypes] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [form, setForm] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    half_day: false,
    reason: "",
    supervisor_id: user?.manager_id || "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/leave-types"), api.get("/supervisors")])
      .then(([t, s]) => {
        setTypes(t.data);
        setSupervisors(s.data);
        if (!form.supervisor_id && s.data.length) {
          setForm((p) => ({ ...p, supervisor_id: user?.manager_id || s.data[0].id }));
        }
      })
      .catch(() => toast.error("Failed to load form data"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // When start date changes, clear end date if it's now before start
  const handleStartDate = (date) => {
    set("start_date", date);
    if (form.end_date && form.end_date < date) {
      set("end_date", date);
    }
  };

  // When half_day toggled, sync end = start
  const handleHalfDay = (checked) => {
    set("half_day", checked);
    if (checked && form.start_date) {
      set("end_date", form.start_date);
    }
  };

  const selectedType = types.find((t) => t._id === form.leave_type_id);

  const days = (() => {
    if (!form.start_date || !form.end_date) return 0;
    const s = new Date(form.start_date + "T12:00:00");
    const e = new Date(form.end_date + "T12:00:00");
    const d = Math.round((e - s) / 86400000) + 1;
    if (d <= 0) return 0;
    if (form.half_day) return d === 1 ? 0.5 : 0;
    return d;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.leave_type_id || !form.start_date || !form.end_date || !form.reason || !form.supervisor_id) {
      return toast.error("Please fill all required fields");
    }
    if (form.half_day && form.start_date !== form.end_date) {
      return toast.error("Half-day requires single-day leave");
    }
    setLoading(true);
    try {
      await api.post("/leaves", form);
      toast.success("Leave submitted for approval");
      onSaved();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="leave-modal">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-semibold text-foreground">Apply for Leave</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Leave Type */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Leave Type <span className="text-destructive">*</span>
            </label>
            <select
              value={form.leave_type_id}
              onChange={(e) => set("leave_type_id", e.target.value)}
              className={inpCls}
              required
              data-testid="leave-type-select"
            >
              <option value="">Select type...</option>
              {types.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.default_quota_days} days/yr)
                </option>
              ))}
            </select>
          </div>

          {/* Date Range — calendar pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Start Date <span className="text-destructive">*</span>
              </label>
              <DatePicker
                value={form.start_date}
                onChange={handleStartDate}
                placeholder="Pick start date"
                disabled={form.half_day && !!form.end_date}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                End Date <span className="text-destructive">*</span>
              </label>
              <DatePicker
                value={form.end_date}
                onChange={(v) => set("end_date", v)}
                placeholder="Pick end date"
                minDate={form.start_date || undefined}
                disabled={form.half_day}
              />
            </div>
          </div>

          {/* Half Day toggle */}
          {selectedType?.allow_half_day !== false && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.half_day}
                onChange={(e) => handleHalfDay(e.target.checked)}
                className="w-4 h-4 accent-primary"
                data-testid="leave-half-day"
              />
              <span className="text-sm text-foreground">Half day (single date only)</span>
            </label>
          )}

          {/* Day count preview */}
          {days > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-sm text-foreground">
              <b>{days}</b> day{days !== 1 ? "s" : ""} will be deducted from{" "}
              <b>{selectedType?.name || "leave balance"}</b>
            </div>
          )}

          {/* Supervisor */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Supervisor <span className="text-destructive">*</span>
            </label>
            <select
              value={form.supervisor_id}
              onChange={(e) => set("supervisor_id", e.target.value)}
              className={inpCls}
              required
              data-testid="leave-supervisor-select"
            >
              <option value="">Select supervisor...</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Notification will be sent to this person and admins for approval.
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Reason <span className="text-destructive">*</span>
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              className={`${inpCls} resize-none`}
              rows={3}
              placeholder="Brief reason for leave..."
              required
              data-testid="leave-reason"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted"
              data-testid="leave-cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
              data-testid="leave-submit-button"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
