import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { api, formatCurrency } from "../../api/client";
import { colors, spacing, radius, fontSize } from "../../theme";

const TABS = ["By Category", "By Person", "By Adder", "All Subscriptions", "One-Time"];

interface BreakdownItem { name: string; monthly: number; annual: number; count: number; color?: string; one_time?: number; }
interface OneTimeBreakdownItem { name: string; total: number; count: number; }

interface Subscription {
  id: string; name: string; cost: number; currency: string;
  billing_cycle: string; monthly_cost: number; annual_cost: number;
  category?: string; owner?: string; responsible_person?: string;
  status: string; next_due_date?: string;
}
interface OneTimePayment {
  id: string; name: string; cost: number; currency: string;
  category?: string; owner?: string; responsible_person?: string; date?: string;
}

interface SpendingData {
  total_monthly: number;
  total_annual: number;
  total_one_time: number;
  one_time_count: number;
  category_breakdown: BreakdownItem[];
  user_breakdown: BreakdownItem[];
  person_breakdown: BreakdownItem[];
  subscriptions: Subscription[];
  one_time_payments: OneTimePayment[];
}

function SummaryBar({ data }: { data: SpendingData }) {
  return (
    <View style={styles.summaryRow}>
      {[
        { label: "Monthly", value: formatCurrency(data.total_monthly), color: colors.primary },
        { label: "Annual", value: formatCurrency(data.total_annual), color: colors.info },
        { label: "Subs", value: String(data.subscriptions?.length || 0), color: colors.purple },
        { label: "One-Time", value: formatCurrency(data.total_one_time), color: colors.warning },
      ].map(s => (
        <View key={s.label} style={[styles.summaryCard, { borderTopColor: s.color }]}>
          <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
          <Text style={styles.summaryLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

function BarGroup({ items, colorKey }: { items: BreakdownItem[]; colorKey?: boolean }) {
  const max = Math.max(...items.map(i => i.monthly), 1);
  return (
    <View>
      {items.map((item, idx) => {
        const pct = (item.monthly / max) * 100;
        const barColor = item.color || colors.primary;
        return (
          <View key={idx} style={styles.groupRow}>
            <View style={styles.groupLeft}>
              {colorKey && <View style={[styles.dot, { backgroundColor: barColor }]} />}
              <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
            </View>
            <View style={styles.groupBarTrack}>
              <View style={[styles.groupBar, { width: `${pct}%` as any, backgroundColor: barColor }]} />
            </View>
            <View style={styles.groupRight}>
              <Text style={styles.groupTotal}>{formatCurrency(item.monthly)}</Text>
              <Text style={styles.groupCount}>{item.count} sub{item.count !== 1 ? "s" : ""}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function ReportsScreen() {
  const [tab, setTab] = useState("By Category");
  const [data, setData] = useState<SpendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get("/reports/spending");
      setData(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!data) return <View style={styles.center}><Text style={styles.muted}>No data available</Text></View>;

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow}
        contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs }}>
        {TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[styles.tabChip, tab === t && styles.tabChipActive]}>
            <Text style={[styles.tabChipText, tab === t && styles.tabChipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.body} contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        <SummaryBar data={data} />

        {tab === "By Category" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SPENDING BY CATEGORY</Text>
            {data.category_breakdown?.length ? (
              <BarGroup items={data.category_breakdown} colorKey />
            ) : (
              <Text style={styles.emptyText}>No data</Text>
            )}
          </View>
        )}

        {tab === "By Person" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SPENDING BY RESPONSIBLE PERSON</Text>
            {data.person_breakdown?.length ? (
              <BarGroup items={data.person_breakdown} />
            ) : (
              <Text style={styles.emptyText}>No data</Text>
            )}
          </View>
        )}

        {tab === "By Adder" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SPENDING BY PERSON WHO ADDED</Text>
            {data.user_breakdown?.length ? (
              <BarGroup items={data.user_breakdown} />
            ) : (
              <Text style={styles.emptyText}>No data</Text>
            )}
          </View>
        )}

        {tab === "All Subscriptions" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ALL SUBSCRIPTIONS ({data.subscriptions?.length || 0})</Text>
            {data.subscriptions?.length ? data.subscriptions.map(sub => (
              <View key={sub.id} style={styles.subRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subName}>{sub.name}</Text>
                  <Text style={styles.subMeta}>
                    {sub.billing_cycle} · {sub.status}{sub.category ? ` · ${sub.category}` : ""}
                  </Text>
                  {sub.responsible_person && sub.responsible_person !== "Unassigned" && (
                    <Text style={styles.subMeta}>Person: {sub.responsible_person}</Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.subCost}>{formatCurrency(sub.cost, sub.currency)}</Text>
                  {sub.next_due_date && (
                    <Text style={styles.subDue}>
                      {new Date(sub.next_due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </Text>
                  )}
                </View>
              </View>
            )) : (
              <Text style={styles.emptyText}>No subscriptions</Text>
            )}
          </View>
        )}

        {tab === "One-Time" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ONE-TIME PAYMENTS ({data.one_time_payments?.length || 0})</Text>
            {data.one_time_payments?.length ? data.one_time_payments.map(sub => (
              <View key={sub.id} style={styles.subRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subName}>{sub.name}</Text>
                  {sub.category && <Text style={styles.subMeta}>{sub.category}</Text>}
                  {sub.responsible_person && sub.responsible_person !== "Unassigned" && (
                    <Text style={styles.subMeta}>Person: {sub.responsible_person}</Text>
                  )}
                  {sub.date && (
                    <Text style={styles.subMeta}>
                      Date: {new Date(sub.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </Text>
                  )}
                </View>
                <Text style={styles.subCost}>{formatCurrency(sub.cost, sub.currency)}</Text>
              </View>
            )) : (
              <Text style={styles.emptyText}>No one-time payments</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  muted: { color: colors.textMuted },
  body: { flex: 1 },
  tabsRow: { maxHeight: 50, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabChipText: { fontSize: fontSize.xs, color: colors.textMuted },
  tabChipTextActive: { color: "#fff", fontWeight: "600" },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: {
    flex: 1, backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.sm, borderTopWidth: 3, elevation: 1, alignItems: "center",
  },
  summaryValue: { fontSize: fontSize.base, fontWeight: "700" },
  summaryLabel: { fontSize: 9, color: colors.textMuted, marginTop: 2 },
  card: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, elevation: 1 },
  cardTitle: { fontSize: 9, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.md },
  groupRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  groupLeft: { flexDirection: "row", alignItems: "center", width: 110, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  groupName: { flex: 1, fontSize: fontSize.xs, color: colors.text },
  groupBarTrack: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
  groupBar: { height: "100%", borderRadius: 4 },
  groupRight: { width: 80, alignItems: "flex-end" },
  groupTotal: { fontSize: fontSize.xs, fontWeight: "700", color: colors.text },
  groupCount: { fontSize: 10, color: colors.textMuted },
  subRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  subName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  subMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  subCost: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
  subDue: { fontSize: fontSize.xs, color: colors.textMuted },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.lg },
});
