import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { LineChart } from "react-native-chart-kit";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Workout } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteType = RouteProp<RootStackParamList, "ExerciseHistory">;

const screenWidth = Dimensions.get("window").width;

interface SessionData {
  date: string;
  maxWeight: number;
  totalVolume: number;
  sets: { weight: number; reps: number }[];
}

export default function ExerciseHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<RouteType>();
  const { theme, isDark } = useTheme();

  const { exerciseId, exerciseName } = route.params;
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [prWeight, setPrWeight] = useState(0);
  const [prVolume, setPrVolume] = useState(0);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const workouts = await storage.getWorkouts();
    const exerciseSessions: SessionData[] = [];

    for (const w of workouts) {
      if (!w.completedAt) continue;
      for (const ex of w.exercises) {
        if (ex.exerciseId !== exerciseId) continue;
        const completedSets = ex.sets.filter((s) => s.completed && s.weight > 0);
        if (completedSets.length === 0) continue;

        const maxWeight = Math.max(...completedSets.map((s) => s.weight));
        const totalVolume = completedSets.reduce((acc, s) => acc + s.weight * s.reps, 0);

        exerciseSessions.push({
          date: w.completedAt!,
          maxWeight,
          totalVolume,
          sets: completedSets.map((s) => ({ weight: s.weight, reps: s.reps })),
        });
      }
    }

    exerciseSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setSessions(exerciseSessions);

    if (exerciseSessions.length > 0) {
      setPrWeight(Math.max(...exerciseSessions.map((s) => s.maxWeight)));
      setPrVolume(Math.max(...exerciseSessions.map((s) => s.totalVolume)));
    }

    setIsLoading(false);
  };

  const chartConfig = {
    backgroundGradientFrom: isDark ? "#252525" : "#FFFFFF",
    backgroundGradientTo: isDark ? "#252525" : "#FFFFFF",
    color: (opacity = 1) => `rgba(255, 69, 0, ${opacity})`,
    labelColor: () => theme.textSecondary,
    strokeWidth: 2,
    propsForDots: { r: "4", strokeWidth: "1", stroke: Colors.light.primary },
    decimalPlaces: 0,
  };

  const weightChartData = sessions.length >= 2
    ? {
        labels: sessions.slice(-8).map((s) =>
          new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        ),
        datasets: [{ data: sessions.slice(-8).map((s) => s.maxWeight) }],
      }
    : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing["3xl"],
        paddingHorizontal: Spacing.lg,
      }}
    >
      <ThemedText type="h2" style={styles.exerciseName}>
        {exerciseName}
      </ThemedText>

      {isLoading ? (
        <View style={{ gap: Spacing.lg }}>
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
        </View>
      ) : sessions.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Feather name="bar-chart-2" size={40} color={theme.textSecondary} />
          <ThemedText type="body" style={{ opacity: 0.6, marginTop: Spacing.md }}>
            No history for this exercise yet
          </ThemedText>
        </Card>
      ) : (
        <>
          {/* PR Cards */}
          <View style={styles.prRow}>
            <Card style={styles.prCard}>
              <Feather name="award" size={20} color="#FFB300" />
              <ThemedText type="h3" style={{ color: Colors.light.primary, marginTop: Spacing.xs }}>
                {prWeight}
              </ThemedText>
              <ThemedText type="caption" style={{ opacity: 0.6 }}>Max Weight (lbs)</ThemedText>
            </Card>
            <Card style={styles.prCard}>
              <Feather name="trending-up" size={20} color={Colors.light.success} />
              <ThemedText type="h3" style={{ color: Colors.light.success, marginTop: Spacing.xs }}>
                {prVolume.toLocaleString()}
              </ThemedText>
              <ThemedText type="caption" style={{ opacity: 0.6 }}>Max Volume (lbs)</ThemedText>
            </Card>
          </View>

          {/* Weight Over Time Chart */}
          {weightChartData ? (
            <Card style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Feather name="trending-up" size={18} color={Colors.light.primary} />
                <ThemedText type="h4">Weight Over Sessions</ThemedText>
              </View>
              <LineChart
                data={weightChartData}
                width={screenWidth - Spacing.lg * 2 - Spacing.xl * 2}
                height={180}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withInnerLines={false}
              />
            </Card>
          ) : null}

          {/* Session History */}
          <ThemedText type="h4" style={styles.sectionTitle}>
            Session History
          </ThemedText>
          {sessions
            .slice()
            .reverse()
            .slice(0, 20)
            .map((session, i) => (
              <Card key={i} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {new Date(session.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </ThemedText>
                  {session.maxWeight === prWeight ? (
                    <View style={styles.prLabel}>
                      <Feather name="star" size={12} color="#FFB300" />
                      <ThemedText type="caption" style={{ color: "#FFB300", marginLeft: 4 }}>
                        PR
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <View style={styles.setsContainer}>
                  {session.sets.map((set, si) => (
                    <View key={si} style={styles.setChip}>
                      <ThemedText type="small" style={{ fontWeight: "600" }}>
                        {set.weight} x {set.reps}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </Card>
            ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  exerciseName: {
    marginBottom: Spacing.xl,
  },
  prRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  prCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.lg,
  },
  chartCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  chart: {
    borderRadius: BorderRadius.sm,
    marginLeft: -Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sessionCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.lg,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  prLabel: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFB30020",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  setsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  setChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(255, 69, 0, 0.1)",
    borderRadius: BorderRadius.sm,
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing["3xl"],
  },
});
