import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
  TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, formatApiError } from "../../api/client";
import { colors, spacing, radius, fontSize } from "../../theme";

interface Category { _id: string; category_name: string; color_code?: string; description?: string; is_default?: boolean; subscription_count?: number; }
interface LeaveType { _id: string; name: string; default_days: number; description?: string; carry_forward?: boolean; is_paid?: boolean; allow_half_day?: boolean; }

const PRESET_COLORS = ["#009d44","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#ec4899","#14b8a6","#f97316","#64748b"];

function CatModal({ visible, item, onClose, onSave }: {
  visible: boolean; item: Category | null; onClose: () => void; onSave: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (item) { setName(item.category_name); setColor(item.color_code || PRESET_COLORS[0]); setDescription(item.description || ""); }
    else { setName(""); setColor(PRESET_COLORS[0]); setDescription(""); }
    setError("");
  }, [item, visible]);

  const save = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      if (item) await api.put(`/categories/${item._id}`, { category_name: name.trim(), color_code: color, description });
      else await api.post("/categories", { category_name: name.trim(), color_code: color, description });
      onSave();
    } catch (e) { setError(formatApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onClose}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
        <Text style={styles.modalTitle}>{item ? "Edit Category" : "New Category"}</Text>
        <TouchableOpacity onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.modalSave}>Save</Text>}
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Category name" placeholderTextColor={colors.textMuted} />
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={styles.input} value={description} onChangeText={setDescription}
            placeholder="Optional" placeholderTextColor={colors.textMuted} />
          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.colorGrid}>
            {PRESET_COLORS.map(c => (
              <TouchableOpacity key={c} onPress={() => setColor(c)}
                style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchSelected]} />
            ))}
          </View>
          {/* Preview */}
          <View style={[styles.colorPreview, { backgroundColor: color }]}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>{name || "Preview"}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function LeaveTypeModal({ visible, item, onClose, onSave }: {
  visible: boolean; item: LeaveType | null; onClose: () => void; onSave: () => void;
}) {
  const [name, setName] = useState("");
  const [days, setDays] = useState("0");
  const [description, setDescription] = useState("");
  const [carryForward, setCarryForward] = useState(false);
  const [isPaid, setIsPaid] = useState(true);
  const [allowHalfDay, setAllowHalfDay] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (item) {
      setName(item.name); setDays(String(item.default_days));
      setDescription(item.description || ""); setCarryForward(item.carry_forward || false);
      setIsPaid(item.is_paid !== false); setAllowHalfDay(item.allow_half_day !== false);
    } else { setName(""); setDays("0"); setDescription(""); setCarryForward(false); setIsPaid(true); setAllowHalfDay(true); }
    setError("");
  }, [item, visible]);

  const save = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      const payload = { name: name.trim(), default_days: parseInt(days) || 0, description, carry_forward: carryForward, is_paid: isPaid, allow_half_day: allowHalfDay };
      if (item) await api.put(`/leave-types/${item._id}`, payload);
      else await api.post("/leave-types", payload);
      onSave();
    } catch (e) { setError(formatApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onClose}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
        <Text style={styles.modalTitle}>{item ? "Edit Leave Type" : "New Leave Type"}</Text>
        <TouchableOpacity onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.modalSave}>Save</Text>}
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="e.g. Sick Leave" placeholderTextColor={colors.textMuted} />
          <Text style={styles.fieldLabel}>Default Days Per Year</Text>
          <TextInput style={styles.input} value={days} onChangeText={setDays}
            keyboardType="numeric" placeholder="12" placeholderTextColor={colors.textMuted} />
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={styles.input} value={description} onChangeText={setDescription}
            placeholder="Optional" placeholderTextColor={colors.textMuted} />
          <TouchableOpacity style={styles.toggleRow} onPress={() => setIsPaid(v => !v)}>
            <View style={[styles.toggleBox, isPaid && styles.toggleBoxOn]}>
              {isPaid && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.toggleLabel}>Paid leave</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleRow} onPress={() => setAllowHalfDay(v => !v)}>
            <View style={[styles.toggleBox, allowHalfDay && styles.toggleBoxOn]}>
              {allowHalfDay && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.toggleLabel}>Allow half-day</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleRow} onPress={() => setCarryForward(v => !v)}>
            <View style={[styles.toggleBox, carryForward && styles.toggleBoxOn]}>
              {carryForward && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.toggleLabel}>Allow carry forward</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CategoriesScreen() {
  const [tab, setTab] = useState<"subs" | "leaves">("subs");
  const [cats, setCats] = useState<Category[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [editLeave, setEditLeave] = useState<LeaveType | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [cRes, lRes] = await Promise.all([
        api.get("/categories"),
        api.get("/leave-types"),
      ]);
      setCats(cRes.data || []);
      setLeaveTypes(lRes.data || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const deleteCat = (cat: Category) => {
    Alert.alert("Delete Category", `Delete "${cat.category_name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try { await api.delete(`/categories/${cat._id}`); fetchData(); }
          catch (e) { Alert.alert("Error", formatApiError(e)); }
        }
      }
    ]);
  };

  const deleteLeave = (lt: LeaveType) => {
    Alert.alert("Delete Leave Type", `Delete "${lt.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try { await api.delete(`/leave-types/${lt._id}`); fetchData(); }
          catch (e) { Alert.alert("Error", formatApiError(e)); }
        }
      }
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Tab + Add */}
      <View style={styles.topBar}>
        <View style={styles.tabPills}>
          <TouchableOpacity onPress={() => setTab("subs")}
            style={[styles.tabPill, tab === "subs" && styles.tabPillActive]}>
            <Text style={[styles.tabPillText, tab === "subs" && styles.tabPillTextActive]}>Subscription</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab("leaves")}
            style={[styles.tabPill, tab === "leaves" && styles.tabPillActive]}>
            <Text style={[styles.tabPillText, tab === "leaves" && styles.tabPillTextActive]}>Leave Types</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => {
          if (tab === "subs") { setEditCat(null); setShowCatModal(true); }
          else { setEditLeave(null); setShowLeaveModal(true); }
        }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {tab === "subs" ? (
        <FlatList
          data={cats}
          keyExtractor={c => c._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.colorDot, { backgroundColor: item.color_code || colors.primary }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.rowTitleRow}>
                  <Text style={styles.rowName}>{item.category_name}</Text>
                  {item.is_default && (
                    <View style={styles.miniTag}><Text style={styles.miniTagText}>Default</Text></View>
                  )}
                </View>
                <Text style={styles.rowSub}>
                  {item.subscription_count != null ? `${item.subscription_count} subscription${item.subscription_count !== 1 ? "s" : ""}` : ""}
                  {item.description ? (item.subscription_count != null ? " · " : "") + item.description : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setEditCat(item); setShowCatModal(true); }} style={styles.iconBtn}>
                <Ionicons name="pencil" size={16} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteCat(item)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>No categories yet</Text></View>}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        />
      ) : (
        <FlatList
          data={leaveTypes}
          keyExtractor={lt => lt._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.colorDot, { backgroundColor: colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowSub}>{item.default_days} days/year{item.carry_forward ? " · Carry forward" : ""}</Text>
                {item.description ? <Text style={styles.rowSub}>{item.description}</Text> : null}
                <View style={styles.badgeRow}>
                  {item.is_paid !== false && (
                    <View style={[styles.miniTag, { backgroundColor: colors.success + "20" }]}>
                      <Text style={[styles.miniTagText, { color: colors.success }]}>Paid</Text>
                    </View>
                  )}
                  {item.allow_half_day !== false && (
                    <View style={[styles.miniTag, { backgroundColor: colors.info + "20" }]}>
                      <Text style={[styles.miniTagText, { color: colors.info }]}>Half-day OK</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => { setEditLeave(item); setShowLeaveModal(true); }} style={styles.iconBtn}>
                <Ionicons name="pencil" size={16} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteLeave(item)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>No leave types yet</Text></View>}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        />
      )}

      <CatModal visible={showCatModal} item={editCat}
        onClose={() => setShowCatModal(false)} onSave={() => { setShowCatModal(false); fetchData(); }} />
      <LeaveTypeModal visible={showLeaveModal} item={editLeave}
        onClose={() => setShowLeaveModal(false)} onSave={() => { setShowLeaveModal(false); fetchData(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    padding: spacing.sm, backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabPills: { flex: 1, flexDirection: "row", gap: spacing.xs },
  tabPill: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabPillText: { fontSize: fontSize.xs, color: colors.textMuted },
  tabPillTextActive: { color: "#fff", fontWeight: "600" },
  addBtn: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
  },
  row: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.background,
    borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, elevation: 1,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6 },
  rowTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  rowName: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
  rowSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: spacing.xs, marginTop: 4, flexWrap: "wrap" },
  miniTag: { backgroundColor: colors.border, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  miniTagText: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
  iconBtn: {
    width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.card,
    justifyContent: "center", alignItems: "center",
  },
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
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  colorSwatch: { width: 36, height: 36, borderRadius: 18 },
  colorSwatchSelected: { borderWidth: 3, borderColor: colors.text },
  colorPreview: { borderRadius: radius.md, padding: spacing.md, alignItems: "center", marginBottom: spacing.md },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  toggleBox: {
    width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: colors.border,
    justifyContent: "center", alignItems: "center",
  },
  toggleBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleLabel: { fontSize: fontSize.sm, color: colors.text },
  errorText: { color: colors.danger, fontSize: fontSize.sm, marginBottom: spacing.sm },
});
