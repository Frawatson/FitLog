import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import DashboardScreen from "@/screens/DashboardScreen";
import RoutinesStackNavigator from "@/navigation/RoutinesStackNavigator";
import RunTrackerScreen from "@/screens/RunTrackerScreen";
import NutritionStackNavigator from "@/navigation/NutritionStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

export type MainTabParamList = {
  HomeTab: undefined;
  RoutinesTab: undefined;
  RunTab: undefined;
  NutritionTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

function FABButton() {
  const navigation = useNavigation<RootNavigation>();
  
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("SelectRoutine");
  };
  
  return (
    <Pressable onPress={handlePress} style={styles.fabButton}>
      <View style={styles.fabInner}>
        <Feather name="play" size={24} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
          height: 85,
          paddingBottom: 25,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
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
          headerTitle: "NextRep",
          headerTransparent: true,
          headerBlurEffect: isDark ? "dark" : "light",
          headerTintColor: theme.text,
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="RoutinesTab"
        component={RoutinesStackNavigator}
        options={{
          title: "Routines",
          tabBarIcon: ({ color, size }) => (
            <Feather name="list" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="RunTab"
        component={RunTrackerScreen}
        options={{
          title: "Run",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Feather name="navigation" size={size} color={color} />
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

const styles = StyleSheet.create({
  fabButton: {
    position: "absolute",
    top: -30,
  },
  fabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
});
