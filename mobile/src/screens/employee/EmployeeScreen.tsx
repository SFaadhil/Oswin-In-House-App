import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing, radius, fontSize } from "../../theme";

interface LeaveBalance {
  leave_type: string; allocated: number; used: number; pending: number; available: number;
}
interface Leave {
  _id: string; leave_type: string; start_date: string; end_date: string;
  status: string; total_days: number; reason?: string;
}
interface EmployeeData {
  pending_approvals?: number;
  my_leaves_count?: number;
  team_out_today?: Array<{ full_name: string; leave_type: string }>;
  leave_balances?: LeaveBalance[];
  personal_info?: {
    phone?: string; dob?: string; blood_group?: string;
    emergency_contact?: string; emergency_phone?: string;
  };
  recent_leaves?: Leave[];
}

const STATUS_COLOR: Record<string, string> = {
  approved: colors.success, pending: colors.warning,
  rejected: colors.danger, cancelled: colors.textMuted,
};

export default function EmployeeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [portalRes, balRes, leavesRes] = await Promise.all([
        api.get("/employee-portal/dashboard"),
        api.get("/leaves/balance"),
        api.get("/leaves?scope=mine"),
      ]);
      setData({
        ...portalRes.data,
        leave_balances: balRes.data,
        recent_leaves: leavesRes.data?.slice(0, 10) || [],
      });
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

      <Text style={styles.greeting}>Employee Portal</Text>
      <Text style={styles.subGreeting}>{user?.full_name} · {user?.role}</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { label: "Pending Approvals", value: data?.pending_approvals ?? 0, icon: "time-outline", color: colors.warning },
          { label: "My Leaves Taken", value: data?.my_leaves_count ?? 0, icon: "calendar-outline", color: colors.primary },
          { label: "Team Out Today", value: data?.team_out_today?.length ?? 0, icon: "people-outline", color: colors.info },
        ].map(s => (
          <View key={s.label} style={[styles.statCard, { borderTopColor: s.color }]}>
            <Ionicons name={s.icon as any} size={20} color={s.color} style={{ marginBottom: 4 }} />
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Apply Leave shortcut */}
      <TouchableOpacity style={styles.applyCard} onPress={() => navigation.navigate("Leaves")} activeOpacity={0.85}>
        <View style={styles.applyLeft}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
          <View>
            <Text style={styles.applyTitle}>Apply for Leave</Text>
            <Text style={styles.applySub}>Submit a new leave request</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.primary} />
      </TouchableOpacity>

      {/* Leave Balances */}
      {data?.leave_balances && data.leave_balances.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>LEAVE BALANCE</Text>
          {data.leave_balances.map((bal, i) => {
            const pct = bal.allocated > 0 ? Math.min((bal.used / bal.allocated) * 100, 100) : 0;
            return (
              <View key={i} style={styles.balRow}>
                <View style={styles.balHeader}>
                  <Text style={styles.balType}>{bal.leave_type}</Text>
                  <Text style={styles.balFraction}>{bal.available} / {bal.allocated} left</Text>
                </View>
                <View style={styles.balTrack}>
                  <View style={[styles.balBar, { width: `${pct}%` as any, backgroundColor: pct > 80 ? colors.danger : colors.primary }]} />
                </View>
                <View style={styles.balMetaRow}>
                  <Text style={styles.balMeta}>Used: {bal.used}</Text>
                  {bal.pending > 0 && <Text style={[styles.balMeta, { color: colors.warning }]}>Pending: {bal.pending}</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Personal Info */}
      {data?.personal_info && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PERSONAL INFORMATION</Text>
          {[
            { label: "Phone", value: data.personal_info.phone, icon: "call-outline" },
            { label: "Date of Birth", value: data.personal_info.dob, icon: "calendar-outline" },
            { label: "Blood Group", value: data.personal_info.blood_group, icon: "heart-outline" },
            { label: "Emergency Contact", value: data.personal_info.emergency_contact, icon: "person-outline" },
            { label: "Emergency Phone", value: data.personal_info.emergency_phone, icon: "call-outline" },
          ].filter(f => f.value).map(f => (
            <View key={f.label} style={styles.infoRow}>
              <Ionicons name={f.icon as any} size={16} color={colors.textMuted} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={styles.infoLabel}>{f.label}</Text>
                <Text style={styles.infoValue}>{f.value}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Team Out Today */}
      {data?.team_out_today && data.team_out_today.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>TEAM OUT TODAY ({data.team_out_today.length})</Text>
          {data.team_out_today.map((m, i) => (
            <View key={i} style={styles.teamRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{m.full_name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.teamName}>{m.full_name}</Text>
                <Text style={styles.teamLeave}>{m.leave_type}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Recent Leaves */}
      {data?.recent_leaves && data.recent_leaves.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>MY RECENT LEAVES</Text>
          {data.recent_leaves.map(leave => (
            <View key={leave._id} style={[styles.leaveRow, { borderLeftColor: STATUS_COLOR[leave.status] || colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.leaveType}>{leave.leave_type}</Text>
                <Text style={styles.leaveDates}>
                  {new Date(leave.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  {" – "}
                  {new Date(leave.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  {" · "}{leave.total_days}d
                </Text>
                {leave.reason && <Text style={styles.leaveReason} numberOfLines={1}>{leave.reason}</Text>}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLOR[leave.status] || colors.textMuted) + "20" }]}>
                <Text style={[styles.statusText, { color: STATUS_COLOR[leave.status] || colors.textMuted }]}>
                  {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  content: { padding: spacing.md, paddingBottom: 100 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  greeting: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  subGreeting: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  applyCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.primary + "12", borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primary + "30",
    padding: spacing.md, marginBottom: spacing.md,
  },
  applyLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  applyTitle: { fontSize: fontSize.sm, fontWeight: "700", color: colors.primary },
  applySub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  statCard: {
    flex: 1, backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.sm, borderTopWidth: 3, elevation: 1, alignItems: "center",
  },
  statValue: { fontSize: fontSize.xl, fontWeight: "700" },
  statLabel: { fontSize: 9, color: colors.textMuted, textAlign: "center", marginTop: 2 },
  card: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, elevation: 1 },
  cardTitle: { fontSize: 9, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.md },
  balRow: { marginBottom: spacing.md },
  balHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  balType: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  balFraction: { fontSize: fontSize.xs, color: colors.textMuted },
  balTrack: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden", marginBottom: 4 },
  balBar: { height: "100%", borderRadius: 4 },
  balMetaRow: { flexDirection: "row", gap: spacing.md },
  balMeta: { fontSize: fontSize.xs, color: colors.textMuted },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  infoValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
  teamRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + "20", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: fontSize.base, fontWeight: "700", color: colors.primary },
  teamName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  teamLeave: { fontSize: fontSize.xs, color: colors.textMuted },
  leaveRow: {
    borderLeftWidth: 3, paddingLeft: spacing.sm, paddingVertical: spacing.sm,
    flexDirection: "row", alignItems: "center", marginBottom: spacing.sm,
  },
  leaveType: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  leaveDates: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  leaveReason: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1, fontStyle: "italic" },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  statusText: { fontSize: 11, fontWeight: "700" },
});
