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
import type { UnitSystem } from "@/types";

const screenWidth = Dimensions.get("window").width;
type Period = "7d" | "30d" | "90d" | "all";

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

  const loadData = async () => {
    if (!hasLoadedRef.current) setIsLoading(true);

    const [weights, allWorkouts, targets, profile] = await Promise.all([
      storage.getBodyWeights(),
      storage.getWorkouts(),
      storage.getMacroTargets(),
      storage.getUserProfile(),
    ]);

    if (profile?.unitSystem) setUnitSystem(profile.unitSystem);
    setMacroTargets(targets);

    const cutoff = getCutoffDate(period);
    setBodyWeights(
      weights
        .filter((w) => new Date(w.date) >= cutoff)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    );
    setWorkouts(
      allWorkouts.filter((w) => w.completedAt && new Date(w.completedAt) >= cutoff)
    );

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }

    // Load daily calories in parallel (no skeleton needed)
    const days = getDaysInPeriod(period);
    const count = Math.min(days, 30);
    const today = new Date();
    const dateStrs = Array.from({ length: count }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (count - 1 - i));
      return d.toISOString().split("T")[0];
    });
    const allTotals = await Promise.all(
      dateStrs.map((dateStr) => storage.getDailyTotals(dateStr))
    );
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

  const chartConfig = {
    backgroundGradientFrom: isDark ? "#252525" : "#FFFFFF",
    backgroundGradientTo: isDark ? "#252525" : "#FFFFFF",
    color: (opacity = 1) => `rgba(255, 69, 0, ${opacity})`,
    labelColor: () => theme.textSecondary,
    strokeWidth: 2,
    propsForDots: {
      r: "4",
      strokeWidth: "1",
      stroke: Colors.light.primary,
    },
    decimalPlaces: 1,
  };

  // Body weight chart data
  const weightChartData = bodyWeights.length >= 2
    ? {
        labels: bodyWeights.slice(-7).map((w) =>
          new Date(w.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        ),
        datasets: [{
          data: bodyWeights.slice(-7).map((w) =>
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
  const muscleFrequency = getMuscleGroupFrequency(workouts);

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
                    new Date(d.date).toLocaleDateString("en-US", { day: "numeric" })
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

          {/* Muscle Group Frequency */}
          <Card style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Feather name="activity" size={20} color="#9B59B6" />
              <ThemedText type="h4">Muscle Group Frequency</ThemedText>
            </View>
            {muscleFrequency.length > 0 ? (
              <View style={styles.muscleList}>
                {muscleFrequency.map((mg, i) => {
                  const maxCount = muscleFrequency[0].count;
                  const barWidth = maxCount > 0 ? (mg.count / maxCount) * 100 : 0;
                  const weeksInPeriod = getDaysInPeriod(period) / 7;
                  const isUnderTrained = mg.count < weeksInPeriod;
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
                  Complete workouts to see muscle group data
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
    const key = weekStart.toISOString().split("T")[0];
    const volume = w.exercises.reduce((acc, ex) =>
      acc + ex.sets.reduce((s, set) =>
        s + (set.completed ? set.weight * set.reps : 0), 0), 0);
    weeks[key] = (weeks[key] || 0) + volume;
  }
  return Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, volume]) => ({
      label: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      volume: Math.round(volume),
    }));
}

function getMuscleGroupFrequency(workouts: Workout[]): { name: string; count: number }[] {
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
