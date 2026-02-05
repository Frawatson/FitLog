import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { WorkoutCalendar } from "@/components/WorkoutCalendar";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { UserProfile, MacroTargets, Routine, Workout, BodyWeightEntry, RunEntry } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { formatWeight } from "@/lib/units";
import { getApiUrl } from "@/lib/query-client";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [macros, setMacros] = useState<MacroTargets | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [todayMacros, setTodayMacros] = useState<MacroTargets>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [latestWeight, setLatestWeight] = useState<BodyWeightEntry | null>(null);
  const [streak, setStreak] = useState<StreakData>({ currentStreak: 0, longestStreak: 0, lastActivityDate: null });
  const [refreshing, setRefreshing] = useState(false);
  
  const loadData = async () => {
    const [profileData, macroData, routineData, workoutData, runData, weightData] = await Promise.all([
      storage.getUserProfile(),
      storage.getMacroTargets(),
      storage.getRoutines(),
      storage.getWorkouts(),
      storage.getRunHistory(),
      storage.getBodyWeights(),
    ]);
    
    setProfile(profileData);
    setMacros(macroData);
    setRoutines(routineData);
    setWorkouts(workoutData);
    setRuns(runData);
    
    if (weightData.length > 0) {
      const sorted = weightData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLatestWeight(sorted[0]);
    }
    
    const today = new Date().toISOString().split("T")[0];
    const todayTotals = await storage.getDailyTotals(today);
    setTodayMacros(todayTotals);
    
    // Fetch streak data from API
    try {
      const token = await AsyncStorage.getItem("@fitlog_auth_token");
      if (token) {
        const response = await fetch(`${getApiUrl()}api/streak`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const streakData = await response.json();
          setStreak(streakData);
        }
      }
    } catch (error) {
      console.log("Error fetching streak:", error);
    }
  };
  
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };
  
  const getLastWorkout = () => {
    const completed = workouts.filter((w) => w.completedAt);
    if (completed.length === 0) return null;
    return completed.sort((a, b) => 
      new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
    )[0];
  };
  
  const lastWorkout = getLastWorkout();
  const weeklyWorkouts = workouts.filter((w) => {
    if (!w.completedAt) return false;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(w.completedAt) > weekAgo;
  }).length;
  
  const getName = () => {
    // Use the authenticated user's name first, then fall back to local profile
    if (user?.name) return user.name;
    if (profile?.name) return profile.name;
    return "Athlete";
  };
  
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing["5xl"],
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <ThemedText type="h1" style={styles.greeting}>
        Welcome back, {getName()}
      </ThemedText>
      
      {routines.length > 0 ? (
        <Pressable
          onPress={() => navigation.navigate("SelectRoutine")}
          style={({ pressed }) => [
            styles.workoutCard,
            {
              backgroundColor: Colors.light.primary,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={styles.workoutCardContent}>
            <ThemedText type="h2" style={styles.workoutCardTitle}>
              Ready to train?
            </ThemedText>
            <ThemedText type="body" style={styles.workoutCardSubtitle}>
              Tap to start your workout
            </ThemedText>
          </View>
          <View style={styles.workoutCardIcon}>
            <Feather name="play" size={32} color="#FFFFFF" />
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => navigation.navigate("Main", { screen: "RoutinesTab" })}
          style={({ pressed }) => [
            styles.workoutCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              borderWidth: 2,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={styles.workoutCardContent}>
            <ThemedText type="h2">Create your first routine</ThemedText>
            <ThemedText type="body" style={{ opacity: 0.7 }}>
              Build a workout plan to get started
            </ThemedText>
          </View>
          <Feather name="plus" size={32} color={theme.text} />
        </Pressable>
      )}
      
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Feather name="zap" size={24} color={Colors.light.primary} />
          <ThemedText type="h2" style={styles.statValue}>
            {streak.currentStreak}
          </ThemedText>
          <ThemedText type="small" style={styles.statLabel}>
            Day streak
          </ThemedText>
        </Card>
        
        <Card style={styles.statCard}>
          <Feather name="award" size={24} color="#FFB300" />
          <ThemedText type="h2" style={styles.statValue}>
            {streak.longestStreak}
          </ThemedText>
          <ThemedText type="small" style={styles.statLabel}>
            Best streak
          </ThemedText>
        </Card>
      </View>
      
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Feather name="activity" size={24} color={Colors.light.success} />
          <ThemedText type="h2" style={styles.statValue}>
            {latestWeight ? formatWeight(latestWeight.weightKg, profile?.unitSystem || "imperial") : "--"}
          </ThemedText>
          <ThemedText type="small" style={styles.statLabel}>
            Current weight
          </ThemedText>
        </Card>
        
        <Card style={styles.statCard}>
          <Feather name="target" size={24} color={Colors.light.primary} />
          <ThemedText type="h2" style={styles.statValue}>
            {(user?.weightGoalKg || profile?.weightGoalKg) ? formatWeight(user?.weightGoalKg || profile?.weightGoalKg || 0, profile?.unitSystem || "imperial") : "--"}
          </ThemedText>
          <ThemedText type="small" style={styles.statLabel}>
            Weight goal
          </ThemedText>
        </Card>
      </View>
      
            
      <View style={styles.calendarSection}>
        <ThemedText type="h4" style={styles.sectionTitle}>Your Activity</ThemedText>
        <WorkoutCalendar 
          workouts={workouts} 
          runs={runs}
          onDayPress={(date) => {
            const dayWorkouts = workouts.filter(w => 
              w.completedAt && new Date(w.completedAt).toISOString().split("T")[0] === date
            );
            if (dayWorkouts.length > 0) {
              navigation.navigate("WorkoutDetail", { workoutId: dayWorkouts[0].id });
            }
          }}
        />
      </View>
      
      
      {macros ? (
        <Card style={styles.macrosCard}>
          <View style={styles.macrosHeader}>
            <ThemedText type="h4">Today's Nutrition</ThemedText>
            <Pressable onPress={() => navigation.navigate("Main", { screen: "NutritionTab" })}>
              <ThemedText type="link">View</ThemedText>
            </Pressable>
          </View>
          
          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <ThemedText type="small" style={{ opacity: 0.6 }}>Calories</ThemedText>
              <ThemedText type="h4">
                {todayMacros.calories} / {macros.calories}
              </ThemedText>
              <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: Colors.light.primary,
                      width: `${Math.min((todayMacros.calories / macros.calories) * 100, 100)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
          
          <View style={styles.macroRow}>
            <View style={styles.macroMini}>
              <ThemedText type="small" style={{ opacity: 0.6 }}>Protein</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {todayMacros.protein}g
              </ThemedText>
            </View>
            <View style={styles.macroMini}>
              <ThemedText type="small" style={{ opacity: 0.6 }}>Carbs</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {todayMacros.carbs}g
              </ThemedText>
            </View>
            <View style={styles.macroMini}>
              <ThemedText type="small" style={{ opacity: 0.6 }}>Fat</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {todayMacros.fat}g
              </ThemedText>
            </View>
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  greeting: {
    marginBottom: Spacing.xl,
  },
  workoutCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  workoutCardContent: {
    flex: 1,
  },
  workoutCardTitle: {
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  workoutCardSubtitle: {
    color: "rgba(255,255,255,0.8)",
  },
  workoutCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    opacity: 0.6,
    textAlign: "center",
  },
  lastWorkoutCard: {
    marginBottom: Spacing.xl,
  },
  calendarSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  lastWorkoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  macrosCard: {
    marginBottom: Spacing.xl,
  },
  macrosHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  macroRow: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  macroItem: {
    flex: 1,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: Spacing.sm,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  macroMini: {
    flex: 1,
  },
});
