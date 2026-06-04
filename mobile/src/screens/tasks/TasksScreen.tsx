import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ScrollView, Modal, Alert, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, formatApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing, radius, fontSize } from "../../theme";
import DatePickerField from "../../components/DatePickerField";

const TOP_ROLES = ["Director", "Admin", "MD", "Manager"];

const PRIORITY_COLOR: Record<string, string> = {
  Low: colors.success, Medium: colors.info, High: colors.warning, Urgent: colors.danger,
};
const STATUS_COLOR: Record<string, string> = {
  "Not Started": colors.textMuted, "In Progress": colors.info, "Paused": colors.warning,
  "Completed": colors.success, "Cancelled": colors.danger,
};
const STATUS_LABEL: Record<string, string> = {
  "Not Started": "Not Started", "In Progress": "In Progress", "Paused": "Paused",
  "Completed": "Completed", "Cancelled": "Cancelled",
};

interface Task {
  _id: string; title: string; description?: string; due_date?: string;
  priority: string; status: string;
  assignees: Array<{ _id: string; full_name: string }>;
  created_by: { _id: string; full_name: string };
  created_at: string;
}
interface Stats {
  not_started: number; in_progress: number; paused: number;
  completed: number; overdue: number; due_today: number; cancelled: number;
}
interface User { _id: string; full_name: string; }

const SCOPES = [
  { key: "mine", label: "Assigned to Me" },
  { key: "created", label: "Created by Me" },
  { key: "all", label: "All Tasks" },
  { key: "completed", label: "Audit Backlog" },
];
const STATUS_FILTERS = ["all", "Not Started", "In Progress", "Paused", "Completed", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

function daysLeft(dateStr?: string): { label: string; color: string } | null {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: colors.danger };
  if (diff === 0) return { label: "Due today", color: colors.warning };
  if (diff <= 3) return { label: `${diff}d left`, color: colors.warning };
  return { label: `${diff}d left`, color: colors.success };
}

