import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, formatCurrency, getDueStatus } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { colors, spacing, radius, fontSize } from "../../theme";

interface Stats {
  total_monthly: number;
  total_annual: number;
  active_count: number;
  upcoming_count: number;
  one_time_total: number;
  category_breakdown: Array<{ name: string; value: number; color: string }>;
  monthly_trend: Array<{ month: string; total: number }>;
  upcoming_renewals: Array<{ _id: string; subscription_name: string; billing_cycle: string; cost: number; currency: string; next_due_date: string }>;
  recent_subscriptions: Array<{ _id: string; subscription_name: string; billing_cycle: string; status: string; cost: number; currency: string }>;
}

const URGENCY_COLOR: Record<string, string> = {
  success: colors.success, warning: colors.warning,
  urgent: "#f97316", danger: colors.danger, muted: colors.textMuted,
};

function StatCard({ title, value, icon, color, subtitle }: { title: string; value: string; icon: string; color: string; subtitle: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={styles.statHeader}>
        <Text style={styles.statTitle}>{title}</Text>
        <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
          <Ionicons name={icon as any} size={16} color={color} />
        </View>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/reports/dashboard");
      setStats(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  const onRefresh = () => { setRefreshing(true); fetchStats(); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!stats) return <View style={styles.center}><Text style={styles.muted}>No data available</Text></View>;

  const maxTrend = Math.max(...(stats.monthly_trend?.map(m => m.total) || [1]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

      <Text style={styles.greeting}>Hi, {user?.full_name?.split(" ")[0]} 👋</Text>
      <Text style={styles.subGreeting}>Overview of your subscription spending</Text>

      {/* Stat Cards */}
      <View style={styles.statsGrid}>
        <StatCard title="MONTHLY COST" value={formatCurrency(stats.total_monthly)} icon="trending-up" color={colors.primary} subtitle="Recurring monthly" />
        <StatCard title="ANNUAL COST" value={formatCurrency(stats.total_annual)} icon="arrow-up-circle" color={colors.info} subtitle="Projected yearly" />
        <StatCard title="ACTIVE SUBS" value={String(stats.active_count)} icon="card" color={colors.purple} subtitle="Currently active" />
        <StatCard title="DUE SOON" value={String(stats.upcoming_count)} icon="alert-circle"
          color={stats.upcoming_count > 0 ? colors.danger : colors.textMuted} subtitle="Within 7 days" />
      </View>

      {/* One-time costs banner */}
      {stats.one_time_total > 0 && (
        <View style={styles.banner}>
          <Ionicons name="cash-outline" size={18} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>One-Time Costs: {formatCurrency(stats.one_time_total)}</Text>
            <Text style={styles.bannerSub}>Not included in monthly/annual totals</Text>
          </View>
        </View>
      )}

      {/* Monthly Trend */}
      {stats.monthly_trend?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>MONTHLY SPENDING TREND (HISTORICAL)</Text>
          <View style={styles.barChart}>
            {stats.monthly_trend.slice(-6).map((m, i) => {
              const pct = maxTrend > 0 ? (m.total / maxTrend) : 0;
              return (
                <View key={i} style={styles.barCol}>
                  <Text style={styles.barVal}>{m.total >= 1000 ? `₹${(m.total / 1000).toFixed(0)}k` : `₹${m.total}`}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.bar, { height: Math.max(4, pct * 100) }]} />
                  </View>
                  <Text style={styles.barLabel}>{m.month?.slice(0, 3)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Category Breakdown */}
      {stats.category_breakdown?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SPENDING BY CATEGORY</Text>
          {stats.category_breakdown.map((cat, i) => {
            const total = stats.category_breakdown.reduce((a, c) => a + c.value, 0);
            const pct = total > 0 ? (cat.value / total) * 100 : 0;
            return (
              <View key={i} style={styles.catRow}>
                <View style={[styles.catDot, { backgroundColor: cat.color || colors.primary }]} />
                <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
                <View style={styles.catBarTrack}>
                  <View style={[styles.catBar, { width: `${pct}%` as any, backgroundColor: cat.color || colors.primary }]} />
                </View>
                <Text style={styles.catVal}>{formatCurrency(cat.value)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Due in 7 Days */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>DUE IN 7 DAYS</Text>
        {!stats.upcoming_renewals?.length ? (
          <Text style={styles.emptyText}>No upcoming renewals</Text>
        ) : (
          stats.upcoming_renewals.slice(0, 5).map(sub => {
            const due = getDueStatus(sub.next_due_date);
            return (
              <View key={sub._id} style={[styles.renewalRow, { borderLeftColor: due.color }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.renewalName}>{sub.subscription_name}</Text>
                  <Text style={styles.renewalCycle}>{sub.billing_cycle}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.renewalCost}>{formatCurrency(sub.cost, sub.currency)}</Text>
                  <Text style={[styles.renewalDue, { color: due.color }]}>{due.label}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Recently Added */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>RECENTLY ADDED</Text>
        {!stats.recent_subscriptions?.length ? (
          <Text style={styles.emptyText}>No subscriptions yet</Text>
        ) : (
          stats.recent_subscriptions.map(sub => (
            <View key={sub._id} style={styles.recentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.renewalName}>{sub.subscription_name}</Text>
                <Text style={styles.renewalCycle}>{sub.billing_cycle} · {sub.status}</Text>
              </View>
              <Text style={styles.renewalCost}>{formatCurrency(sub.cost, sub.currency)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  muted: { color: colors.textMuted },
  greeting: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text },
  subGreeting: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    flex: 1, minWidth: "47%", backgroundColor: colors.background,
    borderRadius: radius.md, padding: spacing.md, borderTopWidth: 3, elevation: 1,
  },
  statHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  statTitle: { fontSize: 9, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 },
  statIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  statValue: { fontSize: fontSize["2xl"], fontWeight: "700", color: colors.text },
  statSubtitle: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  banner: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.warning + "15", borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.warning + "40",
    padding: spacing.md, marginBottom: spacing.md,
  },
  bannerTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  bannerSub: { fontSize: fontSize.xs, color: colors.textMuted },
  card: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, elevation: 1 },
  cardTitle: { fontSize: 9, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.md },
  barChart: { flexDirection: "row", alignItems: "flex-end", gap: spacing.xs, height: 130 },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barVal: { fontSize: 8, color: colors.textMuted, marginBottom: 2 },
  barTrack: { width: "100%", height: 100, justifyContent: "flex-end" },
  bar: { width: "100%", backgroundColor: colors.primary, borderRadius: 3 },
  barLabel: { fontSize: 9, color: colors.textMuted, marginTop: 4 },
  catRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { width: 80, fontSize: fontSize.xs, color: colors.text },
  catBarTrack: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
  catBar: { height: "100%", borderRadius: 3 },
  catVal: { fontSize: fontSize.xs, color: colors.textMuted, width: 64, textAlign: "right" },
  renewalRow: {
    flexDirection: "row", alignItems: "center", padding: spacing.sm,
    borderLeftWidth: 3, backgroundColor: colors.card, borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  renewalName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  renewalCycle: { fontSize: fontSize.xs, color: colors.textMuted },
  renewalCost: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
  renewalDue: { fontSize: fontSize.xs, fontWeight: "700" },
  recentRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.lg },
});
