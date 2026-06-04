import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, RefreshControl, ActivityIndicator,
  TouchableOpacity, ScrollView, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { colors, spacing, radius, fontSize } from "../../theme";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const SCREEN_W = Dimensions.get("window").width;
const CELL_W = Math.floor(SCREEN_W / 7);
const CELL_H = CELL_W + 10;

interface LeaveUser { id: string; name: string; email?: string; }
interface LeaveType { id: string; name: string; color?: string; }
interface LeaveEntry {
  _id: string;
  user: LeaveUser;
  leave_type: LeaveType;
  start_date: string; end_date: string; status: string; total_days: number;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function datesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const endD = new Date(end);
  while (cur <= endD) { dates.push(isoDate(cur)); cur.setDate(cur.getDate() + 1); }
  return dates;
}

export default function CalendarScreen() {
  const [tab, setTab] = useState<"month" | "team">("month");
  const [leaves, setLeaves] = useState<LeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await api.get("/leaves?scope=all");
      setLeaves((res.data || []).filter((l: LeaveEntry) => l.status === "approved"));
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);
  const onRefresh = () => { setRefreshing(true); fetchLeaves(); };

  // Build date-to-leaves map
  const dateMap: Record<string, LeaveEntry[]> = {};
  leaves.forEach(lv => {
    datesInRange(lv.start_date, lv.end_date).forEach(d => {
      if (!dateMap[d]) dateMap[d] = [];
      dateMap[d].push(lv);
    });
  });

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  // Pad to complete rows
  while (cells.length % 7 !== 0) cells.push(null);
  const today = isoDate(new Date());

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Team view: group by employee
  const teamMap: Record<string, { name: string; leaves: LeaveEntry[] }> = {};
  leaves.forEach(lv => {
    const empName = lv.user?.name || "Unknown";
    const key = lv.user?.id || empName;
    if (!teamMap[key]) teamMap[key] = { name: empName, leaves: [] };
    teamMap[key].leaves.push(lv);
  });
  const teamList = Object.values(teamMap).sort((a, b) => a.name.localeCompare(b.name));

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.topBar}>
        <View style={styles.tabPills}>
          {([["month", "Month View"], ["team", "By Employee"]] as const).map(([key, label]) => (
            <TouchableOpacity key={key} onPress={() => setTab(key)}
              style={[styles.tabPill, tab === key && styles.tabPillActive]}>
              <Text style={[styles.tabPillText, tab === key && styles.tabPillTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === "month" ? (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
          {/* Month nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeaders}>
            {DAYS.map(d => <Text key={d} style={styles.dayHeader}>{d}</Text>)}
          </View>

          {/* Grid */}
          <View style={styles.grid}>
            {cells.map((day, idx) => {
              const dateStr = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
              const dayLeaves = dateStr ? (dateMap[dateStr] || []) : [];
              const isToday = dateStr === today;
              const isWeekend = idx % 7 === 0 || idx % 7 === 6;
              return (
                <View key={idx} style={[styles.cell, isWeekend && styles.cellWeekend, !day && styles.cellEmpty]}>
                  {day && (
                    <>
                      <Text style={[styles.cellDay, isToday && styles.cellDayToday]}>{day}</Text>
                      {dayLeaves.slice(0, 2).map((lv, i) => (
                        <View key={i} style={styles.leaveDot}>
                          <Text style={styles.leaveDotText} numberOfLines={1}>{(lv.user?.name || "").split(" ")[0]}</Text>
                        </View>
                      ))}
                      {dayLeaves.length > 2 && (
                        <Text style={styles.moreText}>+{dayLeaves.length - 2}</Text>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>

          {/* Legend for selected month */}
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>LEAVES THIS MONTH</Text>
            {leaves.filter(lv => {
              const s = new Date(lv.start_date), e = new Date(lv.end_date);
              const mStart = new Date(year, month, 1), mEnd = new Date(year, month + 1, 0);
              return s <= mEnd && e >= mStart;
            }).map(lv => (
              <View key={lv._id} style={styles.legendRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.legendName}>{lv.user?.name || "Unknown"}</Text>
                  <Text style={styles.legendSub}>
                    {lv.leave_type?.name || "Leave"} · {new Date(lv.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    {" – "}
                    {new Date(lv.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    {" · "}{lv.total_days}d
                  </Text>
                </View>
              </View>
            ))}
            {leaves.filter(lv => {
              const s = new Date(lv.start_date), e = new Date(lv.end_date);
              const mStart = new Date(year, month, 1), mEnd = new Date(year, month + 1, 0);
              return s <= mEnd && e >= mStart;
            }).length === 0 && (
              <Text style={styles.emptyText}>No approved leaves this month</Text>
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}>
          {teamList.length === 0 ? (
            <View style={styles.center}><Text style={styles.emptyText}>No approved leaves</Text></View>
          ) : teamList.map(({ name, leaves: empLeaves }) => (
            <View key={name} style={styles.employeeCard}>
              <View style={styles.employeeHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{name.charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.employeeName}>{name}</Text>
                  <Text style={styles.employeeCount}>{empLeaves.length} leave{empLeaves.length !== 1 ? "s" : ""}</Text>
                </View>
              </View>
              {empLeaves.map(lv => (
                <View key={lv._id} style={styles.empLeaveRow}>
                  <View style={[styles.leaveTypeDot, { backgroundColor: lv.leave_type?.color || colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaveTypeName}>{lv.leave_type?.name || "Leave"}</Text>
                    <Text style={styles.leaveDateRange}>
                      {new Date(lv.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      {" – "}
                      {new Date(lv.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      {" · "}{lv.total_days}d
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  topBar: {
    padding: spacing.sm, backgroundColor: colors.background,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabPills: { flexDirection: "row", gap: spacing.xs },
  tabPill: {
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabPillText: { fontSize: fontSize.xs, color: colors.textMuted },
  tabPillTextActive: { color: "#fff", fontWeight: "600" },
  monthNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.md, backgroundColor: colors.background,
  },
  navBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  monthTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  dayHeaders: { flexDirection: "row", width: CELL_W * 7, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  dayHeader: { width: CELL_W, textAlign: "center", fontSize: 11, fontWeight: "700", color: colors.textMuted, paddingVertical: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", width: CELL_W * 7, backgroundColor: colors.background },
  cell: {
    width: CELL_W, height: CELL_H, borderRightWidth: 0.5, borderBottomWidth: 0.5,
    borderColor: colors.border, padding: 4,
  },
  cellWeekend: { backgroundColor: colors.card },
  cellEmpty: { backgroundColor: colors.card },
  cellDay: { fontSize: 12, fontWeight: "600", color: colors.text, marginBottom: 2 },
  cellDayToday: { color: "#fff", backgroundColor: colors.primary, borderRadius: 10, width: 20, height: 20, textAlign: "center", lineHeight: 20 },
  leaveDot: { backgroundColor: colors.primary + "30", borderRadius: 2, marginBottom: 1, paddingHorizontal: 2 },
  leaveDotText: { fontSize: 8, color: colors.primary, fontWeight: "600" },
  moreText: { fontSize: 8, color: colors.textMuted },
  legend: { padding: spacing.md, backgroundColor: colors.background, margin: spacing.md, borderRadius: radius.md, elevation: 1 },
  legendTitle: { fontSize: 9, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.sm },
  legendRow: { flexDirection: "row", paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  legendName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  legendSub: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  emptyText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.md },
  employeeCard: { backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, elevation: 1 },
  employeeHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + "20", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.primary },
  employeeName: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
  employeeCount: { fontSize: fontSize.xs, color: colors.textMuted },
  empLeaveRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  leaveTypeDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  leaveTypeName: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text },
  leaveDateRange: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
});
