import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
  TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, formatApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing, radius, fontSize } from "../../theme";

const ROLE_COLORS: Record<string, string> = {
  Director: colors.purple, Admin: colors.danger, MD: colors.warning,
  Manager: colors.info, Employee: colors.success,
};
const ROLES = ["Employee", "Manager", "Admin", "Director", "MD"];
const MODULES = ["subscriptions", "reports", "categories", "users"] as const;
const ACCESS_LEVELS = ["none", "view", "edit"] as const;
const SCOPES_MAP = {
  subscriptions: ["all", "own"],
  reports: ["all", "own"],
  categories: ["all"],
  users: ["all"],
} as const;

type Module = typeof MODULES[number];
type AccessLevel = typeof ACCESS_LEVELS[number];

interface UserPermissions {
  subscriptions?: { access: AccessLevel; scope?: string };
  reports?: { access: AccessLevel; scope?: string };
  categories?: { access: AccessLevel; scope?: string };
  users?: { access: AccessLevel; scope?: string };
}
interface User {
  _id: string; full_name: string; email: string; role: string;
  is_active: boolean; permissions?: UserPermissions; manager_id?: string;
  phone?: string; dob?: string; blood_group?: string;
  emergency_contact?: string; emergency_phone?: string;
}
interface Manager { _id: string; full_name: string; }

