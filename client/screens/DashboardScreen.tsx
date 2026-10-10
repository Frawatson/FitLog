import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { AnimatedPress } from "@/components/AnimatedPress";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import {
  useRetractableHeader,
  RETRACTABLE_HEADER_HEIGHT,
} from "@/hooks/useRetractableHeader";
import { RetractableHeader } from "@/components/RetractableHeader";
import { useAuth } from "@/contexts/AuthContext";
import {
  Spacing,
  BorderRadius,
  Colors,
  WebMaxContent,
} from "@/constants/theme";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import type {
  UserProfile,
  MacroTargets,
  Routine,
  Workout,
  BodyWeightEntry,
  RunEntry,
  UnitSystem,
} from "@/types";
import * as storage from "@/lib/storage";
import {
  todayTraining,
  trainingRingFraction,
  type TodayTraining,
} from "@/lib/dailyTraining";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

import { getApiUrl } from "@/lib/query-client";
import { AUTH_TOKEN_KEY } from "@/lib/authStorage";
import { formatDistanceValue, formatDistanceUnit } from "@/lib/units";
import { checkAchievements, type Achievement } from "@/lib/achievements";
import { getUnreadCountApi } from "@/lib/socialStorage";
import { timeAgo } from "@/lib/timeAgo";
import {
  activityDate,
  formatMinutes,
  getLocalDateString,
  localTimeZone,
} from "@/lib/dateUtils";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ── Circular Progress Ring (SVG) ────────────────────────────────────
const RING_SIZE = 120;
const RING_WIDTH = 10;
const RADIUS = (RING_SIZE - RING_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ProgressRing({
  fraction,
  color,
  theme,
  children,
}: {
  fraction: number;
  color: string;
  theme: any;
  children: React.ReactNode;
}) {
  const pct = Math.min(Math.max(fraction, 0), 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - pct);

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignSelf: "center" }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <SvgCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          stroke={theme.backgroundSecondary}
          strokeWidth={RING_WIDTH}
          fill="none"
        />
        {pct > 0 ? (
          <SvgCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={RING_WIDTH}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        ) : null}
      </Svg>
      <View
        style={StyleSheet.compose(StyleSheet.absoluteFillObject, {
          alignItems: "center" as const,
          justifyContent: "center" as const,
        })}
      >
        {children}
      </View>
    </View>
  );
}

function CalorieRing({
  consumed,
  target,
  theme,
}: {
  consumed: number;
  target: number;
  theme: any;
}) {
  return (
    <ProgressRing
      fraction={target > 0 ? consumed / target : 0}
      color={Colors.light.primary}
      theme={theme}
    >
      <ThemedText type="h2" style={{ fontSize: 22 }}>
        {consumed}
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        / {target} cal
      </ThemedText>
    </ProgressRing>
  );
}

function WorkoutRing({
  training,
  theme,
}: {
  training: TodayTraining;
  theme: any;
}) {
  if (training.kind === "rest") {
    return (
      <ProgressRing
        fraction={1}
        color={`${Colors.light.success}40`}
        theme={theme}
      >
        <Feather name="moon" size={22} color={Colors.light.success} />
        <ThemedText
          type="caption"
          style={{ color: theme.textSecondary, marginTop: 4 }}
        >
          Rest day
        </ThemedText>
      </ProgressRing>
    );
  }
  if (training.kind === "done") {
    const hasSets = training.totalSets > 0;
    return (
      <ProgressRing
        fraction={trainingRingFraction(training)}
        color={Colors.light.success}
        theme={theme}
      >
        <Feather name="check" size={22} color={Colors.light.success} />
        <ThemedText
          type="caption"
          style={{ color: theme.textSecondary, marginTop: 4 }}
        >
          {hasSets
            ? `${training.completedSets}/${training.totalSets} sets`
            : "Done"}
        </ThemedText>
      </ProgressRing>
    );
  }
  return (
    <ProgressRing fraction={0} color={Colors.light.success} theme={theme}>
      <Feather name="play" size={22} color={theme.textSecondary} />
      <ThemedText
        type="caption"
        style={{ color: theme.textSecondary, marginTop: 4 }}
      >
        Not started
      </ThemedText>
    </ProgressRing>
  );
}

function workoutRingLabel(training: TodayTraining): string {
  switch (training.kind) {
    case "done":
      return training.sessions.map((s) => s.name).join(" + ");
    case "planned":
      return training.routine.name;
    case "rest":
      return training.routine
        ? `${training.routine.name} (optional)`
        : "Nothing planned today";
    case "open":
      return "No workout yet";
  }
}

