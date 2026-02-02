import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Workout, RunEntry } from "@/types";

const ACCENT_COLOR = "#FF4500";
const RUN_COLOR = "#00CED1";

interface WorkoutCalendarProps {
  workouts: Workout[];
  runs: RunEntry[];
  onDayPress?: (date: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WorkoutCalendar({ workouts, runs, onDayPress }: WorkoutCalendarProps) {
  const { theme } = useTheme();
  
  const { weeks, currentMonth, currentYear, workoutDates, runDates } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startOffset = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const weeks: (number | null)[][] = [];
    let currentWeek: (number | null)[] = [];
    
    for (let i = 0; i < startOffset; i++) {
      currentWeek.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }
    
    const workoutDates = new Set<string>();
    workouts.forEach((w) => {
      if (w.completedAt) {
        const date = new Date(w.completedAt);
        if (date.getMonth() === month && date.getFullYear() === year) {
          workoutDates.add(date.getDate().toString());
        }
      }
    });
    
    const runDates = new Set<string>();
    runs.forEach((r) => {
      const date = new Date(r.completedAt);
      if (date.getMonth() === month && date.getFullYear() === year) {
        runDates.add(date.getDate().toString());
      }
    });
    
    return {
      weeks,
      currentMonth: now.toLocaleString("default", { month: "long" }),
      currentYear: year,
      workoutDates,
      runDates,
    };
  }, [workouts, runs]);
  
  const today = new Date().getDate();
  const isCurrentMonth = new Date().getMonth() === new Date().getMonth();
  
  const getDateString = (day: number): string => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  };
  
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={styles.header}>
        <ThemedText type="h4">{currentMonth} {currentYear}</ThemedText>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ACCENT_COLOR }]} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Workout</ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: RUN_COLOR }]} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Run</ThemedText>
          </View>
        </View>
      </View>
      
      <View style={styles.daysHeader}>
        {DAYS.map((day) => (
          <View key={day} style={styles.dayHeaderCell}>
            <ThemedText type="small" style={[styles.dayHeaderText, { color: theme.textSecondary }]}>
              {day}
            </ThemedText>
          </View>
        ))}
      </View>
      
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((day, dayIndex) => {
            const hasWorkout = day !== null && workoutDates.has(day.toString());
            const hasRun = day !== null && runDates.has(day.toString());
            const isToday = day === today && isCurrentMonth;
            
            return (
              <Pressable
                key={dayIndex}
                style={[
                  styles.dayCell,
                  isToday && [styles.todayCell, { borderColor: theme.text }],
                ]}
                onPress={() => day && onDayPress?.(getDateString(day))}
                disabled={!day}
              >
                {day !== null ? (
                  <>
                    <ThemedText
                      type="small"
                      style={[
                        styles.dayText,
                        { color: isToday ? theme.text : theme.textSecondary },
                        isToday && { fontWeight: "700" },
                      ]}
                    >
                      {day}
                    </ThemedText>
                    <View style={styles.indicators}>
                      {hasWorkout ? (
                        <View style={[styles.indicator, { backgroundColor: ACCENT_COLOR }]} />
                      ) : null}
                      {hasRun ? (
                        <View style={[styles.indicator, { backgroundColor: RUN_COLOR }]} />
                      ) : null}
                    </View>
                  </>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
      
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Feather name="zap" size={16} color={ACCENT_COLOR} />
          <ThemedText type="body" style={{ fontWeight: "600" }}>
            {workoutDates.size}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            workouts
          </ThemedText>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <Feather name="navigation" size={16} color={RUN_COLOR} />
          <ThemedText type="body" style={{ fontWeight: "600" }}>
            {runDates.size}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            runs
          </ThemedText>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <Feather name="target" size={16} color={Colors.light.success} />
          <ThemedText type="body" style={{ fontWeight: "600" }}>
            {workoutDates.size + runDates.size}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            total
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  legend: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  daysHeader: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: "center",
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: "600",
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: Spacing.xs,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
    padding: 2,
  },
  todayCell: {
    borderWidth: 2,
  },
  dayText: {
    fontSize: 12,
  },
  indicators: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
    height: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
  },
  statItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
});