function TaskCard({ task, currentUserId, isSupervisor, onEdit, onDelete, onStatusChange }: {
  task: Task; currentUserId: string; isSupervisor: boolean;
  onEdit: () => void; onDelete: () => void; onStatusChange: (status: string) => void;
}) {
  const dl = daysLeft(task.due_date);
  const isCreator = (task.created_by as any)?._id === currentUserId || (task.created_by as any)?.id === currentUserId;
  const nextStatuses: string[] = ({
    "Not Started": ["In Progress", "Cancelled"],
    "In Progress": ["Paused", "Completed", "Cancelled"],
    "Paused": ["In Progress", "Completed", "Cancelled"],
    "Completed": [], "Cancelled": [],
  } as Record<string, string[]>)[task.status] || [];

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
          <View style={styles.taskBadges}>
            <View style={[styles.badge, { backgroundColor: (PRIORITY_COLOR[task.priority] || colors.textMuted) + "20" }]}>
              <Text style={[styles.badgeText, { color: PRIORITY_COLOR[task.priority] || colors.textMuted }]}>{task.priority}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[task.status] || colors.textMuted) + "20" }]}>
              <Text style={[styles.badgeText, { color: STATUS_COLOR[task.status] || colors.textMuted }]}>{STATUS_LABEL[task.status] || task.status}</Text>
            </View>
            {dl && (
              <View style={[styles.badge, { backgroundColor: dl.color + "20" }]}>
                <Text style={[styles.badgeText, { color: dl.color }]}>{dl.label}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.taskActions}>
          {(isCreator || isSupervisor) && (
            <TouchableOpacity onPress={onEdit} style={styles.iconBtn}>
              <Ionicons name="pencil" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
          {(isCreator || isSupervisor) && (
            <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {task.description ? <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text> : null}
      {task.assignees?.length > 0 && (
        <Text style={styles.taskAssignees}>
          Assigned to: {task.assignees.map(a => a.full_name).join(", ")}
        </Text>
      )}
      {task.due_date && (
        <Text style={styles.taskDue}>
          Due: {new Date(task.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </Text>
      )}
      {nextStatuses.length > 0 && (
        <View style={styles.statusButtons}>
          {nextStatuses.map(s => (
            <TouchableOpacity key={s} style={[styles.statusBtn, { borderColor: STATUS_COLOR[s] }]} onPress={() => onStatusChange(s)}>
              <Text style={[styles.statusBtnText, { color: STATUS_COLOR[s] }]}>{STATUS_LABEL[s]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function TaskModal({ visible, task, users, onClose, onSave }: {
  visible: boolean; task: Task | null; users: User[];
  onClose: () => void; onSave: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [status, setStatus] = useState("not_started");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setDueDate(task.due_date ? task.due_date.slice(0, 10) : "");
      setPriority(task.priority || "Medium");
      setStatus(task.status || "not_started");
      setAssigneeIds(task.assignees?.map(a => a._id) || []);
    } else {
      setTitle(""); setDescription(""); setDueDate("");
      setPriority("Medium"); setStatus("Not Started"); setAssigneeIds([]);
    }
    setError("");
  }, [task, visible]);

  const toggleAssignee = (id: string) =>
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const save = async () => {
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true); setError("");
    try {
      const payload: any = { title: title.trim(), description, priority, assignee_ids: assigneeIds };
      if (dueDate) payload.due_date = dueDate;
      if (task) {
        payload.status = status;
        await api.put(`/tasks/${task._id}`, payload);
      } else {
        await api.post("/tasks", payload);
      }
      onSave();
    } catch (e) { setError(formatApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>{task ? "Edit Task" : "New Task"}</Text>
          <TouchableOpacity onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.modalSave}>Save</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.fieldLabel}>Title *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle}
            placeholder="Task title" placeholderTextColor={colors.textMuted} />

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            value={description} onChangeText={setDescription}
            placeholder="Optional description" placeholderTextColor={colors.textMuted} multiline />

          <Text style={styles.fieldLabel}>Due Date</Text>
          <DatePickerField
            value={dueDate}
            onChange={setDueDate}
            placeholder="Select due date (optional)"
          />

          <Text style={styles.fieldLabel}>Priority</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            {PRIORITIES.map(p => (
              <TouchableOpacity key={p} onPress={() => setPriority(p)}
                style={[styles.chip, priority === p && { backgroundColor: PRIORITY_COLOR[p], borderColor: PRIORITY_COLOR[p] }]}>
                <Text style={[styles.chipText, priority === p && { color: "#fff" }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {task && (
            <>
              <Text style={styles.fieldLabel}>Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {Object.keys(STATUS_LABEL).map(s => (
                  <TouchableOpacity key={s} onPress={() => setStatus(s)}
                    style={[styles.chip, status === s && { backgroundColor: STATUS_COLOR[s], borderColor: STATUS_COLOR[s] }]}>
                    <Text style={[styles.chipText, status === s && { color: "#fff" }]}>{STATUS_LABEL[s]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <Text style={styles.fieldLabel}>Assignees</Text>
          {users.map(u => (
            <TouchableOpacity key={u._id} style={styles.checkRow} onPress={() => toggleAssignee(u._id)}>
              <View style={[styles.checkbox, assigneeIds.includes(u._id) && styles.checkboxChecked]}>
                {assigneeIds.includes(u._id) && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={styles.checkLabel}>{u.full_name}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function TasksScreen() {
  const { user } = useAuth();
  const isSupervisor = TOP_ROLES.includes(user?.role || "");
  const [scope, setScope] = useState("mine");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const availableScopes = isSupervisor ? SCOPES : SCOPES.filter(s => s.key !== "all");

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, statsRes, usersRes] = await Promise.all([
        api.get(`/tasks?scope=${scope}`),
        api.get("/tasks-stats/me"),
        api.get("/users?active=true"),
      ]);
      setTasks(tasksRes.data || []);
      setStats(statsRes.data);
      setUsers(usersRes.data || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [scope]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const deleteTask = (task: Task) => {
    Alert.alert("Delete Task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try { await api.delete(`/tasks/${task._id}`); fetchData(); }
          catch (e) { Alert.alert("Error", formatApiError(e)); }
        }
      }
    ]);
  };

  const changeStatus = async (task: Task, newStatus: string) => {
    try { await api.put(`/tasks/${task._id}/status`, { status: newStatus }); fetchData(); }
    catch (e) { Alert.alert("Error", formatApiError(e)); }
  };

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Stats row */}
      {stats && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm }}>
          {([
            { key: "not_started", label: "Not Started", color: colors.textMuted },
            { key: "in_progress", label: "In Progress", color: colors.info },
            { key: "paused", label: "Paused", color: colors.warning },
            { key: "completed", label: "Completed", color: colors.success },
            { key: "overdue", label: "Overdue", color: colors.danger },
            { key: "due_today", label: "Due Today", color: "#f97316" },
            { key: "cancelled", label: "Cancelled", color: colors.textMuted },
          ] as { key: keyof Stats; label: string; color: string }[]).map(s => (
            <View key={s.key} style={[styles.statPill, { borderColor: s.color }]}>
              <Text style={[styles.statPillNum, { color: s.color }]}>{stats[s.key] ?? 0}</Text>
              <Text style={styles.statPillLabel}>{s.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Scope tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow}
        contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs }}>
        {availableScopes.map(s => (
          <TouchableOpacity key={s.key} onPress={() => setScope(s.key)}
            style={[styles.tabChip, scope === s.key && styles.tabChipActive]}>
            <Text style={[styles.tabChipText, scope === s.key && styles.tabChipTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search + Add */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search tasks..." placeholderTextColor={colors.textMuted} />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setEditTask(null); setShowModal(true); }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Status + Priority filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs, alignItems: "center" }}>
        {STATUS_FILTERS.map(s => (
          <TouchableOpacity key={s} onPress={() => setStatusFilter(s)}
            style={[styles.filterChip, statusFilter === s && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            <Text style={[styles.filterChipText, statusFilter === s && { color: "#fff" }]}>
              {s === "all" ? "All Status" : s}
            </Text>
          </TouchableOpacity>
        ))}
        {(["all", ...PRIORITIES] as string[]).map(p => (
          <TouchableOpacity key={"p_" + p} onPress={() => setPriorityFilter(p)}
            style={[styles.filterChip, priorityFilter === p && { backgroundColor: colors.purple, borderColor: colors.purple }]}>
            <Text style={[styles.filterChipText, priorityFilter === p && { color: "#fff" }]}>
              {p === "all" ? "All Priority" : p}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={t => t._id}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            currentUserId={(user as any)?._id || user?.id || ""}
            isSupervisor={isSupervisor}
            onEdit={() => { setEditTask(item); setShowModal(true); }}
            onDelete={() => deleteTask(item)}
            onStatusChange={s => changeStatus(item, s)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.center}><Text style={styles.emptyText}>No tasks found</Text></View>
        }
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 100 }}
      />

      <TaskModal
        visible={showModal}
        task={editTask}
        users={users}
        onClose={() => setShowModal(false)}
        onSave={() => { setShowModal(false); fetchData(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  statsRow: { maxHeight: 80, backgroundColor: colors.background },
  statPill: {
    alignItems: "center", borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, minWidth: 80,
  },
  statPillNum: { fontSize: fontSize.xl, fontWeight: "700" },
  statPillLabel: { fontSize: 9, color: colors.textMuted, textAlign: "center" },
  tabsRow: { maxHeight: 50, backgroundColor: colors.background },
  tabChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabChipText: { fontSize: fontSize.xs, color: colors.textMuted },
  tabChipTextActive: { color: "#fff", fontWeight: "600" },
  searchRow: {
    flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, backgroundColor: colors.background,
  },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.sm, height: 40,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: fontSize.sm },
  addBtn: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
  },
  filterRow: { maxHeight: 48, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterChip: {
    height: 32, paddingHorizontal: spacing.sm, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center",
  },
  filterChipText: { fontSize: fontSize.xs, color: colors.textMuted },
  taskCard: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, elevation: 1 },
  taskHeader: { flexDirection: "row", alignItems: "flex-start" },
  taskTitle: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text, flex: 1, marginBottom: spacing.xs },
  taskBadges: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  badgeText: { fontSize: 10, fontWeight: "600" },
  taskActions: { flexDirection: "row", gap: 4, marginLeft: spacing.sm },
  iconBtn: {
    width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.card,
    justifyContent: "center", alignItems: "center",
  },
  taskDesc: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs },
  taskAssignees: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
  taskDue: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  statusButtons: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm },
  statusBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  statusBtnText: { fontSize: 11, fontWeight: "600" },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  modalCancel: { fontSize: fontSize.sm, color: colors.textMuted },
  modalTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  modalSave: { fontSize: fontSize.sm, fontWeight: "700", color: colors.primary },
  modalBody: { flex: 1, backgroundColor: colors.card, padding: spacing.md },
  fieldLabel: {
    fontSize: fontSize.xs, fontWeight: "600", color: colors.textMuted,
    marginBottom: spacing.xs, marginTop: spacing.sm, textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm,
    color: colors.text, fontSize: fontSize.sm, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs,
  },
  chipText: { fontSize: fontSize.sm, color: colors.text },
  checkRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
    borderColor: colors.border, justifyContent: "center", alignItems: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { fontSize: fontSize.sm, color: colors.text },
  errorText: { color: colors.danger, fontSize: fontSize.sm, marginBottom: spacing.sm },
});