// ── Main Dashboard ──────────────────────────────────────────────────

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { scrollHandler, headerAnimStyle } = useRetractableHeader();
  const headerHeight = RETRACTABLE_HEADER_HEIGHT + insets.top;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [macros, setMacros] = useState<MacroTargets | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [todayMacros, setTodayMacros] = useState<MacroTargets>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null,
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const loadData = async () => {
    if (!hasLoadedRef.current) setIsLoading(true);

    const [
      profileData,
      macroData,
      routineData,
      workoutData,
      runData,
      weightData,
      foodLogData,
    ] = await Promise.all([
      storage.getUserProfile(),
      storage.getMacroTargets(),
      storage.getRoutines(),
      storage.getWorkouts(),
      storage.getRunHistory(),
      storage.getBodyWeights(),
      storage.getFoodLog(),
    ]);

    setProfile(profileData);
    setMacros(macroData);
    setRoutines(routineData);
    setWorkouts(workoutData);
    setRuns(runData);

    // Compute achievements
    const foodDays = new Set(foodLogData.map((f: any) => f.date)).size;
    const achData = checkAchievements(
      {
        workouts: workoutData,
        runs: runData,
        bodyWeights: weightData,
        foodLogDays: foodDays,
        routines: routineData,
      },
      profileData?.unitSystem ?? "imperial",
    );
    setAchievements(achData);

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }

    // Today's macros, computed from the food log already in hand — this
    // used to be a second food-log request via getDailyTotals. Rounded:
    // float sums were rendering as "16.400000000000002g".
    const today = getLocalDateString();
    const todayTotals = foodLogData
      .filter((entry: any) => entry.date === today)
      .reduce(
        (acc: MacroTargets, entry: any) => ({
          calories: acc.calories + (entry.food?.calories || 0),
          protein: acc.protein + (entry.food?.protein || 0),
          carbs: acc.carbs + (entry.food?.carbs || 0),
          fat: acc.fat + (entry.food?.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
    setTodayMacros({
      calories: Math.round(todayTotals.calories),
      protein: Math.round(todayTotals.protein),
      carbs: Math.round(todayTotals.carbs),
      fat: Math.round(todayTotals.fat),
    });

    try {
      const count = await getUnreadCountApi();
      setUnreadCount(count);
    } catch {}

    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        const response = await fetch(
          (() => {
            const url = new URL("/api/streak", getApiUrl());
            const tz = localTimeZone();
            if (tz) url.searchParams.set("tz", tz);
            return url.toString();
          })(),
          { headers: { Authorization: `Bearer ${token}` } },
        );
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
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const profileUnits: UnitSystem = profile?.unitSystem ?? "imperial";

  // ── Derived data ────────────────────────────────────────────────
  const weeklyWorkouts = workouts.filter((w) => {
    if (!w.completedAt) return false;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return activityDate(w) > weekAgo;
  }).length;

  const training = todayTraining({ workouts, runs, routines });

  const onWorkoutRingPress = () => {
    if (training.kind === "done") {
      const last = training.sessions[training.sessions.length - 1];
      if (last.type === "workout") {
        navigation.navigate("WorkoutDetail", { workoutId: last.id });
      } else {
        navigation.navigate("RunDetail", { runId: last.id });
      }
    } else if (training.kind === "planned") {
      navigation.navigate("ActiveWorkout", { routineId: training.routine.id });
    } else if (training.kind === "rest" && training.routine) {
      navigation.navigate("ActiveWorkout", { routineId: training.routine.id });
    } else if (routines.length > 0) {
      navigation.navigate("SelectRoutine");
    } else {
      navigation.navigate("Main", { screen: "RoutinesTab" });
    }
  };

  const getName = () => {
    const fullName = user?.name || profile?.name || "Athlete";
    return fullName.split(" ")[0];
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Merge recent workouts + runs, sorted by date, take top 3
  const recentActivity = [
    ...workouts
      .filter((w) => w.completedAt)
      .map((w) => ({
        type: "workout" as const,
        id: w.id,
        name: w.routineName,
        date: w.startedAt || w.completedAt!,
        exerciseCount: w.exercises.length,
      })),
    ...runs.map((r) => ({
      type: "run" as const,
      id: r.id,
      name: `${formatDistanceValue(r.distanceKm, profileUnits).toFixed(1)} ${formatDistanceUnit(profileUnits)} Run`,
      date: r.startedAt || r.completedAt,
      durationMin: r.durationSeconds
        ? Math.round(r.durationSeconds / 60)
        : undefined,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  // Find next achievement to unlock (closest to completion among locked ones)
  const nextAchievement =
    achievements
      .filter((a) => !a.unlocked && a.threshold > 0)
      .sort((a, b) => b.progress / b.threshold - a.progress / a.threshold)[0] ||
    null;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <>
      <RetractableHeader
        // Dedicated transparent logo so the header adapts to dark/light mode
        // — icon.png has to stay opaque-green for the App Store.
        logoSource={require("../../assets/images/header-logo.png")}
        logoHeight={32}
        animatedStyle={headerAnimStyle}
      />
      <Animated.ScrollView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{
          ...WebMaxContent,
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing["5xl"],
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ── 1. Smart Greeting + Status Bar ─────────────────────── */}
        <View style={styles.greetingSection}>
          <ThemedText type="h1">
            {getGreeting()}, {getName()}
          </ThemedText>
          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Feather name="zap" size={14} color={Colors.light.primary} />
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginLeft: 4 }}
              >
                {streak.currentStreak} day streak
              </ThemedText>
            </View>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: theme.textSecondary },
              ]}
            />
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {weeklyWorkouts} workout{weeklyWorkouts !== 1 ? "s" : ""} this
              week
            </ThemedText>
          </View>
        </View>

        {isLoading ? (
          <View style={{ gap: Spacing.xl }}>
            <SkeletonLoader variant="card" />
            <View style={{ flexDirection: "row", gap: Spacing.md }}>
              <View style={{ flex: 1 }}>
                <SkeletonLoader variant="card" />
              </View>
              <View style={{ flex: 1 }}>
                <SkeletonLoader variant="card" />
              </View>
            </View>
            <SkeletonLoader variant="card" />
            <SkeletonLoader variant="card" />
          </View>
        ) : (
          <>
            {/* ── 2. Quick Actions Row ─────────────────────────────── */}
            <View style={styles.quickActions}>
              <AnimatedPress
                onPress={() =>
                  routines.length > 0
                    ? navigation.navigate("SelectRoutine")
                    : navigation.navigate("Main", { screen: "RoutinesTab" })
                }
                style={[
                  styles.quickTile,
                  { backgroundColor: Colors.light.primary },
                ]}
              >
                <Feather name="play" size={24} color="#FFFFFF" />
                <ThemedText
                  type="caption"
                  style={{ color: "#FFFFFF", marginTop: Spacing.xs }}
                >
                  Workout
                </ThemedText>
              </AnimatedPress>

              <AnimatedPress
                onPress={() =>
                  navigation.navigate("Main", { screen: "RunTab" })
                }
                style={[
                  styles.quickTile,
                  { backgroundColor: theme.backgroundDefault },
                ]}
              >
                <Feather
                  name="map-pin"
                  size={24}
                  color={Colors.light.success}
                />
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
                >
                  Run
                </ThemedText>
              </AnimatedPress>

              <AnimatedPress
                onPress={() => navigation.navigate("AddFood")}
                style={[
                  styles.quickTile,
                  { backgroundColor: theme.backgroundDefault },
                ]}
              >
                <Feather name="pie-chart" size={24} color="#818cf8" />
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
                >
                  Log Food
                </ThemedText>
              </AnimatedPress>

              <AnimatedPress
                onPress={() =>
                  navigation.navigate("Main", {
                    screen: "ProfileTab",
                    params: { screen: "ProgressCharts" },
                  })
                }
                style={[
                  styles.quickTile,
                  { backgroundColor: theme.backgroundDefault },
                ]}
              >
                <Feather
                  name="trending-up"
                  size={24}
                  color={Colors.light.primary}
                />
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
                >
                  Progress
                </ThemedText>
              </AnimatedPress>
            </View>

            {/* ── 3. Today's Progress (Training + Nutrition) ── */}
            <Card style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="h4">Today&apos;s Progress</ThemedText>
              </View>

              <View style={styles.ringRow}>
                <Pressable
                  onPress={onWorkoutRingPress}
                  style={styles.ringColumn}
                  accessibilityRole="button"
                  accessibilityLabel={`Workout: ${workoutRingLabel(training)}`}
                >
                  <WorkoutRing training={training} theme={theme} />
                  <ThemedText type="small" style={styles.ringTitle}>
                    Workout
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    numberOfLines={2}
                    style={[
                      styles.ringSubtitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {workoutRingLabel(training)}
                  </ThemedText>
                </Pressable>

                {macros ? (
                  <Pressable
                    onPress={() =>
                      navigation.navigate("Main", { screen: "NutritionTab" })
                    }
                    style={styles.ringColumn}
                    accessibilityRole="button"
                    accessibilityLabel="Calories: open nutrition"
                  >
                    <CalorieRing
                      consumed={todayMacros.calories}
                      target={macros.calories}
                      theme={theme}
                    />
                    <ThemedText type="small" style={styles.ringTitle}>
                      Calories
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      numberOfLines={2}
                      style={[
                        styles.ringSubtitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {Math.max(macros.calories - todayMacros.calories, 0)} left
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>

              {macros ? (
                <View style={styles.macroPills}>
                  {(
                    [
                      {
                        label: "Protein",
                        value: todayMacros.protein,
                        target: macros.protein,
                      },
                      {
                        label: "Carbs",
                        value: todayMacros.carbs,
                        target: macros.carbs,
                      },
                      {
                        label: "Fat",
                        value: todayMacros.fat,
                        target: macros.fat,
                      },
                    ] as const
                  ).map((m) => (
                    <View
                      key={m.label}
                      style={[
                        styles.macroPill,
                        { backgroundColor: theme.backgroundDefault },
                      ]}
                    >
                      <ThemedText
                        type="caption"
                        style={{ color: theme.textSecondary }}
                      >
                        {m.label}
                      </ThemedText>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {m.value}g{" "}
                        <ThemedText
                          type="caption"
                          style={{ color: theme.textSecondary }}
                        >
                          / {m.target}g
                        </ThemedText>
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>

            {!macros ? (
              <AnimatedPress
                onPress={() => navigation.navigate("EditMacros")}
                style={[
                  styles.ctaCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Feather
                  name="pie-chart"
                  size={24}
                  color={Colors.light.primary}
                />
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <ThemedText type="h4">Set your nutrition goals</ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Track calories and macros daily
                  </ThemedText>
                </View>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={theme.textSecondary}
                />
              </AnimatedPress>
            ) : null}

            {/* ── Community Card ──────────────────────────────────── */}
            <AnimatedPress
              onPress={() => navigation.navigate("SocialFeed")}
              style={[
                styles.communityCard,
                {
                  backgroundColor: theme.backgroundCard,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={{ position: "relative" }}>
                <Feather name="users" size={22} color={Colors.light.primary} />
                {unreadCount > 0 && <View style={styles.badge} />}
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.lg }}>
                <ThemedText type="h4">Community</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  See what others are training
                </ThemedText>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color={theme.textSecondary}
              />
            </AnimatedPress>

            {/* ── 4. Streak Banner + Achievement Spotlight ─────────── */}
            <Card style={styles.section}>
              <View style={styles.streakBanner}>
                <View style={styles.streakLeft}>
                  <View
                    style={[
                      styles.streakIcon,
                      { backgroundColor: `${Colors.light.primary}20` },
                    ]}
                  >
                    <Feather
                      name="zap"
                      size={22}
                      color={Colors.light.primary}
                    />
                  </View>
                  <View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        gap: Spacing.xs,
                      }}
                    >
                      <ThemedText type="h1" style={{ fontSize: 28 }}>
                        {streak.currentStreak}
                      </ThemedText>
                      <ThemedText
                        type="body"
                        style={{ color: theme.textSecondary }}
                      >
                        day streak
                      </ThemedText>
                    </View>
                    {streak.currentStreak === 0 && streak.longestStreak > 0 && (
                      <ThemedText
                        type="caption"
                        style={{ color: Colors.light.primary }}
                      >
                        Start a new streak today!
                      </ThemedText>
                    )}
                  </View>
                </View>
                <View
                  style={[
                    styles.bestBadge,
                    { backgroundColor: theme.backgroundDefault },
                  ]}
                >
                  <Feather name="award" size={14} color="#FFB300" />
                  <ThemedText type="caption" style={{ marginLeft: 4 }}>
                    Best: {streak.longestStreak}
                  </ThemedText>
                </View>
              </View>

              {nextAchievement && (
                <AnimatedPress
                  onPress={() =>
                    navigation.navigate("Main", { screen: "ProfileTab" })
                  }
                  style={[
                    styles.achievementRow,
                    { backgroundColor: theme.backgroundDefault },
                  ]}
                >
                  <View
                    style={[
                      styles.achievementIcon,
                      { backgroundColor: `${Colors.light.primary}15` },
                    ]}
                  >
                    <Feather
                      name={nextAchievement.icon as any}
                      size={18}
                      color={Colors.light.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" style={{ fontWeight: "600" }}>
                      {nextAchievement.title}
                    </ThemedText>
                    <View
                      style={[
                        styles.miniBar,
                        {
                          backgroundColor: theme.backgroundSecondary,
                          marginTop: Spacing.xs,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.miniBarFill,
                          {
                            backgroundColor: Colors.light.primary,
                            width: `${Math.min((nextAchievement.progress / nextAchievement.threshold) * 100, 100)}%`,
                          },
                        ]}
                      />
                    </View>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                    >
                      {nextAchievement.progress} / {nextAchievement.threshold} —{" "}
                      {nextAchievement.description}
                    </ThemedText>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={16}
                    color={theme.textSecondary}
                  />
                </AnimatedPress>
              )}
            </Card>

            {/* ── 5. Recent Activity ───────────────────────────────── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="h4">Recent Activity</ThemedText>
              </View>

              {recentActivity.length > 0 ? (
                recentActivity.map((item, index) => (
                  <AnimatedPress
                    key={`${item.type}-${item.id}`}
                    onPress={() => {
                      if (item.type === "workout") {
                        navigation.navigate("WorkoutDetail", {
                          workoutId: item.id,
                        });
                      } else {
                        const run = runs.find((r) => r.id === item.id);
                        if (run)
                          navigation.navigate("RunDetail", { runId: run.id });
                      }
                    }}
                    style={[
                      styles.activityItem,
                      {
                        backgroundColor: theme.backgroundCard,
                        borderColor: theme.cardBorder,
                      },
                      index < recentActivity.length - 1 && {
                        marginBottom: Spacing.sm,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.activityIcon,
                        {
                          backgroundColor:
                            item.type === "workout"
                              ? `${Colors.light.primary}15`
                              : `${Colors.light.success}15`,
                        },
                      ]}
                    >
                      <Feather
                        name={item.type === "workout" ? "activity" : "map-pin"}
                        size={18}
                        color={
                          item.type === "workout"
                            ? Colors.light.primary
                            : Colors.light.success
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {item.name}
                      </ThemedText>
                      <ThemedText
                        type="caption"
                        style={{ color: theme.textSecondary }}
                      >
                        {item.type === "workout" && "exerciseCount" in item
                          ? `${item.exerciseCount} exercises`
                          : ""}
                        {item.type === "run" &&
                        "durationMin" in item &&
                        item.durationMin
                          ? formatMinutes(item.durationMin)
                          : ""}
                      </ThemedText>
                    </View>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary }}
                    >
                      {timeAgo(item.date)}
                    </ThemedText>
                  </AnimatedPress>
                ))
              ) : (
                <View
                  style={[
                    styles.emptyActivity,
                    { backgroundColor: theme.backgroundDefault },
                  ]}
                >
                  <Feather
                    name="sun"
                    size={28}
                    color={theme.textSecondary}
                    style={{ opacity: 0.4 }}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: theme.textSecondary,
                      textAlign: "center",
                      marginTop: Spacing.sm,
                    }}
                  >
                    No activity yet — start your first workout!
                  </ThemedText>
                </View>
              )}
            </View>
          </>
        )}
      </Animated.ScrollView>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Greeting
  greetingSection: {
    marginBottom: Spacing.xl,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: Spacing.sm,
  },

  // Quick actions
  quickActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  quickTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },

  // Sections
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },

  // Nutrition ring
  ringRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: Spacing.md,
  },
  ringColumn: {
    flex: 1,
    alignItems: "center",
  },
  ringTitle: {
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
  ringSubtitle: {
    textAlign: "center",
    marginTop: 2,
  },
  macroPills: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  macroPill: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  miniBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  miniBarFill: {
    height: "100%",
    borderRadius: 2,
  },

  // CTA Card (empty nutrition)
  ctaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: Spacing.xl,
  },

  // Streak
  streakBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streakLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  streakIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  bestBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },

  // Achievement
  achievementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  achievementIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  // Recent activity
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  emptyActivity: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["3xl"],
    borderRadius: BorderRadius.md,
  },

  // Community card
  communityCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.error,
  },
});
