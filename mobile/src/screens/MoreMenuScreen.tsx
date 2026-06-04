import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, radius, fontSize } from "../theme";

const TOP_ROLES = ["Director", "Admin", "MD", "Manager"];

interface MenuItem {
  label: string;
  icon: string;
  screen: string;
  roles?: string[];
}

const MENU_ITEMS: MenuItem[] = [
  { label: "Employee Portal", icon: "briefcase-outline", screen: "Employee" },
  { label: "Leaves", icon: "calendar-clear-outline", screen: "Leaves" },
  { label: "Team Calendar", icon: "calendar-outline", screen: "Calendar" },
  { label: "Tasks", icon: "checkmark-circle-outline", screen: "Tasks" },
  { label: "Categories", icon: "pricetag-outline", screen: "Categories", roles: TOP_ROLES },
  { label: "User Management", icon: "people-outline", screen: "Users", roles: TOP_ROLES },
  { label: "Profile", icon: "person-circle-outline", screen: "Profile" },
];

export default function MoreMenuScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();

  const visibleItems = MENU_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.full_name?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.userName}>{user?.full_name}</Text>
          <Text style={styles.userRole}>{user?.role}</Text>
        </View>
      </View>

      {visibleItems.map((item) => (
        <TouchableOpacity
          key={item.screen}
          style={styles.menuItem}
          onPress={() => navigation.navigate(item.screen)}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconBox}>
            <Ionicons name={item.icon as any} size={22} color={colors.primary} />
          </View>
          <Text style={styles.menuLabel}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.border} />
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={logout} activeOpacity={0.7}>
        <View style={[styles.menuIconBox, { backgroundColor: `${colors.danger}15` }]}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        </View>
        <Text style={[styles.menuLabel, { color: colors.danger }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  userCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.background, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.lg, elevation: 1,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary, justifyContent: "center", alignItems: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: fontSize.base },
  userName: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  userRole: { fontSize: fontSize.sm, color: colors.textMuted },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.background, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm, elevation: 1,
  },
  menuIconBox: {
    width: 40, height: 40, borderRadius: radius.sm,
    backgroundColor: `${colors.primary}15`,
    justifyContent: "center", alignItems: "center",
  },
  menuLabel: { flex: 1, fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
  logoutItem: { marginTop: spacing.md },
});
