import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
  TouchableOpacity, TextInput, Modal, ScrollView, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, formatApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing, radius, fontSize } from "../../theme";
import DatePickerField from "../../components/DatePickerField";

const STATUS_COLORS: Record<string, string> = {
  pending: colors.warning, approved: colors.success, rejected: colors.danger, cancelled: colors.textMuted,
};
const SUPERVISOR_ROLES = ["Director", "Admin", "MD", "Manager"];

function ApplyLeaveModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [types, setTypes] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [form, setForm] = useState({ leave_type_id: "", start_date: "", end_date: "", half_day: false, reason: "", supervisor_id: user?.module_permissions ? "" : "" });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleStartDate = (date: string) => {
    set("start_date", date);
    if (form.end_date && form.end_date < date) set("end_date", date);
  };

  const handleHalfDay = (checked: boolean) => {
    set("half_day", checked);
    if (checked && form.start_date) set("end_date", form.start_date);
  };

  useEffect(() => {
    Promise.all([api.get("/leave-types"), api.get("/supervisors")])
      .then(([t, s]) => { setTypes(t.data); setSupervisors(s.data); if (s.data.length) set("supervisor_id", s.data[0].id); })
      .catch(() => {});
  }, []);

  const selectedType = types.find(t => t._id === form.leave_type_id);
  const days = (() => {
    if (!form.start_date || !form.end_date) return 0;
    const s = new Date(form.start_date), e = new Date(form.end_date);
    const d = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    if (d <= 0) return 0;
    if (form.half_day) return d === 1 ? 0.5 : 0;
    return d;
  })();

  const handleSubmit = async () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date || !form.reason || !form.supervisor_id)
      return Alert.alert("Error", "Please fill all required fields");
    if (form.half_day && form.start_date !== form.end_date)
      return Alert.alert("Error", "Half-day requires single-day leave");
    setLoading(true);
    try { await api.post("/leaves", form); onSaved(); }
    catch (err: any) { Alert.alert("Error", formatApiError(err)); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Apply for Leave</Text>
        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
      </View>
      <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Leave Type *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {types.filter(t => t.is_active !== false).map(t => (
            <TouchableOpacity key={t._id} style={[styles.chip, form.leave_type_id === t._id && styles.chipActive]} onPress={() => set("leave_type_id", t._id)}>
              <View style={[styles.dot, { backgroundColor: t.color }]} />
              <Text style={[styles.chipText, form.leave_type_id === t._id && styles.chipTextActive]}>{t.name} ({t.default_quota_days}d/yr)</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Start Date *</Text>
            <DatePickerField
              value={form.start_date}
              onChange={handleStartDate}
              placeholder="Start date"
              disabled={form.half_day && !!form.end_date}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>End Date *</Text>
            <DatePickerField
              value={form.end_date}
              onChange={v => set("end_date", v)}
              placeholder="End date"
              minDate={form.start_date || undefined}
              disabled={form.half_day}
            />
          </View>
        </View>

        {selectedType?.allow_half_day !== false && (
          <TouchableOpacity style={styles.checkRow} onPress={() => handleHalfDay(!form.half_day)}>
            <View style={[styles.checkbox, form.half_day && styles.checkboxActive]}>
              {form.half_day && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <Text style={styles.checkLabel}>Half day (single date only)</Text>
          </TouchableOpacity>
        )}

        {days > 0 && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}><Text style={{ fontWeight: "700" }}>{days}</Text> day{days !== 1 ? "s" : ""} will be deducted from <Text style={{ fontWeight: "700" }}>{selectedType?.name}</Text></Text>
          </View>
        )}

        <Text style={styles.fieldLabel}>Supervisor *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {supervisors.map(s => (
            <TouchableOpacity key={s.id} style={[styles.chip, form.supervisor_id === s.id && styles.chipActive]} onPress={() => set("supervisor_id", s.id)}>
              <Text style={[styles.chipText, form.supervisor_id === s.id && styles.chipTextActive]}>{s.name} ({s.role})</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Reason *</Text>
        <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]} value={form.reason} onChangeText={v => set("reason", v)} placeholder="Brief reason for leave..." placeholderTextColor={colors.textMuted} multiline />

        <View style={[styles.row2, { marginTop: spacing.md }]}>
          <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={onClose}>
            <Text style={styles.outlineBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.primaryBtnText}>{loading ? "Submitting..." : "Submit Request"}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </Modal>
  );
}

function ByEmployeeView({ types }: { types: any[] }) {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [balance, setBalance] = useState<any>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/users").then(r => setUsers(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    if (!selectedId) { setBalance(null); setLeaves([]); return; }
    setLoading(true);
    Promise.all([api.get(`/users/${selectedId}/leave-balance`), api.get(`/leaves?scope=user&user_id=${selectedId}`)])
      .then(([b, l]) => { setBalance(b.data); setLeaves(l.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedId]);

  return (
    <ScrollView style={{ flex: 1, padding: spacing.md }}>
      <Text style={styles.fieldLabel}>Select Employee</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
        {users.map(u => (
          <TouchableOpacity key={u._id} style={[styles.chip, selectedId === u._id && styles.chipActive]} onPress={() => setSelectedId(u._id)}>
            <Text style={[styles.chipText, selectedId === u._id && styles.chipTextActive]}>{u.full_name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && <ActivityIndicator color={colors.primary} />}
      {!loading && balance && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>LEAVE BALANCE · {balance.year}</Text>
            {balance.types.map((t: any) => {
              const pct = t.quota > 0 ? Math.min(100, (t.used / t.quota) * 100) : 0;
              return (
                <View key={t.id} style={styles.balanceRow}>
                  <View style={[styles.dot, { backgroundColor: t.color }]} />
                  <Text style={styles.balanceName}>{t.name}</Text>
                  <View style={styles.balanceTrack}>
                    <View style={[styles.balanceBar, { width: `${pct}%` as any, backgroundColor: t.color }]} />
                  </View>
                  <Text style={styles.balanceVal}>{t.remaining}/{t.quota}</Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.cardSectionTitle, { marginTop: spacing.md }]}>LEAVE HISTORY ({leaves.length})</Text>
          {leaves.map((l: any) => (
            <View key={l._id} style={[styles.leaveRow, { marginBottom: spacing.sm }]}>
              <View style={[styles.dot, { backgroundColor: l.leave_type?.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.leaveName}>{l.leave_type?.name}</Text>
                <Text style={styles.leaveMeta}>{l.start_date} → {l.end_date} · {l.total_days} day{l.total_days !== 1 ? "s" : ""}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[l.status] || colors.textMuted) + "20" }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[l.status] || colors.textMuted }]}>{l.status}</Text>
              </View>
            </View>
          ))}
        </>
      )}
      {!loading && !balance && (
        <View style={styles.emptyBox}>
          <Ionicons name="person-outline" size={40} color={colors.border} />
          <Text style={styles.emptyTxt}>Select an employee to view their leave breakdown</Text>
        </View>
      )}
    </ScrollView>
  );
}

export default function LeavesScreen() {
  const { user } = useAuth();
  const isSupervisor = SUPERVISOR_ROLES.includes(user?.role || "");
  const [scope, setScope] = useState(isSupervisor ? "pending" : "mine");
  const [leaves, setLeaves] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [filters, setFilters] = useState({ search: "", type: "", status: "" });

  const tabs = [
    { id: "mine", label: "My Leaves" },
    ...(isSupervisor ? [{ id: "pending", label: "Pending" }] : []),
    ...(isSupervisor ? [{ id: "all", label: "All Leaves" }] : []),
    ...(isSupervisor ? [{ id: "employee", label: "By Employee" }] : []),
  ];

  const fetchLeaves = useCallback(async () => {
    if (scope === "employee") { setLoading(false); return; }
    setLoading(true);
    try { const r = await api.get(`/leaves?scope=${scope}`); setLeaves(r.data); }
    catch {} finally { setLoading(false); setRefreshing(false); }
  }, [scope]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);
  useEffect(() => {
    api.get("/leave-types").then(r => setTypes(r.data)).catch(() => {});
    api.get("/leaves/balance").then(r => setBalance(r.data)).catch(() => {});
  }, []);

  const handleApprove = async (id: string) => {
    try { await api.put(`/leaves/${id}/approve`); fetchLeaves(); }
    catch (err: any) { Alert.alert("Error", formatApiError(err)); }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await api.put(`/leaves/${rejectTarget}/reject`, { rejection_reason: rejectReason.trim() });
      setRejectTarget(null); setRejectReason(""); fetchLeaves();
    } catch (err: any) { Alert.alert("Error", formatApiError(err)); }
  };

  const handleCancel = (id: string) => {
    Alert.alert("Cancel Leave?", "This will cancel your leave request.", [
      { text: "No", style: "cancel" },
      { text: "Yes", style: "destructive", onPress: async () => {
        try { await api.delete(`/leaves/${id}`); fetchLeaves(); }
        catch (err: any) { Alert.alert("Error", formatApiError(err)); }
      }},
    ]);
  };

  const filtered = leaves.filter(l => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!(l.user?.name?.toLowerCase().includes(s) || l.reason?.toLowerCase().includes(s))) return false;
    }
    if (filters.type && l.leave_type?.id !== filters.type) return false;
    if (filters.status && l.status !== filters.status) return false;
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      {/* Balance row */}
      {balance && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.balanceScroll}>
          {balance.types.map((t: any) => {
            const pct = t.quota > 0 ? Math.min(100, (t.used / t.quota) * 100) : 0;
            return (
              <View key={t.id} style={styles.balanceCard}>
                <View style={[styles.dot, { backgroundColor: t.color }]} />
                <Text style={styles.balanceName}>{t.name}</Text>
                <Text style={styles.balanceBig}>{t.remaining}<Text style={styles.balanceOf}>/{t.quota}</Text></Text>
                <View style={styles.balanceTrack}>
                  <View style={[styles.balanceBar, { width: `${pct}%` as any, backgroundColor: t.color }]} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity key={t.id} style={[styles.tab, scope === t.id && styles.tabActive]} onPress={() => setScope(t.id)}>
            <Text style={[styles.tabText, scope === t.id && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.applyTabBtn} onPress={() => setApplyOpen(true)}>
          <Ionicons name="add-circle" size={14} color={colors.primary} />
          <Text style={styles.applyTabText}>Apply</Text>
        </TouchableOpacity>
      </ScrollView>

      {scope === "employee" ? (
        <ByEmployeeView types={types} />
      ) : (
        <>
          {/* Filters */}
          <View style={styles.filterRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={14} color={colors.textMuted} />
              <TextInput style={styles.searchInput} placeholder="Search..." placeholderTextColor={colors.textMuted}
                value={filters.search} onChangeText={v => setFilters(p => ({ ...p, search: v }))} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {["", "pending", "approved", "rejected", "cancelled"].map(s => (
                <TouchableOpacity key={s} style={[styles.chip, filters.status === s && styles.chipActive]} onPress={() => setFilters(p => ({ ...p, status: s }))}>
                  <Text style={[styles.chipText, filters.status === s && styles.chipTextActive]}>{s || "All"}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View> : (
            <FlatList
              data={filtered}
              keyExtractor={item => item._id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLeaves(); }} tintColor={colors.primary} />}
              contentContainerStyle={[{ padding: spacing.md, paddingBottom: spacing.xl }, filtered.length === 0 && { flexGrow: 1, justifyContent: "center" }]}
              ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Ionicons name="calendar-clear-outline" size={40} color={colors.border} />
                  <Text style={styles.emptyTxt}>{leaves.length === 0 ? "No leaves found" : "No leaves match filters"}</Text>
                </View>
              }
              renderItem={({ item: l }) => (
                <View style={styles.card}>
                  {scope !== "mine" && (
                    <View style={styles.leaveEmpRow}>
                      <View style={styles.avatar}><Text style={styles.avatarText}>{l.user?.name?.[0]?.toUpperCase()}</Text></View>
                      <Text style={styles.empName}>{l.user?.name}</Text>
                    </View>
                  )}
                  <View style={styles.leaveRow}>
                    <View style={[styles.dot, { backgroundColor: l.leave_type?.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leaveName}>{l.leave_type?.name}</Text>
                      <Text style={styles.leaveMeta}>{l.start_date} → {l.end_date}{l.half_day ? " (½)" : ""} · {l.total_days} day{l.total_days !== 1 ? "s" : ""}</Text>
                      {l.reason && <Text style={styles.leaveReason} numberOfLines={2}>{l.reason}</Text>}
                      {l.supervisor?.name && <Text style={styles.leaveSuper}>Supervisor: {l.supervisor.name}</Text>}
                      {l.rejection_reason && <Text style={styles.rejectionReason}>Rejected: {l.rejection_reason}</Text>}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: spacing.sm }}>
                      <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[l.status] || colors.textMuted) + "20" }]}>
                        <Text style={[styles.statusText, { color: STATUS_COLORS[l.status] || colors.textMuted }]}>{l.status}</Text>
                      </View>
                      {l.status === "pending" && isSupervisor && (
                        <View style={{ flexDirection: "row", gap: spacing.xs }}>
                          <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(l._id)}>
                            <Ionicons name="checkmark" size={14} color={colors.success} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.rejectBtn} onPress={() => setRejectTarget(l._id)}>
                            <Ionicons name="close" size={14} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      )}
                      {l.status === "pending" && (l.user?.id === user?.id || l.user?._id === user?.id) && (
                        <TouchableOpacity onPress={() => handleCancel(l._id)}>
                          <Ionicons name="trash-outline" size={15} color={colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              )}
            />
          )}
        </>
      )}

      {applyOpen && <ApplyLeaveModal onClose={() => setApplyOpen(false)} onSaved={() => { setApplyOpen(false); fetchLeaves(); api.get("/leaves/balance").then(r => setBalance(r.data)).catch(() => {}); }} />}

      {/* Reject modal */}
      <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={() => setRejectTarget(null)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Reject this leave?</Text>
            <TextInput style={[styles.input, { marginTop: spacing.sm, height: 80, textAlignVertical: "top" }]}
              value={rejectReason} onChangeText={setRejectReason} placeholder="Reason (optional)" placeholderTextColor={colors.textMuted} multiline />
            <View style={[styles.row2, { marginTop: spacing.md }]}>
              <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={() => { setRejectTarget(null); setRejectReason(""); }}>
                <Text style={styles.outlineBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerBtn, { flex: 1 }]} onPress={handleReject}>
                <Text style={styles.primaryBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  balanceScroll: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm, paddingLeft: spacing.md, maxHeight: 90, flexGrow: 0 },
  balanceCard: { width: 110, marginRight: spacing.sm, backgroundColor: colors.card, borderRadius: radius.sm, padding: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  balanceName: { fontSize: 9, fontWeight: "700", color: colors.textMuted, marginBottom: 2 },
  balanceBig: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  balanceOf: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: "400" },
  balanceTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden", marginTop: 4 },
  balanceBar: { height: "100%", borderRadius: 2 },
  tabBar: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.sm, flexGrow: 0 },
  tab: { paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  applyTabBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 12 },
  applyTabText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.primary },
  filterRow: { backgroundColor: colors.background, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, height: 36 },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs, flexDirection: "row", alignItems: "center", gap: 4 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  card: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, elevation: 1 },
  leaveEmpRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + "20", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: fontSize.xs, fontWeight: "700", color: colors.primary },
  empName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  leaveRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  leaveName: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
  leaveMeta: { fontSize: fontSize.xs, color: colors.textMuted },
  leaveReason: { fontSize: fontSize.xs, color: colors.text, marginTop: 2 },
  leaveSuper: { fontSize: fontSize.xs, color: colors.textMuted },
  rejectionReason: { fontSize: fontSize.xs, color: colors.danger, marginTop: 2 },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: fontSize.xs, fontWeight: "700" },
  approveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.success + "20", justifyContent: "center", alignItems: "center" },
  rejectBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.danger + "20", justifyContent: "center", alignItems: "center" },
  emptyBox: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTxt: { fontSize: fontSize.base, color: colors.textMuted, textAlign: "center" },
  // Employee view
  balanceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  balanceName2: { width: 80, fontSize: fontSize.xs, color: colors.text },
  balanceVal: { fontSize: fontSize.xs, color: colors.textMuted, width: 40, textAlign: "right" },
  cardSectionTitle: { fontSize: 9, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.sm },
  // Modal
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  modalBody: { flex: 1, padding: spacing.md },
  fieldLabel: { fontSize: fontSize.xs, fontWeight: "700", color: colors.textMuted, marginBottom: 6, marginTop: spacing.md },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.xs },
  row2: { flexDirection: "row", gap: spacing.sm },
  checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.border, justifyContent: "center", alignItems: "center" },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { fontSize: fontSize.sm, color: colors.text },
  infoBanner: { backgroundColor: colors.primary + "15", borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.md },
  infoText: { fontSize: fontSize.sm, color: colors.text },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.base },
  outlineBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  outlineBtnText: { color: colors.textMuted, fontSize: fontSize.base },
  dangerBtn: { backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: spacing.lg },
  dialog: { backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.lg, width: "100%" },
  dialogTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
});
