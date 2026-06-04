import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
  TouchableOpacity, TextInput, Modal, ScrollView, Alert, Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, formatCurrency, getDueStatus, formatApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing, radius, fontSize } from "../../theme";
import DatePickerField from "../../components/DatePickerField";

const BILLING_CYCLES = ["Monthly", "Quarterly", "Semi-Annual", "Annual", "One Time", "Custom"];
const STATUSES_LIST = ["Active", "Inactive", "Trial", "Cancelled"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP"];
const TOP_ROLES = ["Director", "Admin", "MD"];

const STATUS_COLORS: Record<string, string> = {
  Active: colors.success, Inactive: colors.textMuted, Trial: colors.info, Cancelled: colors.danger,
};

function SubModal({ sub, categories, people, onClose, onSaved, onPeopleAdded, isTopRole }: any) {
  const isEdit = !!sub;
  const [form, setForm] = useState({
    subscription_name: sub?.subscription_name || "",
    cost: sub?.cost ? String(sub.cost) : "",
    currency: sub?.currency || "INR",
    billing_cycle: sub?.billing_cycle || "Monthly",
    next_due_date: sub?.next_due_date?.slice(0, 10) || "",
    category_id: sub?.category_id || "",
    responsible_person_id: sub?.responsible_person_id || "",
    assigned_user_id: sub?.owner_id || "",
    status: sub?.status || "Active",
    management_link: sub?.management_link || "",
    payment_method: sub?.payment_method || "",
    notes: sub?.notes || "",
  });
  const [loading, setLoading] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [localPeople, setLocalPeople] = useState(people || []);
  const [users, setUsers] = useState<any[]>([]);

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const isOneTime = form.billing_cycle === "One Time";

  useEffect(() => {
    if (isTopRole) {
      api.get("/users").then(r => setUsers(r.data.filter((u: any) => u.is_active))).catch(() => {});
    }
  }, [isTopRole]);

  const handleAddPerson = async () => {
    if (!newPersonName.trim()) return;
    setAddingPerson(true);
    try {
      const res = await api.post("/people", { name: newPersonName.trim() });
      const updated = [...localPeople, res.data];
      setLocalPeople(updated);
      set("responsible_person_id", res.data._id);
      setNewPersonName(""); setShowAddPerson(false);
      if (onPeopleAdded) onPeopleAdded();
    } catch (err: any) { Alert.alert("Error", formatApiError(err)); }
    finally { setAddingPerson(false); }
  };

  const handleSubmit = async () => {
    if (!form.subscription_name || !form.cost || !form.billing_cycle) {
      return Alert.alert("Error", "Please fill required fields (name, cost, billing cycle)");
    }
    if (!isOneTime && !form.next_due_date) {
      return Alert.alert("Error", "Please set a due date");
    }
    setLoading(true);
    try {
      const payload: any = {
        ...form,
        cost: parseFloat(form.cost),
        category_id: form.category_id || null,
        responsible_person_id: form.responsible_person_id || null,
        management_link: form.management_link || null,
        payment_method: form.payment_method || null,
        notes: form.notes || null,
        next_due_date: isOneTime ? (form.next_due_date || new Date().toISOString().slice(0, 10)) : form.next_due_date,
      };
      if (isTopRole && form.assigned_user_id) {
        payload.assigned_user_id = form.assigned_user_id;
      } else {
        delete payload.assigned_user_id;
      }
      if (isEdit) await api.put(`/subscriptions/${sub._id}`, payload);
      else await api.post("/subscriptions", payload);
      onSaved();
    } catch (err: any) { Alert.alert("Error", formatApiError(err)); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{isEdit ? "Edit Subscription" : "Add Subscription"}</Text>
        <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
      </View>
      <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Subscription Name *</Text>
        <TextInput style={styles.input} value={form.subscription_name} onChangeText={v => set("subscription_name", v)} placeholder="e.g. Netflix, AWS" placeholderTextColor={colors.textMuted} />

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Cost *</Text>
            <TextInput style={styles.input} value={form.cost} onChangeText={v => set("cost", v)} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Currency</Text>
            <View style={styles.segmented}>
              {CURRENCIES.map(c => (
                <TouchableOpacity key={c} style={[styles.segBtn, form.currency === c && styles.segBtnActive]} onPress={() => set("currency", c)}>
                  <Text style={[styles.segText, form.currency === c && styles.segTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Billing Cycle *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {BILLING_CYCLES.map(c => (
            <TouchableOpacity key={c} style={[styles.chip, form.billing_cycle === c && styles.chipActive]} onPress={() => set("billing_cycle", c)}>
              <Text style={[styles.chipText, form.billing_cycle === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {isOneTime && <Text style={styles.infoText}>One-time cost won't appear in monthly/annual totals</Text>}

        {!isOneTime && (
          <>
            <Text style={styles.fieldLabel}>Next Due Date *</Text>
            <DatePickerField
              value={form.next_due_date}
              onChange={v => set("next_due_date", v)}
              placeholder="Select due date"
              minDate={new Date().toISOString().slice(0, 10)}
            />
          </>
        )}

        <Text style={styles.fieldLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <TouchableOpacity style={[styles.chip, !form.category_id && styles.chipActive]} onPress={() => set("category_id", "")}>
            <Text style={[styles.chipText, !form.category_id && styles.chipTextActive]}>None</Text>
          </TouchableOpacity>
          {categories.map((c: any) => (
            <TouchableOpacity key={c._id} style={[styles.chip, form.category_id === c._id && styles.chipActive]} onPress={() => set("category_id", c._id)}>
              <View style={[styles.catDot, { backgroundColor: c.color_code }]} />
              <Text style={[styles.chipText, form.category_id === c._id && styles.chipTextActive]}>{c.category_name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Assign to User — top roles only */}
        {isTopRole && (
          <>
            <Text style={styles.fieldLabel}>Assign to User</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
              <TouchableOpacity
                style={[styles.chip, !form.assigned_user_id && styles.chipActive]}
                onPress={() => set("assigned_user_id", "")}
              >
                <Text style={[styles.chipText, !form.assigned_user_id && styles.chipTextActive]}>My Account</Text>
              </TouchableOpacity>
              {users.map((u: any) => (
                <TouchableOpacity
                  key={u._id}
                  style={[styles.chip, form.assigned_user_id === u._id && styles.chipActive]}
                  onPress={() => set("assigned_user_id", u._id)}
                >
                  <Text style={[styles.chipText, form.assigned_user_id === u._id && styles.chipTextActive]}>
                    {u.full_name} ({u.role})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.assignHint}>Subscription will appear under the selected user's account.</Text>
          </>
        )}

        <Text style={styles.fieldLabel}>Responsible Person</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xs }}>
          <TouchableOpacity style={[styles.chip, !form.responsible_person_id && styles.chipActive]} onPress={() => set("responsible_person_id", "")}>
            <Text style={[styles.chipText, !form.responsible_person_id && styles.chipTextActive]}>None</Text>
          </TouchableOpacity>
          {localPeople.map((p: any) => (
            <TouchableOpacity key={p._id} style={[styles.chip, form.responsible_person_id === p._id && styles.chipActive]} onPress={() => set("responsible_person_id", p._id)}>
              <Text style={[styles.chipText, form.responsible_person_id === p._id && styles.chipTextActive]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.addPersonBtn} onPress={() => setShowAddPerson(p => !p)}>
          <Ionicons name="person-add-outline" size={14} color={colors.primary} />
          <Text style={styles.addPersonText}>Add new person</Text>
        </TouchableOpacity>
        {showAddPerson && (
          <View style={[styles.row2, { marginTop: spacing.sm }]}>
            <TextInput style={[styles.input, { flex: 1 }]} value={newPersonName} onChangeText={setNewPersonName} placeholder="Person name" placeholderTextColor={colors.textMuted} />
            <TouchableOpacity style={[styles.primaryBtn, { marginLeft: spacing.sm }]} onPress={handleAddPerson} disabled={addingPerson}>
              <Text style={styles.primaryBtnText}>{addingPerson ? "..." : "Add"}</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.fieldLabel}>Status</Text>
        <View style={styles.segmented}>
          {STATUSES_LIST.map(s => (
            <TouchableOpacity key={s} style={[styles.segBtn, form.status === s && styles.segBtnActive]} onPress={() => set("status", s)}>
              <Text style={[styles.segText, form.status === s && styles.segTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Payment Method</Text>
        <TextInput style={styles.input} value={form.payment_method} onChangeText={v => set("payment_method", v)} placeholder="e.g. Credit Card, UPI" placeholderTextColor={colors.textMuted} />

        <Text style={styles.fieldLabel}>Management Link</Text>
        <TextInput style={styles.input} value={form.management_link} onChangeText={v => set("management_link", v)} placeholder="https://..." placeholderTextColor={colors.textMuted} autoCapitalize="none" />

        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]} value={form.notes} onChangeText={v => set("notes", v)} placeholder="Additional notes..." placeholderTextColor={colors.textMuted} multiline />

        <View style={styles.row2}>
          <TouchableOpacity style={[styles.outlineBtn, { flex: 1 }]} onPress={onClose}>
            <Text style={styles.outlineBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginLeft: spacing.sm }]} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.primaryBtnText}>{loading ? "Saving..." : isEdit ? "Update" : "Add Subscription"}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </Modal>
  );
}

export default function SubscriptionsScreen() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSub, setEditSub] = useState<any>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSubs, setArchivedSubs] = useState<any[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "", category_id: "", billing_cycle: "", responsible_person_id: "" });

  const isTopRole = TOP_ROLES.includes(user?.role || "");

  // Determine view permission: top roles always write, others check module_permissions
  const subPerm = user?.module_permissions?.subscriptions;
  const subAccess = typeof subPerm === "string" ? subPerm : (subPerm as any)?.access;
  const isViewer = subAccess === "view" || (!subPerm && !isTopRole);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.billing_cycle) params.billing_cycle = filters.billing_cycle;
      if (filters.responsible_person_id) params.responsible_person_id = filters.responsible_person_id;
      const res = await api.get("/subscriptions", { params });
      setSubs(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [filters]);

  const fetchMeta = async () => {
    try {
      const [c, p] = await Promise.all([api.get("/categories"), api.get("/people")]);
      setCategories(c.data); setPeople(p.data);
    } catch {}
  };

  const fetchArchived = async () => {
    try { const r = await api.get("/subscriptions/archived"); setArchivedSubs(r.data); } catch {}
  };

  useEffect(() => { fetchSubs(); }, [fetchSubs]);
  useEffect(() => { fetchMeta(); }, []);

  const handleDelete = (id: string) => {
    Alert.alert("Delete Subscription?", "It will be archived and can be restored by an admin.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try { await api.delete(`/subscriptions/${id}`); fetchSubs(); }
        catch (err: any) { Alert.alert("Error", formatApiError(err)); }
      }},
    ]);
  };

  const handleRestore = async (id: string) => {
    try { await api.put(`/subscriptions/${id}/restore`); fetchArchived(); fetchSubs(); }
    catch (err: any) { Alert.alert("Error", formatApiError(err)); }
  };

  const hasFilters = Object.values(filters).some(Boolean);

  const renderSub = ({ item }: { item: any }) => {
    const due = getDueStatus(item.next_due_date);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            {item.category && <View style={[styles.catDot, { backgroundColor: item.category.color }]} />}
            <Text style={styles.subName} numberOfLines={1}>{item.subscription_name}</Text>
          </View>
          <Text style={styles.subCost}>{formatCurrency(item.cost, item.currency)}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>{item.billing_cycle}</Text>
          {item.category && <Text style={styles.metaText}> · {item.category.name}</Text>}
          {item.responsible_person && <Text style={styles.metaText}> · {item.responsible_person.name}</Text>}
          {item.added_by && <Text style={styles.metaText}> · by {item.added_by}</Text>}
        </View>
        <View style={styles.cardFooter}>
          <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] || colors.textMuted) + "20" }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || colors.textMuted }]}>{item.status}</Text>
          </View>
          {item.billing_cycle !== "One Time" && item.next_due_date && (
            <Text style={[styles.dueText, { color: due.color }]}>{due.label}</Text>
          )}
          {!isViewer && (
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => { setEditSub(item); setModalOpen(true); }} style={styles.actionBtn}>
                <Ionicons name="pencil-outline" size={15} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      {/* Search + Add */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search subscriptions..." placeholderTextColor={colors.textMuted}
            value={filters.search} onChangeText={v => setFilters(p => ({ ...p, search: v }))} />
        </View>
        <TouchableOpacity style={[styles.iconBtn, hasFilters && { backgroundColor: colors.primary + "20" }]} onPress={() => setShowFilters(p => !p)}>
          <Ionicons name="filter-outline" size={18} color={hasFilters ? colors.primary : colors.text} />
        </TouchableOpacity>
        {!isViewer && (
          <TouchableOpacity style={styles.addBtn} onPress={() => { setEditSub(null); setModalOpen(true); }}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            {["", "Active", "Inactive", "Trial", "Cancelled"].map(s => (
              <TouchableOpacity key={s} style={[styles.chip, filters.status === s && styles.chipActive]} onPress={() => setFilters(p => ({ ...p, status: s }))}>
                <Text style={[styles.chipText, filters.status === s && styles.chipTextActive]}>{s || "All Status"}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            {["", ...BILLING_CYCLES].map(c => (
              <TouchableOpacity key={c} style={[styles.chip, filters.billing_cycle === c && styles.chipActive]} onPress={() => setFilters(p => ({ ...p, billing_cycle: c }))}>
                <Text style={[styles.chipText, filters.billing_cycle === c && styles.chipTextActive]}>{c || "All Cycles"}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[{ _id: "", category_name: "All Categories" }, ...categories].map((c: any) => (
              <TouchableOpacity key={c._id} style={[styles.chip, filters.category_id === c._id && styles.chipActive]} onPress={() => setFilters(p => ({ ...p, category_id: c._id }))}>
                <Text style={[styles.chipText, filters.category_id === c._id && styles.chipTextActive]}>{c.category_name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {hasFilters && (
            <TouchableOpacity onPress={() => setFilters({ search: "", status: "", category_id: "", billing_cycle: "", responsible_person_id: "" })} style={{ alignSelf: "flex-end", marginTop: spacing.sm }}>
              <Text style={{ color: colors.danger, fontSize: fontSize.sm }}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Archived toggle — Director / Admin / MD */}
      {isTopRole && (
        <TouchableOpacity style={styles.archivedToggle} onPress={() => { setShowArchived(p => !p); if (!showArchived) fetchArchived(); }}>
          <Ionicons name="archive-outline" size={14} color={colors.textMuted} />
          <Text style={styles.archivedToggleText}>{showArchived ? "Hide Archived" : "Show Archived"}</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={subs}
          keyExtractor={item => item._id}
          renderItem={renderSub}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSubs(); }} tintColor={colors.primary} />}
          contentContainerStyle={[styles.list, subs.length === 0 && styles.emptyList]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListFooterComponent={showArchived && archivedSubs.length > 0 ? (
            <View style={styles.archivedSection}>
              <Text style={styles.archivedTitle}>ARCHIVED ({archivedSubs.length})</Text>
              {archivedSubs.map(sub => (
                <View key={sub._id} style={styles.archivedRow}>
                  <Text style={styles.archivedName}>{sub.subscription_name}</Text>
                  <Text style={styles.archivedCost}>{formatCurrency(sub.cost, sub.currency)}</Text>
                  <TouchableOpacity onPress={() => handleRestore(sub._id)} style={styles.restoreBtn}>
                    <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                    <Text style={styles.restoreBtnText}>Restore</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="card-outline" size={48} color={colors.border} />
              <Text style={styles.emptyTxt}>No subscriptions found</Text>
              {!isViewer && <TouchableOpacity onPress={() => { setEditSub(null); setModalOpen(true); }}><Text style={{ color: colors.primary, marginTop: 4 }}>Add your first subscription</Text></TouchableOpacity>}
            </View>
          }
        />
      )}

      {modalOpen && (
        <SubModal
          sub={editSub}
          categories={categories}
          people={people}
          isTopRole={isTopRole}
          onPeopleAdded={fetchMeta}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); fetchSubs(); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.sm },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, height: 42 },
  searchInput: { flex: 1, fontSize: fontSize.base, color: colors.text },
  iconBtn: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  addBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  filterPanel: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, padding: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm, flexDirection: "row", alignItems: "center", gap: 4 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  archivedToggle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  archivedToggleText: { fontSize: fontSize.sm, color: colors.textMuted },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  emptyBox: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTxt: { fontSize: fontSize.base, color: colors.textMuted },
  card: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, elevation: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  subName: { fontSize: fontSize.base, fontWeight: "700", color: colors.text, flex: 1 },
  subCost: { fontSize: fontSize.base, fontWeight: "700", color: colors.primary },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.sm },
  metaText: { fontSize: fontSize.xs, color: colors.textMuted },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: fontSize.xs, fontWeight: "700" },
  dueText: { fontSize: fontSize.xs, fontWeight: "700", flex: 1 },
  actions: { flexDirection: "row", gap: spacing.xs, marginLeft: "auto" },
  actionBtn: { padding: spacing.xs },
  archivedSection: { marginTop: spacing.md, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md },
  archivedTitle: { fontSize: 9, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.sm },
  archivedRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  archivedName: { flex: 1, fontSize: fontSize.sm, color: colors.textMuted },
  archivedCost: { fontSize: fontSize.sm, color: colors.textMuted, marginRight: spacing.sm },
  restoreBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  restoreBtnText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: "600" },
  // Modal
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  modalBody: { flex: 1, padding: spacing.md },
  fieldLabel: { fontSize: fontSize.xs, fontWeight: "700", color: colors.textMuted, marginBottom: 6, marginTop: spacing.md },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.xs },
  row2: { flexDirection: "row", gap: spacing.sm },
  segmented: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.md },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  segBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: fontSize.xs, color: colors.textMuted },
  segTextActive: { color: "#fff", fontWeight: "700" },
  infoText: { fontSize: fontSize.xs, color: colors.info, marginBottom: spacing.md },
  assignHint: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm },
  addPersonBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: spacing.sm },
  addPersonText: { fontSize: fontSize.sm, color: colors.primary },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.base },
  outlineBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
  outlineBtnText: { color: colors.textMuted, fontSize: fontSize.base },
});