function UserModal({ visible, user, managers, onClose, onSave }: {
  visible: boolean; user: User | null; managers: Manager[];
  onClose: () => void; onSave: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Employee");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [managerId, setManagerId] = useState("");
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"info" | "perms">("info");

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || ""); setEmail(user.email || ""); setRole(user.role || "Employee");
      setPhone(user.phone || ""); setDob(user.dob || ""); setBloodGroup(user.blood_group || "");
      setEmergencyContact(user.emergency_contact || ""); setEmergencyPhone(user.emergency_phone || "");
      setManagerId(user.manager_id || "");
      setPermissions(user.permissions || {}); setPassword("");
    } else {
      setFullName(""); setEmail(""); setRole("Employee"); setPassword(""); setPhone("");
      setDob(""); setBloodGroup(""); setEmergencyContact(""); setEmergencyPhone("");
      setManagerId(""); setPermissions({});
    }
    setError(""); setTab("info");
  }, [user, visible]);

  const setModuleAccess = (mod: Module, access: AccessLevel) => {
    setPermissions(prev => ({
      ...prev,
      [mod]: { ...prev[mod], access, scope: access === "none" ? undefined : (prev[mod]?.scope || "all") },
    }));
  };
  const setModuleScope = (mod: Module, scope: string) => {
    setPermissions(prev => ({ ...prev, [mod]: { ...prev[mod], scope } }));
  };

  const save = async () => {
    if (!fullName.trim() || !email.trim()) { setError("Name and email required"); return; }
    if (!user && !password) { setError("Password required for new user"); return; }
    setSaving(true); setError("");
    try {
      const payload: any = {
        full_name: fullName, email, role, permissions, phone, dob, blood_group: bloodGroup,
        emergency_contact: emergencyContact, emergency_phone: emergencyPhone,
        manager_id: managerId || null,
      };
      if (password) payload.password = password;
      if (user) await api.put(`/users/${user._id}`, payload);
      else await api.post("/users", payload);
      onSave();
    } catch (e) { setError(formatApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onClose}><Text style={styles.modalCancel}>Cancel</Text></TouchableOpacity>
        <Text style={styles.modalTitle}>{user ? "Edit User" : "New User"}</Text>
        <TouchableOpacity onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.modalSave}>Save</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.modalTabs}>
        {(["info", "perms"] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[styles.modalTab, tab === t && styles.modalTabActive]}>
            <Text style={[styles.modalTabText, tab === t && styles.modalTabTextActive]}>
              {t === "info" ? "Info" : "Permissions"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {tab === "info" && (
            <>
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput style={styles.input} value={fullName} onChangeText={setFullName}
                placeholder="John Doe" placeholderTextColor={colors.textMuted} />
              <Text style={styles.fieldLabel}>Email *</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail}
                placeholder="john@company.com" placeholderTextColor={colors.textMuted}
                autoCapitalize="none" keyboardType="email-address" />
              <Text style={styles.fieldLabel}>{user ? "New Password (leave blank to keep)" : "Password *"}</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword}
                placeholder="••••••••" placeholderTextColor={colors.textMuted} secureTextEntry />
              <Text style={styles.fieldLabel}>Role</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                {ROLES.map(r => (
                  <TouchableOpacity key={r} onPress={() => setRole(r)}
                    style={[styles.chip, role === r && { backgroundColor: ROLE_COLORS[r] || colors.primary, borderColor: ROLE_COLORS[r] || colors.primary }]}>
                    <Text style={[styles.chipText, role === r && { color: "#fff" }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone}
                placeholder="+91 9999999999" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
              <Text style={styles.fieldLabel}>Date of Birth (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={dob} onChangeText={setDob}
                placeholder="1990-01-01" placeholderTextColor={colors.textMuted} />
              <Text style={styles.fieldLabel}>Blood Group</Text>
              <TextInput style={styles.input} value={bloodGroup} onChangeText={setBloodGroup}
                placeholder="O+" placeholderTextColor={colors.textMuted} />
              <Text style={styles.fieldLabel}>Emergency Contact Name</Text>
              <TextInput style={styles.input} value={emergencyContact} onChangeText={setEmergencyContact}
                placeholder="Jane Doe" placeholderTextColor={colors.textMuted} />
              <Text style={styles.fieldLabel}>Emergency Contact Phone</Text>
              <TextInput style={styles.input} value={emergencyPhone} onChangeText={setEmergencyPhone}
                placeholder="+91 9999999999" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
              {managers.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>Assign to Manager</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                    <TouchableOpacity onPress={() => setManagerId("")}
                      style={[styles.chip, managerId === "" && { backgroundColor: colors.textMuted, borderColor: colors.textMuted }]}>
                      <Text style={[styles.chipText, managerId === "" && { color: "#fff" }]}>No Manager</Text>
                    </TouchableOpacity>
                    {managers.map(m => (
                      <TouchableOpacity key={m._id} onPress={() => setManagerId(m._id)}
                        style={[styles.chip, managerId === m._id && { backgroundColor: colors.info, borderColor: colors.info }]}>
                        <Text style={[styles.chipText, managerId === m._id && { color: "#fff" }]}>{m.full_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </>
          )}

          {tab === "perms" && (
            <>
              <Text style={styles.sectionNote}>Set per-module access and scope for this user.</Text>
              {MODULES.map(mod => {
                const perm = permissions[mod];
                const access = perm?.access || "none";
                const scope = perm?.scope || "all";
                const scopeOptions = (SCOPES_MAP as any)[mod] as string[];
                return (
                  <View key={mod} style={styles.permBlock}>
                    <Text style={styles.permModName}>{mod.charAt(0).toUpperCase() + mod.slice(1)}</Text>
                    <View style={styles.permRow}>
                      <Text style={styles.permSubLabel}>Access:</Text>
                      {ACCESS_LEVELS.map(al => (
                        <TouchableOpacity key={al} onPress={() => setModuleAccess(mod, al)}
                          style={[styles.permChip, access === al && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                          <Text style={[styles.permChipText, access === al && { color: "#fff" }]}>{al}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {access !== "none" && scopeOptions.length > 1 && (
                      <View style={styles.permRow}>
                        <Text style={styles.permSubLabel}>Scope:</Text>
                        {scopeOptions.map(s => (
                          <TouchableOpacity key={s} onPress={() => setModuleScope(mod, s)}
                            style={[styles.permChip, scope === s && { backgroundColor: colors.info, borderColor: colors.info }]}>
                            <Text style={[styles.permChipText, scope === s && { color: "#fff" }]}>{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function UsersScreen() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showActive, setShowActive] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const [usersRes, mgrRes] = await Promise.all([
        api.get("/users"),
        api.get("/users/managers"),
      ]);
      setUsers(usersRes.data || []);
      setManagers(mgrRes.data || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  const onRefresh = () => { setRefreshing(true); fetchUsers(); };

  const getManagerName = (mid?: string) => managers.find(m => m._id === mid)?.full_name || "—";

  const deactivateUser = (u: User) => {
    Alert.alert("Deactivate User", `Deactivate ${u.full_name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate", style: "destructive", onPress: async () => {
          try { await api.delete(`/users/${u._id}`); fetchUsers(); }
          catch (e) { Alert.alert("Error", formatApiError(e)); }
        }
      }
    ]);
  };

  const hardDeleteUser = (u: User) => {
    Alert.alert(
      "Permanently Delete",
      `Permanently delete ${u.full_name}? This will erase all their data and cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently", style: "destructive", onPress: async () => {
            try { await api.delete(`/users/${u._id}?hard=true`); fetchUsers(); }
            catch (e) { Alert.alert("Error", formatApiError(e)); }
          }
        }
      ]
    );
  };

  const reactivateUser = async (u: User) => {
    try { await api.put(`/users/${u._id}/reactivate`); fetchUsers(); }
    catch (e) { Alert.alert("Error", formatApiError(e)); }
  };

  const filtered = users.filter(u => {
    const matchActive = u.is_active === showActive;
    const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return matchActive && matchSearch;
  });

  const currentUserId = (currentUser as any)?._id || currentUser?.id;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search users..." placeholderTextColor={colors.textMuted} />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setEditUser(null); setShowModal(true); }}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity onPress={() => setShowActive(true)}
          style={[styles.filterChip, showActive && { backgroundColor: colors.success, borderColor: colors.success }]}>
          <Text style={[styles.filterChipText, showActive && { color: "#fff" }]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowActive(false)}
          style={[styles.filterChip, !showActive && { backgroundColor: colors.textMuted, borderColor: colors.textMuted }]}>
          <Text style={[styles.filterChipText, !showActive && { color: "#fff" }]}>Inactive</Text>
        </TouchableOpacity>
        <Text style={styles.countText}>{filtered.length} user{filtered.length !== 1 ? "s" : ""}</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={u => u._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={[styles.avatar, { backgroundColor: (ROLE_COLORS[item.role] || colors.primary) + "20" }]}>
              <Text style={[styles.avatarText, { color: ROLE_COLORS[item.role] || colors.primary }]}>
                {item.full_name.charAt(0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{item.full_name}</Text>
              <Text style={styles.userEmail}>{item.email}</Text>
              {item.manager_id && (
                <Text style={styles.userMgr}>Manager: {getManagerName(item.manager_id)}</Text>
              )}
              <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLORS[item.role] || colors.primary) + "20" }]}>
                <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] || colors.primary }]}>{item.role}</Text>
              </View>
            </View>
            <View style={styles.userActions}>
              {item._id !== currentUserId && (
                <>
                  <TouchableOpacity onPress={() => { setEditUser(item); setShowModal(true); }} style={styles.iconBtn}>
                    <Ionicons name="pencil" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  {item.is_active ? (
                    <TouchableOpacity onPress={() => deactivateUser(item)} style={styles.iconBtn}>
                      <Ionicons name="person-remove-outline" size={16} color={colors.warning} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => reactivateUser(item)} style={styles.iconBtn}>
                      <Ionicons name="person-add-outline" size={16} color={colors.success} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => hardDeleteUser(item)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>No users found</Text></View>}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 100 }}
      />

      <UserModal
        visible={showModal}
        user={editUser}
        managers={managers.filter(m => m._id !== editUser?._id)}
        onClose={() => setShowModal(false)}
        onSave={() => { setShowModal(false); fetchUsers(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  topBar: {
    flexDirection: "row", gap: spacing.sm, padding: spacing.sm,
    backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border,
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
  filterBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipText: { fontSize: fontSize.xs, color: colors.textMuted },
  countText: { marginLeft: "auto" as any, fontSize: fontSize.xs, color: colors.textMuted },
  userCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.background,
    borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, elevation: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: fontSize.lg, fontWeight: "700" },
  userName: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
  userEmail: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  userMgr: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  roleBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, marginTop: 4 },
  roleText: { fontSize: 10, fontWeight: "700" },
  userActions: { flexDirection: "column", gap: 4 },
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
  modalTabs: {
    flexDirection: "row", backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTab: { flex: 1, paddingVertical: spacing.sm, alignItems: "center" },
  modalTabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  modalTabText: { fontSize: fontSize.sm, color: colors.textMuted },
  modalTabTextActive: { color: colors.primary, fontWeight: "700" },
  modalBody: { flex: 1, backgroundColor: colors.card, padding: spacing.md },
  fieldLabel: {
    fontSize: fontSize.xs, fontWeight: "600", color: colors.textMuted,
    marginBottom: spacing.xs, marginTop: spacing.sm, textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm,
    color: colors.text, fontSize: fontSize.sm, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs,
  },
  chipText: { fontSize: fontSize.sm, color: colors.text },
  sectionNote: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.md },
  permBlock: { marginBottom: spacing.md, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md },
  permModName: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text, marginBottom: spacing.sm, textTransform: "capitalize" },
  permRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xs },
  permSubLabel: { fontSize: fontSize.xs, color: colors.textMuted, width: 50 },
  permChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  permChipText: { fontSize: 11, color: colors.textMuted },
  errorText: { color: colors.danger, fontSize: fontSize.sm, marginBottom: spacing.sm },
});
