import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, formatApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing, radius, fontSize } from "../../theme";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const ROLE_COLORS: Record<string, string> = {
  Director: colors.purple, Admin: colors.primary, MD: colors.primary,
  Manager: colors.info, Employee: colors.success, User: colors.textMuted,
};

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();

  const [info, setInfo] = useState({
    full_name: user?.full_name || "",
    phone: user?.phone || "",
    date_of_birth: user?.date_of_birth ? user.date_of_birth.slice(0, 10) : "",
    blood_group: user?.blood_group || "",
    address: user?.address || "",
    emergency_contact_name: user?.emergency_contact_name || "",
    emergency_contact_phone: user?.emergency_contact_phone || "",
  });
  const [infoSaving, setInfoSaving] = useState(false);

  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [pwSaving, setPwSaving] = useState(false);

  const setField = (k: string, v: string) => setInfo(p => ({ ...p, [k]: v }));

  const saveInfo = async () => {
    if (!info.full_name.trim()) { Alert.alert("Error", "Full name is required"); return; }
    setInfoSaving(true);
    try {
      const res = await api.patch("/auth/profile", info);
      updateUser(res.data);
      Alert.alert("Success", "Profile updated");
    } catch (e) { Alert.alert("Error", formatApiError(e)); }
    finally { setInfoSaving(false); }
  };

  const changePassword = async () => {
    if (!pw.current_password || !pw.new_password || !pw.confirm_password) {
      Alert.alert("Error", "All password fields are required"); return;
    }
    if (pw.new_password !== pw.confirm_password) {
      Alert.alert("Error", "Passwords don't match"); return;
    }
    if (pw.new_password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters"); return;
    }
    setPwSaving(true);
    try {
      await api.post("/auth/change-password", {
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      setPw({ current_password: "", new_password: "", confirm_password: "" });
      Alert.alert("Success", "Password changed successfully");
    } catch (e) { Alert.alert("Error", formatApiError(e)); }
    finally { setPwSaving(false); }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  if (!user) return null;
  const initials = user.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  const modulePerms = user.module_permissions || {};
  const permEntries = Object.entries(modulePerms).filter(([, v]) => v && v !== "default");

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{user.full_name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: (ROLE_COLORS[user.role] || colors.textMuted) + "20" }]}>
              <Text style={[styles.badgeText, { color: ROLE_COLORS[user.role] || colors.textMuted }]}>{user.role}</Text>
            </View>
            {user.access_level && (
              <View style={[styles.badge, { backgroundColor: colors.info + "20" }]}>
                <Text style={[styles.badgeText, { color: colors.info }]}>{user.access_level}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Personal Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PERSONAL INFORMATION</Text>

          <Text style={styles.fieldLabel}>Full Name</Text>
          <TextInput style={styles.input} value={info.full_name} onChangeText={v => setField("full_name", v)}
            placeholder="Your full name" placeholderTextColor={colors.textMuted} />

          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput style={styles.input} value={info.phone} onChangeText={v => setField("phone", v)}
            placeholder="+91 98765 43210" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />

          <Text style={styles.fieldLabel}>Date of Birth (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={info.date_of_birth} onChangeText={v => setField("date_of_birth", v)}
            placeholder="1990-01-15" placeholderTextColor={colors.textMuted} />

          <Text style={styles.fieldLabel}>Blood Group</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            {["", ...BLOOD_GROUPS].map(bg => (
              <TouchableOpacity key={bg || "none"} onPress={() => setField("blood_group", bg)}
                style={[styles.chip, info.blood_group === bg && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[styles.chipText, info.blood_group === bg && { color: "#fff" }]}>{bg || "None"}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Home Address</Text>
          <TextInput style={styles.input} value={info.address} onChangeText={v => setField("address", v)}
            placeholder="Street, City, Postal code" placeholderTextColor={colors.textMuted} />

          <Text style={styles.sectionSub}>EMERGENCY CONTACT</Text>

          <Text style={styles.fieldLabel}>Contact Name</Text>
          <TextInput style={styles.input} value={info.emergency_contact_name}
            onChangeText={v => setField("emergency_contact_name", v)}
            placeholder="Parent / Spouse / Sibling" placeholderTextColor={colors.textMuted} />

          <Text style={styles.fieldLabel}>Contact Phone</Text>
          <TextInput style={styles.input} value={info.emergency_contact_phone}
            onChangeText={v => setField("emergency_contact_phone", v)}
            placeholder="+91 98765 43210" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />

          <TouchableOpacity style={styles.saveBtn} onPress={saveInfo} disabled={infoSaving}>
            {infoSaving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>

        {/* Module Permissions (if overrides exist) */}
        {permEntries.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>YOUR MODULE ACCESS</Text>
            {permEntries.map(([mod, v]) => {
              const access = typeof v === "string" ? v : (v as any)?.access || "default";
              const scope = typeof v === "object" ? (v as any)?.scope : undefined;
              return (
                <View key={mod} style={styles.permRow}>
                  <Text style={styles.permMod}>{mod.charAt(0).toUpperCase() + mod.slice(1)}</Text>
                  <View style={[styles.permBadge, { backgroundColor: (access === "edit" ? colors.success : access === "view" ? colors.warning : colors.danger) + "20" }]}>
                    <Text style={[styles.permBadgeText, { color: access === "edit" ? colors.success : access === "view" ? colors.warning : colors.danger }]}>{access}</Text>
                  </View>
                  {scope && (
                    <View style={[styles.permBadge, { backgroundColor: colors.border }]}>
                      <Text style={[styles.permBadgeText, { color: colors.textMuted }]}>{scope}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Change Password */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CHANGE PASSWORD</Text>

          <Text style={styles.fieldLabel}>Current Password</Text>
          <TextInput style={styles.input} value={pw.current_password}
            onChangeText={v => setPw(p => ({ ...p, current_password: v }))}
            placeholder="••••••••" placeholderTextColor={colors.textMuted} secureTextEntry />

          <Text style={styles.fieldLabel}>New Password</Text>
          <TextInput style={styles.input} value={pw.new_password}
            onChangeText={v => setPw(p => ({ ...p, new_password: v }))}
            placeholder="Min. 8 characters" placeholderTextColor={colors.textMuted} secureTextEntry />

          <Text style={styles.fieldLabel}>Confirm New Password</Text>
          <TextInput style={styles.input} value={pw.confirm_password}
            onChangeText={v => setPw(p => ({ ...p, confirm_password: v }))}
            placeholder="Repeat new password" placeholderTextColor={colors.textMuted} secureTextEntry />

          <TouchableOpacity style={styles.saveBtn} onPress={changePassword} disabled={pwSaving}>
            {pwSaving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Change Password</Text>}
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  content: { padding: spacing.md },
  avatarSection: { alignItems: "center", marginBottom: spacing.lg, gap: spacing.sm, paddingTop: spacing.md },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary, justifyContent: "center", alignItems: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: fontSize["2xl"] },
  name: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  email: { fontSize: fontSize.sm, color: colors.textMuted },
  badges: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", justifyContent: "center" },
  badge: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { fontSize: fontSize.xs, fontWeight: "700" },
  card: { backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, elevation: 1 },
  cardTitle: { fontSize: 9, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.md },
  sectionSub: { fontSize: 9, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.8, marginTop: spacing.md, marginBottom: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  fieldLabel: { fontSize: fontSize.xs, fontWeight: "600", color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm,
    color: colors.text, fontSize: fontSize.sm, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs,
  },
  chipText: { fontSize: fontSize.xs, color: colors.text },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 12, alignItems: "center", marginTop: spacing.md,
  },
  saveBtnText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "700" },
  permRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  permMod: { flex: 1, fontSize: fontSize.sm, color: colors.text, textTransform: "capitalize" },
  permBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  permBadgeText: { fontSize: 10, fontWeight: "700" },
  logoutBtn: {
    backgroundColor: colors.danger, borderRadius: radius.md,
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: spacing.sm, paddingVertical: 14, marginBottom: spacing.md,
  },
  logoutText: { color: "#fff", fontSize: fontSize.sm, fontWeight: "700" },
});
