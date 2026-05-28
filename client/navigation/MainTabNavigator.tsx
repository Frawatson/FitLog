import React from "react";
import { StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform } from "react-native";

import DashboardScreen from "@/screens/DashboardScreen";
import RoutinesStackNavigator, { type RoutinesStackParamList } from "@/navigation/RoutinesStackNavigator";
import RunStackNavigator, { type RunStackParamList } from "@/navigation/RunStackNavigator";
import NutritionStackNavigator, { type NutritionStackParamList } from "@/navigation/NutritionStackNavigator";
import ProfileStackNavigator, { type ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { SidebarTabBar } from "@/navigation/SidebarTabBar";
import { useTheme } from "@/hooks/useTheme";
import { usePlatform } from "@/hooks/usePlatform";
import { Colors } from "@/constants/theme";

export type MainTabParamList = {
  HomeTab: undefined;
  RoutinesTab: NavigatorScreenParams<RoutinesStackParamList> | undefined;
  RunTab: NavigatorScreenParams<RunStackParamList> | undefined;
  NutritionTab: NavigatorScreenParams<NutritionStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { isDesktopWeb } = usePlatform();

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      // On desktop web, hand the tab bar to our SidebarTabBar component and
      // tell the navigator to lay it out as a left sidebar. On native and
      // mobile/tablet web, fall back to the default bottom bar.
      tabBar={isDesktopWeb ? (props) => <SidebarTabBar {...props} /> : undefined}
      screenOptions={{
        lazy: false,
        tabBarPosition: isDesktopWeb ? "left" : "bottom",
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: isDesktopWeb
          ? undefined
          : {
              position: "absolute",
              backgroundColor: Platform.select({
                ios: "transparent",
                android: theme.backgroundRoot,
                web: theme.backgroundRoot,
                default: theme.backgroundRoot,
              }),
              borderTopWidth: 0,
              elevation: 0,
              height: 85,
              paddingBottom: 25,
            },
        tabBarBackground: () =>
          Platform.OS === "ios" && !isDesktopWeb ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DashboardScreen}
        options={{
          title: "Home",
          headerShown: true,
          headerTitle: "Gbolo",
          headerTintColor: theme.text,
          headerStyle: {
            backgroundColor: theme.backgroundRoot,
          },
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="RoutinesTab"
        component={RoutinesStackNavigator}
        options={{
          title: "Workouts",
          tabBarIcon: ({ color, size }) => (
            <Feather name="layers" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="RunTab"
        component={RunStackNavigator}
        options={{
          title: "Run",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Feather name="map-pin" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="NutritionTab"
        component={NutritionStackNavigator}
        options={{
          title: "Nutrition",
          tabBarIcon: ({ color, size }) => (
            <Feather name="pie-chart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

