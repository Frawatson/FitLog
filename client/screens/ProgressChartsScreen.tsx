import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, ScrollView, Dimensions, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { LineChart, BarChart } from "react-native-chart-kit";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { BodyWeightEntry, Workout, MacroTargets } from "@/types";
import * as storage from "@/lib/storage";
import { formatWeight } from "@/lib/units";
import { getLocalDateString } from "@/lib/dateUtils";
import type { UnitSystem } from "@/types";

const screenWidth = Dimensions.get("window").width;
type Period = "7d" | "30d" | "90d" | "all";

// Parse YYYY-MM-DD as a local-tz Date (not UTC midnight). Used for
// chart labels, sorting, and cutoff filtering of BodyWeightEntry.date
// values produced by getLocalDateString().
const parseLocalDate = (ymd: string): Date => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export default function ProgressChartsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();

  const [period, setPeriod] = useState<Period>("30d");
  const [bodyWeights, setBodyWeights] = useState<BodyWeightEntry[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>(null);
  const [dailyCalories, setDailyCalories] = useState<{ date: string; calories: number }[]>([]);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  // Monotonic request id — every loadData bumps it; in-flight responses
  // ignore their results if a newer call has started. Without this,
  // rapid period taps could let an earlier slow response overwrite a
  // newer fast one. Same pattern as NutritionScreen (PR J).
  const loadRequestIdRef = useRef(0);

  const loadData = async () => {
    const requestId = ++loadRequestIdRef.current;
    if (!hasLoadedRef.current) setIsLoading(true);

    const [weights, allWorkouts, targets, profile] = await Promise.all([
      storage.getBodyWeights(),
      storage.getWorkouts(),
      storage.getMacroTargets(),
      storage.getUserProfile(),
    ]);
    if (requestId !== loadRequestIdRef.current) return;

    if (profile?.unitSystem) setUnitSystem(profile.unitSystem);
    setMacroTargets(targets);

    const cutoff = getCutoffDate(period);
    setBodyWeights(
      weights
        // BodyWeightEntry.date is YYYY-MM-DD from getLocalDateString;
        // new Date(ymd) would parse as UTC midnight and exclude entries
        // near the cutoff in negative-UTC zones. Compare in local tz.
        .filter((w) => parseLocalDate(w.date) >= cutoff)
        .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime())
    );
    setWorkouts(
      allWorkouts.filter((w) => w.completedAt && new Date(w.completedAt) >= cutoff)
    );

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }

    // Load daily calories in parallel. The chart slices to the most
    // recent 7 entries with data (see dailyCalories.slice(-7) below),
    // so fetching more than that was 23 wasted server round-trips per
    // render. Period selection currently doesn't affect the calorie
    // chart window — addressed separately.
    const CAL_WINDOW = 7;
    const days = getDaysInPeriod(period);
    const count = Math.min(days, CAL_WINDOW);
    const today = new Date();
    const dateStrs = Array.from({ length: count }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (count - 1 - i));
      return getLocalDateString(d);
    });
    const allTotals = await Promise.all(
      dateStrs.map((dateStr) => storage.getDailyTotals(dateStr))
    );
    // Same race guard as the first await — a newer load may have
    // started while these N calorie fetches were in flight.
    if (requestId !== loadRequestIdRef.current) return;
    const cals = dateStrs
      .map((dateStr, i) => ({ date: dateStr, calories: allTotals[i].calories }))
      .filter((c) => c.calories > 0);
    setDailyCalories(cals);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [period])
  );

  const getCutoffDate = (p: Period): Date => {
    const now = new Date();
    switch (p) {
      case "7d": now.setDate(now.getDate() - 7); break;
      case "30d": now.setDate(now.getDate() - 30); break;
      case "90d": now.setDate(now.getDate() - 90); break;
      case "all": return new Date(0);
    }
    return now;
  };

  const getDaysInPeriod = (p: Period): number => {
    switch (p) {
      case "7d": return 7;
      case "30d": return 30;
      case "90d": return 90;
      case "all": return 365;
    }
  };

  // Brand primary is #1B3A27 (RGB 27,58,39). Was hardcoded
  // rgba(255,69,0) — an orange-red unrelated to the palette.
  const chartConfig = {
    backgroundGradientFrom: isDark ? "#252525" : "#FFFFFF",
    backgroundGradientTo: isDark ? "#252525" : "#FFFFFF",
    color: (opacity = 1) => `rgba(27, 58, 39, ${opacity})`,
    labelColor: () => theme.textSecondary,
    strokeWidth: 2,
    propsForDots: {
      r: "4",
      strokeWidth: "1",
      stroke: Colors.light.primary,
    },
    decimalPlaces: 1,
  };

  // Local-tz parser for YYYY-MM-DD dates so chart labels and date
  // comparisons don't shift one day in negative-UTC zones. Mirrors the
  // ProfileScreen fix from PR S.
  const parseLocalDateLabel = (ymd: string) =>
    parseLocalDate(ymd).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  // Body-weight chart window should respect the selected period.
  // Previously hardcoded .slice(-7) ignored 30d/90d/all selections,
  // so "see body weight over 90 days" actually rendered only 7 points.
  const weightWindow = (() => {
    switch (period) {
      case "7d": return 7;
      case "30d": return 30;
      case "90d": return 90;
      case "all": return bodyWeights.length;
    }
  })();

  // Body weight chart data — sliced to the period's window so the
  // selector actually drives what's plotted.
  const weightSlice = bodyWeights.slice(-weightWindow);
  const weightChartData = weightSlice.length >= 2
    ? {
        labels: weightSlice.map((w) => parseLocalDateLabel(w.date)),
        datasets: [{
          data: weightSlice.map((w) =>
            unitSystem === "imperial" ? Math.round(w.weightKg * 2.20462 * 10) / 10 : w.weightKg
          ),
        }],
      }
    : null;

  // Weekly workout volume chart
  const weeklyVolumes = getWeeklyVolumes(workouts);
  const volumeChartData = weeklyVolumes.length >= 2
    ? {
        labels: weeklyVolumes.slice(-6).map((w) => w.label),
        datasets: [{ data: weeklyVolumes.slice(-6).map((w) => w.volume) }],
      }
    : null;

  // Muscle group frequency
  const exerciseFrequency = getExerciseFrequency(workouts);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing["3xl"],
        paddingHorizontal: Spacing.lg,
      }}
    >
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={[
              styles.periodButton,
              {
                backgroundColor: period === p ? Colors.light.primary : theme.backgroundSecondary,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color: period === p ? "#FFFFFF" : theme.text,
                fontWeight: "600",
              }}
            >
              {p === "all" ? "All" : p}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={{ gap: Spacing.xl }}>
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
        </View>
      ) : (
        <>
          {/* Body Weight Trend */}
          <Card style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Feather name="trending-up" size={20} color={Colors.light.success} />
              <ThemedText type="h4">Body Weight Trend</ThemedText>
            </View>
            {weightChartData ? (
              <LineChart
                data={weightChartData}
                width={screenWidth - Spacing.lg * 2 - Spacing.xl * 2}
                height={200}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(0, 208, 132, ${opacity})`,
                }}
                bezier
                style={styles.chart}
                withInnerLines={false}
                yAxisSuffix={unitSystem === "imperial" ? "" : ""}
              />
            ) : (
              <View style={styles.emptyChart}>
                <Feather name="bar-chart-2" size={32} color={theme.textSecondary} />
                <ThemedText type="small" style={{ opacity: 0.6, marginTop: Spacing.sm }}>
                  Log at least 2 body weights to see trends
                </ThemedText>
              </View>
            )}
          </Card>

          {/* Workout Volume */}
          <Card style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Feather name="bar-chart-2" size={20} color={Colors.light.primary} />
              <ThemedText type="h4">Weekly Volume</ThemedText>
            </View>
            {volumeChartData ? (
              <BarChart
                data={volumeChartData}
                width={screenWidth - Spacing.lg * 2 - Spacing.xl * 2}
                height={200}
                chartConfig={chartConfig}
                style={styles.chart}
                yAxisSuffix=""
                yAxisLabel=""
                withInnerLines={false}
              />
            ) : (
              <View style={styles.emptyChart}>
                <Feather name="bar-chart-2" size={32} color={theme.textSecondary} />
                <ThemedText type="small" style={{ opacity: 0.6, marginTop: Spacing.sm }}>
                  Complete workouts to see volume trends
                </ThemedText>
              </View>
            )}
          </Card>

          {/* Calorie Adherence */}
          <Card style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Feather name="pie-chart" size={20} color="#FFA500" />
              <ThemedText type="h4">Calorie Tracking</ThemedText>
            </View>
            {dailyCalories.length >= 2 && macroTargets ? (
              <LineChart
                data={{
                  labels: dailyCalories.slice(-7).map((d) =>
                    // d.date is YYYY-MM-DD from getLocalDateString;
                    // parseLocalDate avoids the UTC-midnight shift.
                    parseLocalDate(d.date).toLocaleDateString("en-US", { day: "numeric" })
                  ),
                  datasets: [
                    { data: dailyCalories.slice(-7).map((d) => d.calories), color: () => "#FFA500" },
                    { data: dailyCalories.slice(-7).map(() => macroTargets.calories), color: () => theme.textSecondary, withDots: false },
                  ],
                  legend: ["Actual", "Target"],
                }}
                width={screenWidth - Spacing.lg * 2 - Spacing.xl * 2}
                height={200}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(255, 165, 0, ${opacity})`,
                }}
                bezier
                style={styles.chart}
                withInnerLines={false}
              />
            ) : (
              <View style={styles.emptyChart}>
                <Feather name="bar-chart-2" size={32} color={theme.textSecondary} />
                <ThemedText type="small" style={{ opacity: 0.6, marginTop: Spacing.sm }}>
                  Log food for at least 2 days to see trends
                </ThemedText>
              </View>
            )}
          </Card>

          {/* Exercise Frequency — was labeled "Muscle Group Frequency"
              but the underlying data is per-exercise-name counts, not
              per-muscle-group. Renaming is faithful to what's shown
              without re-doing the data shape. */}
          <Card style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Feather name="activity" size={20} color="#9B59B6" />
              <ThemedText type="h4">Exercise Frequency</ThemedText>
            </View>
            {exerciseFrequency.length > 0 ? (
              <View style={styles.muscleList}>
                {exerciseFrequency.map((mg, i) => {
                  const maxCount = exerciseFrequency[0].count;
                  const barWidth = maxCount > 0 ? (mg.count / maxCount) * 100 : 0;
                  // Under-trained is "less than once per week within the
                  // selected window". For "all" the window is the entire
                  // lifetime of the account — a 52-week target makes
                  // nearly everything look under-trained, so skip the flag.
                  const weeksInPeriod = period === "all" ? null : getDaysInPeriod(period) / 7;
                  const isUnderTrained = weeksInPeriod !== null && mg.count < weeksInPeriod;
                  return (
                    <View key={i} style={styles.muscleRow}>
                      <ThemedText
                        type="small"
                        style={[
                          styles.muscleName,
                          { color: isUnderTrained ? "#FFA500" : theme.text },
                        ]}
                      >
                        {mg.name}
                      </ThemedText>
                      <View style={[styles.muscleBar, { backgroundColor: theme.backgroundSecondary }]}>
                        <View
                          style={[
                            styles.muscleBarFill,
                            {
                              width: `${barWidth}%`,
                              backgroundColor: isUnderTrained ? "#FFA500" : Colors.light.primary,
                            },
                          ]}
                        />
                      </View>
                      <ThemedText type="small" style={styles.muscleCount}>
                        {mg.count}x
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyChart}>
                <Feather name="bar-chart-2" size={32} color={theme.textSecondary} />
                <ThemedText type="small" style={{ opacity: 0.6, marginTop: Spacing.sm }}>
                  Complete workouts to see exercise data
                </ThemedText>
              </View>
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function getWeeklyVolumes(workouts: Workout[]): { label: string; volume: number }[] {
  const weeks: Record<string, number> = {};
  for (const w of workouts) {
    if (!w.completedAt) continue;
    const d = new Date(w.completedAt);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = getLocalDateString(weekStart);
    const volume = w.exercises.reduce((acc, ex) =>
      acc + ex.sets.reduce((s, set) =>
        s + (set.completed ? set.weight * set.reps : 0), 0), 0);
    weeks[key] = (weeks[key] || 0) + volume;
  }
  return Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, volume]) => {
      // Parse local YYYY-MM-DD (not UTC) so week-start labels don't
      // shift one day in negative-UTC zones — same TZ fix applied to
      // body-weight labels.
      const [y, m, d] = date.split("-").map(Number);
      const local = new Date(y, (m || 1) - 1, d || 1);
      return {
        label: local.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        volume: Math.round(volume),
      };
    });
}

function getExerciseFrequency(workouts: Workout[]): { name: string; count: number }[] {
  const freq: Record<string, number> = {};
  for (const w of workouts) {
    if (!w.completedAt) continue;
    for (const ex of w.exercises) {
      const name = ex.exerciseName;
      freq[name] = (freq[name] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  periodSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  periodButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  chartCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  chart: {
    borderRadius: BorderRadius.sm,
    marginLeft: -Spacing.lg,
  },
  emptyChart: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  muscleList: {
    gap: Spacing.sm,
  },
  muscleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  muscleName: {
    width: 100,
    fontWeight: "600",
  },
  muscleBar: {
    flex: 1,
    height: 16,
    borderRadius: 8,
    overflow: "hidden",
  },
  muscleBarFill: {
    height: "100%",
    borderRadius: 8,
  },
  muscleCount: {
    width: 30,
    textAlign: "right",
    fontWeight: "600",
  },
});
