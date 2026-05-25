import { useState, useEffect, useCallback } from "react";
import { Plus, X, Calendar, Clock, CheckCircle2, Circle, PauseCircle, XCircle, AlertTriangle, Trash2, Edit2, Users as UsersIcon, Search, Filter } from "lucide-react";
import api, { formatApiError } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import DatePicker from "../components/DatePicker";

const STATUSES = ["Not Started", "In Progress", "Paused", "Completed", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const STATUS_META = {
  "Not Started": { icon: Circle, color: "text-muted-foreground bg-muted" },
  "In Progress": { icon: Clock, color: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20" },
  "Paused": { icon: PauseCircle, color: "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20" },
  "Completed": { icon: CheckCircle2, color: "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20" },
  "Cancelled": { icon: XCircle, color: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20" },
};

const PRIORITY_COLOR = {
  Low: "text-muted-foreground bg-muted",
  Medium: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20",
  High: "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20",
  Urgent: "text-destructive bg-destructive/10 border border-destructive/20",
};

const SUPERVISOR_ROLES = ["Director", "Admin", "MD", "Manager"];
const inpCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all";

function daysLeft(due) {
  if (!due) return null;
  const d = new Date(due + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function TaskModal({ task, onClose, onSaved }) {
  const isEdit = !!task;
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    due_date: task?.due_date || "",
    priority: task?.priority || "Medium",
    status: task?.status || "Not Started",
    assignee_ids: task?.assignees?.map(a => a.id) || (task?.assignee_ids || []),
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/users").then(r => setUsers(r.data)).catch(() => {}); }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleAssignee = (uid) => {
    setForm(p => ({ ...p, assignee_ids: p.assignee_ids.includes(uid) ? p.assignee_ids.filter(x => x !== uid) : [...p.assignee_ids, uid] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    setLoading(true);
    try {
      const payload = { ...form, due_date: form.due_date || null };
      if (isEdit) await api.put(`/tasks/${task._id}`, payload);
      else await api.post("/tasks", payload);
      toast.success(isEdit ? "Task updated" : "Task created");
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="task-modal">
      <div className="bg-card border border-border rounded-xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? "Edit Task" : "New Task"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="task-modal-close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Task Title <span className="text-destructive">*</span></label>
            <input value={form.title} onChange={e => set("title", e.target.value)} className={inpCls} required placeholder="e.g. Review Q2 budget" data-testid="task-title-input" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} className={`${inpCls} resize-none`} rows={4} placeholder="Details, context, acceptance criteria..." data-testid="task-description-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Due Date</label>
              <DatePicker
                value={form.due_date}
                onChange={(v) => set("due_date", v)}
                placeholder="Pick a date"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Priority</label>
              <select value={form.priority} onChange={e => set("priority", e.target.value)} className={inpCls} data-testid="task-priority-select">
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)} className={inpCls} data-testid="task-status-select">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Assignees <span className="text-xs font-normal">({form.assignee_ids.length} selected)</span></label>
            <div className="max-h-48 overflow-y-auto border border-border rounded-lg p-2 space-y-1" data-testid="task-assignees-list">
              {users.map(u => (
                <label key={u._id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer">
                  <input type="checkbox" checked={form.assignee_ids.includes(u._id)} onChange={() => toggleAssignee(u._id)} className="w-4 h-4 accent-primary" data-testid={`task-assignee-${u._id}`} />
                  <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">{u.full_name?.[0]?.toUpperCase()}</div>
                  <span className="text-sm text-foreground">{u.full_name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{u.role}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted" data-testid="task-cancel">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50" data-testid="task-submit">
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskCard({ task, onEdit, onStatusChange, onDelete, currentUserId }) {
  const StatusIcon = STATUS_META[task.status]?.icon || Circle;
  const dl = daysLeft(task.due_date);
  const isOverdue = dl !== null && dl < 0 && !["Completed", "Cancelled"].includes(task.status);
  const canDelete = task.creator?.id === currentUserId;

  return (
    <div className={`bg-card border rounded-xl p-4 hover:shadow-md transition-all ${isOverdue ? "border-destructive/40" : "border-border"}`} data-testid={`task-card-${task._id}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 ${STATUS_META[task.status]?.color}`}>
              <StatusIcon size={11} /> {task.status}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLOR[task.priority]}`}>{task.priority}</span>
            {isOverdue && <span className="text-xs text-destructive font-semibold inline-flex items-center gap-1"><AlertTriangle size={11} /> Overdue</span>}
          </div>
          <h3 className="text-sm font-semibold text-foreground line-clamp-2">{task.title}</h3>
          {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
        </div>
        <div className="flex gap-0.5 flex-shrink-0">
          <button onClick={() => onEdit(task)} className="p-1 text-muted-foreground hover:text-primary rounded" title="Edit" data-testid={`edit-task-${task._id}`}><Edit2 size={12} /></button>
          {canDelete && <button onClick={() => onDelete(task._id)} className="p-1 text-muted-foreground hover:text-destructive rounded" title="Delete" data-testid={`delete-task-${task._id}`}><Trash2 size={12} /></button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
        {task.due_date && (
          <span className={`inline-flex items-center gap-1 ${isOverdue ? "text-destructive font-semibold" : ""}`}>
            <Calendar size={11} /> {task.due_date}
            {dl !== null && !["Completed","Cancelled"].includes(task.status) && (
              <span className="ml-1">({dl === 0 ? "today" : dl > 0 ? `${dl} day${dl===1?"":"s"} left` : `${Math.abs(dl)} day${Math.abs(dl)===1?"":"s"} overdue`})</span>
            )}
          </span>
        )}
        {task.creator?.name && <span>by <span className="text-foreground">{task.creator.name}</span></span>}
      </div>

      {task.assignees && task.assignees.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <UsersIcon size={11} className="text-muted-foreground" />
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 5).map(a => (
              <div key={a.id} className="w-6 h-6 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center text-[10px] font-bold text-primary" title={a.name}>
                {a.name?.[0]?.toUpperCase()}
              </div>
            ))}
            {task.assignees.length > 5 && <div className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-bold text-muted-foreground">+{task.assignees.length - 5}</div>}
          </div>
        </div>
      )}

      {!["Completed", "Cancelled"].includes(task.status) && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
          {STATUSES.filter(s => s !== task.status).map(s => (
            <button key={s} onClick={() => onStatusChange(task._id, s)}
              className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${s === "Completed" ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
              data-testid={`status-btn-${task._id}-${s.toLowerCase().replace(' ','-')}`}>
              → {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const isSupervisor = SUPERVISOR_ROLES.includes(user?.role);
  const [scope, setScope] = useState("mine");
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "", priority: "" });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tasks?scope=${scope}`);
      setTasks(res.data);
    } catch { toast.error("Failed to load tasks"); }
    finally { setLoading(false); }
  }, [scope]);

  const fetchStats = async () => {
    try { const res = await api.get("/tasks-stats/me"); setStats(res.data); } catch {}
  };

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { fetchStats(); }, []);

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/tasks/${id}/status`, { status });
      toast.success(`Marked ${status}`);
      fetchTasks(); fetchStats();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const handleDelete = async () => {
    if (!delConfirm) return;
    try {
      await api.delete(`/tasks/${delConfirm}`);
      toast.success("Task deleted");
      setDelConfirm(null); fetchTasks(); fetchStats();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const filtered = tasks.filter(t => {
    if (filters.search && !(t.title.toLowerCase().includes(filters.search.toLowerCase()) || (t.description || "").toLowerCase().includes(filters.search.toLowerCase()))) return false;
    if (filters.status && t.status !== filters.status) return false;
    if (filters.priority && t.priority !== filters.priority) return false;
    return true;
  });

  const tabs = [
    { id: "mine", label: "Assigned to Me" },
    { id: "created", label: "Created by Me" },
    ...(isSupervisor ? [{ id: "all", label: "All Tasks" }] : []),
    { id: "completed", label: "Audit Backlog" },
  ];

  return (
    <div className="space-y-5" data-testid="tasks-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-light text-foreground" style={{ fontFamily: "Chivo" }}>Task Manager</h1>
          <p className="text-sm text-muted-foreground">Create, assign, and track tasks across the team</p>
        </div>
        <button onClick={() => { setEditTask(null); setModalOpen(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm rounded-lg font-medium" data-testid="new-task-button">
          <Plus size={14} /> New Task
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { key: "not_started", label: "Not Started", color: STATUS_META["Not Started"].color },
            { key: "in_progress", label: "In Progress", color: STATUS_META["In Progress"].color },
            { key: "paused", label: "Paused", color: STATUS_META["Paused"].color },
            { key: "completed", label: "Completed", color: STATUS_META["Completed"].color },
            { key: "overdue", label: "Overdue", color: "text-destructive bg-destructive/10" },
            { key: "due_today", label: "Due Today", color: "text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400" },
            { key: "cancelled", label: "Cancelled", color: STATUS_META["Cancelled"].color },
          ].map(s => (
            <div key={s.key} className="bg-card border border-border rounded-xl p-3" data-testid={`stat-${s.key}`}>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1" style={{ fontFamily: "Chivo" }}>{stats[s.key] || 0}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setScope(t.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${scope === t.id ? "text-primary border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"}`}
              data-testid={`task-tab-${t.id}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 p-3 border-b border-border bg-muted/20" data-testid="task-filters">
          <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 flex-1 min-w-[220px]">
            <Search size={13} className="text-muted-foreground" />
            <input value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} placeholder="Search tasks..." className="bg-transparent text-sm text-foreground outline-none w-full" data-testid="task-search" />
          </div>
          <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none" data-testid="task-filter-status">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.priority} onChange={e => setFilters(p => ({ ...p, priority: e.target.value }))} className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none" data-testid="task-filter-priority">
            <option value="">All priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-muted-foreground">
              <Circle size={28} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">{tasks.length === 0 ? "No tasks yet" : "No tasks match your filters"}</p>
              {scope === "created" && tasks.length === 0 && (
                <button onClick={() => setModalOpen(true)} className="text-sm text-primary mt-2 hover:text-primary/80">Create your first task</button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="tasks-grid">
              {filtered.map(t => (
                <TaskCard key={t._id} task={t}
                  currentUserId={user?._id}
                  onEdit={(tk) => { setEditTask(tk); setModalOpen(true); }}
                  onStatusChange={handleStatusChange}
                  onDelete={(id) => setDelConfirm(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {modalOpen && <TaskModal task={editTask} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); fetchTasks(); fetchStats(); }} />}

      {delConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full shadow-xl" data-testid="delete-task-confirm">
            <p className="text-foreground font-semibold mb-2">Delete this task?</p>
            <p className="text-sm text-muted-foreground mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelConfirm(null)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive font-medium hover:bg-destructive/20">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
