import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

import LoginScreen from "../screens/auth/LoginScreen";
import DashboardScreen from "../screens/dashboard/DashboardScreen";
import SubscriptionsScreen from "../screens/subscriptions/SubscriptionsScreen";
import ReportsScreen from "../screens/reports/ReportsScreen";
import LeavesScreen from "../screens/leaves/LeavesScreen";
import TasksScreen from "../screens/tasks/TasksScreen";
import CalendarScreen from "../screens/calendar/CalendarScreen";
import EmployeeScreen from "../screens/employee/EmployeeScreen";
import CategoriesScreen from "../screens/categories/CategoriesScreen";
import UsersScreen from "../screens/users/UsersScreen";
import ProfileScreen from "../screens/profile/ProfileScreen";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Subscriptions: undefined;
  Reports: undefined;
  More: undefined;
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  Leaves: undefined;
  Tasks: undefined;
  Calendar: undefined;
  Employee: undefined;
  Categories: undefined;
  Users: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

const TOP_ROLES = ["Director", "Admin", "MD", "Manager"];

function MoreNavigator() {
  const { user } = useAuth();
  return (
    <MoreStack.Navigator screenOptions={{ headerTintColor: colors.primary }}>
      <MoreStack.Screen
        name="MoreMenu"
        component={require("../screens/MoreMenuScreen").default}
        options={{ title: "More" }}
      />
      <MoreStack.Screen name="Leaves" component={LeavesScreen} options={{ title: "Leaves" }} />
      <MoreStack.Screen name="Tasks" component={TasksScreen} options={{ title: "Tasks" }} />
      <MoreStack.Screen name="Calendar" component={CalendarScreen} options={{ title: "Team Calendar" }} />
      <MoreStack.Screen name="Employee" component={EmployeeScreen} options={{ title: "Employee Portal" }} />
      {user && TOP_ROLES.includes(user.role) && (
        <>
          <MoreStack.Screen name="Categories" component={CategoriesScreen} options={{ title: "Categories" }} />
          <MoreStack.Screen name="Users" component={UsersScreen} options={{ title: "User Management" }} />
        </>
      )}
      <MoreStack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </MoreStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { paddingBottom: 4, height: 60 },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string, string> = {
            Dashboard: focused ? "grid" : "grid-outline",
            Subscriptions: focused ? "card" : "card-outline",
            Reports: focused ? "bar-chart" : "bar-chart-outline",
            More: focused ? "menu" : "menu-outline",
          };
          return <Ionicons name={icons[route.name] as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: true, title: "Dashboard", headerTintColor: colors.primary }} />
      <Tab.Screen name="Subscriptions" component={SubscriptionsScreen} options={{ headerShown: true, title: "Subscriptions", headerTintColor: colors.primary }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ headerShown: true, title: "Reports", headerTintColor: colors.primary }} />
      <Tab.Screen name="More" component={MoreNavigator} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
