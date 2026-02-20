import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { WorkoutCalendar } from "@/components/WorkoutCalendar";
import { AnimatedPress } from "@/components/AnimatedPress";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Workout, RunEntry } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getLocalDateString } from "@/lib/dateUtils";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkoutHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [workoutData, runData] = await Promise.all([
      storage.getWorkouts(),
      storage.getRunHistory(),
    ]);
    setWorkouts(workoutData.filter((w) => w.completedAt));
    setRuns(runData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const formatSelectedDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const dayWorkouts = selectedDate
    ? workouts.filter((w) => {
        if (!w.completedAt) return false;
        return getLocalDateString(new Date(w.completedAt)) === selectedDate;
      })
    : [];

  const dayRuns = selectedDate
    ? runs.filter((r) => {
        const d = r.completedAt || r.startedAt;
        return getLocalDateString(new Date(d)) === selectedDate;
      })
    : [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing["3xl"],
        paddingHorizontal: Spacing.lg,
      }}
    >
      <WorkoutCalendar
        workouts={workouts}
        runs={runs}
        onDayPress={(date) => setSelectedDate(date)}
      />

      {selectedDate && (
        <View style={styles.selectedDay}>
          <ThemedText type="h4" style={styles.selectedDateText}>
            {formatSelectedDate(selectedDate)}
          </ThemedText>

          {dayWorkouts.length === 0 && dayRuns.length === 0 ? (
            <View style={[styles.emptyDay, { backgroundColor: theme.backgroundDefault }]}>
              <Feather name="calendar" size={24} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                No activity on this day
              </ThemedText>
            </View>
          ) : (
            <View style={styles.activityList}>
              {dayWorkouts.map((w) => {
                const totalSets = w.exercises.reduce(
                  (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
                  0
                );
                return (
                  <AnimatedPress
                    key={w.id}
                    onPress={() => navigation.navigate("WorkoutDetail", { workoutId: w.id })}
                    style={[styles.activityItem, { backgroundColor: theme.backgroundCard, borderColor: theme.cardBorder }]}
                  >
                    <View style={[styles.activityIcon, { backgroundColor: `${Colors.light.primary}15` }]}>
                      <Feather name="activity" size={18} color={Colors.light.primary} />
                    </View>
                    <View style={styles.activityInfo}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>{w.routineName}</ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {w.exercises.length} exercises · {totalSets} sets
                        {w.durationMinutes ? ` · ${w.durationMinutes}m` : ""}
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={16} color={theme.textSecondary} />
                  </AnimatedPress>
                );
              })}

              {dayRuns.map((r) => (
                <AnimatedPress
                  key={r.id}
                  onPress={() => navigation.navigate("RunDetail", { run: r })}
                  style={[styles.activityItem, { backgroundColor: theme.backgroundCard, borderColor: theme.cardBorder }]}
                >
                  <View style={[styles.activityIcon, { backgroundColor: `${Colors.light.success}15` }]}>
                    <Feather name="map-pin" size={18} color={Colors.light.success} />
                  </View>
                  <View style={styles.activityInfo}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {r.distanceKm.toFixed(1)} km Run
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {r.durationSeconds ? `${Math.round(r.durationSeconds / 60)} min` : ""}
                      {r.calories ? ` · ${r.calories} cal` : ""}
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={16} color={theme.textSecondary} />
                </AnimatedPress>
              ))}
            </View>
          )}
        </View>
      )}

      {!selectedDate && (
        <View style={[styles.emptyDay, { backgroundColor: theme.backgroundDefault, marginTop: Spacing.xl }]}>
          <Feather name="hand-pointing" size={24} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            Tap a day to see your activities
          </ThemedText>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  selectedDay: {
    marginTop: Spacing.xl,
  },
  selectedDateText: {
    marginBottom: Spacing.md,
  },
  activityList: {
    gap: Spacing.sm,
  },
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
  activityInfo: {
    flex: 1,
  },
  emptyDay: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["3xl"],
    borderRadius: BorderRadius.md,
  },
});
