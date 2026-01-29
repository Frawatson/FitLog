import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Workout } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type WorkoutDetailRouteProp = RouteProp<RootStackParamList, "WorkoutDetail">;

export default function WorkoutDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<WorkoutDetailRouteProp>();
  const { theme } = useTheme();
  
  const [workout, setWorkout] = useState<Workout | null>(null);
  
  useEffect(() => {
    loadWorkout();
  }, []);
  
  const loadWorkout = async () => {
    const workouts = await storage.getWorkouts();
    const found = workouts.find((w) => w.id === route.params.workoutId);
    setWorkout(found || null);
  };
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };
  
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  
  if (!workout) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <ThemedText type="body" style={{ textAlign: "center", marginTop: Spacing.xl }}>
          Loading workout...
        </ThemedText>
      </View>
    );
  }
  
  const totalSets = workout.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  );
  
  const totalVolume = workout.exercises.reduce((acc, ex) => {
    return acc + ex.sets.reduce((setAcc, set) => {
      if (set.completed) {
        return setAcc + (set.weight * set.reps);
      }
      return setAcc;
    }, 0);
  }, 0);
  
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <Card style={styles.summaryCard}>
        <ThemedText type="h2" style={styles.routineName}>{workout.routineName}</ThemedText>
        <ThemedText type="small" style={styles.dateText}>
          {formatDate(workout.completedAt!)}
        </ThemedText>
        <ThemedText type="small" style={styles.timeText}>
          {formatTime(workout.startedAt)} - {formatTime(workout.completedAt!)}
        </ThemedText>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Feather name="clock" size={20} color={Colors.light.primary} />
            <ThemedText type="h3" style={styles.statValue}>{workout.durationMinutes}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>minutes</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Feather name="check-circle" size={20} color={Colors.light.success} />
            <ThemedText type="h3" style={styles.statValue}>{totalSets}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>sets</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Feather name="trending-up" size={20} color={Colors.light.primary} />
            <ThemedText type="h3" style={styles.statValue}>{Math.round(totalVolume)}</ThemedText>
            <ThemedText type="small" style={styles.statLabel}>lbs volume</ThemedText>
          </View>
        </View>
      </Card>
      
      <ThemedText type="h3" style={styles.sectionTitle}>Exercises</ThemedText>
      
      {workout.exercises.map((exercise, exerciseIndex) => (
        <Card key={`${exercise.exerciseId}-${exerciseIndex}`} style={styles.exerciseCard}>
          <ThemedText type="h4" style={styles.exerciseName}>{exercise.exerciseName}</ThemedText>
          
          <View style={styles.setsHeader}>
            <ThemedText type="small" style={[styles.setHeaderText, { flex: 1 }]}>Set</ThemedText>
            <ThemedText type="small" style={[styles.setHeaderText, { flex: 2, textAlign: "center" }]}>Weight</ThemedText>
            <ThemedText type="small" style={[styles.setHeaderText, { flex: 2, textAlign: "center" }]}>Reps</ThemedText>
            <ThemedText type="small" style={[styles.setHeaderText, { width: 30 }]}></ThemedText>
          </View>
          
          {exercise.sets.map((set, setIndex) => (
            <View 
              key={set.id} 
              style={[
                styles.setRow,
                !set.completed && styles.skippedSet,
              ]}
            >
              <ThemedText type="body" style={[styles.setNumber, { flex: 1 }]}>
                {setIndex + 1}
              </ThemedText>
              <ThemedText type="body" style={[styles.setValue, { flex: 2, textAlign: "center" }]}>
                {set.weight} lbs
              </ThemedText>
              <ThemedText type="body" style={[styles.setValue, { flex: 2, textAlign: "center" }]}>
                {set.reps}
              </ThemedText>
              <View style={{ width: 30, alignItems: "center" }}>
                {set.completed ? (
                  <Feather name="check" size={16} color={Colors.light.success} />
                ) : (
                  <Feather name="x" size={16} color={theme.textSecondary} />
                )}
              </View>
            </View>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  routineName: {
    marginBottom: Spacing.xs,
  },
  dateText: {
    opacity: 0.7,
  },
  timeText: {
    opacity: 0.5,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  statValue: {
    marginTop: Spacing.xs,
  },
  statLabel: {
    opacity: 0.6,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  exerciseCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  exerciseName: {
    marginBottom: Spacing.md,
  },
  setsHeader: {
    flexDirection: "row",
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
    marginBottom: Spacing.sm,
  },
  setHeaderText: {
    opacity: 0.6,
    fontWeight: "600",
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  skippedSet: {
    opacity: 0.4,
  },
  setNumber: {
    fontWeight: "600",
  },
  setValue: {
    fontWeight: "500",
  },
});
