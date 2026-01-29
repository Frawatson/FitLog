import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import type { Workout } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkoutHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  
  useEffect(() => {
    loadWorkouts();
  }, []);
  
  const loadWorkouts = async () => {
    const data = await storage.getWorkouts();
    const completed = data
      .filter((w) => w.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
    setWorkouts(completed);
  };
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };
  
  const renderWorkout = ({ item }: { item: Workout }) => {
    const totalSets = item.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0
    );
    
    return (
      <Card style={styles.workoutCard}>
        <View style={styles.workoutHeader}>
          <View style={styles.workoutInfo}>
            <ThemedText type="h4">{item.routineName}</ThemedText>
            <ThemedText type="small" style={styles.workoutDate}>
              {formatDate(item.completedAt!)}
            </ThemedText>
          </View>
          <View style={styles.workoutStats}>
            <View style={styles.stat}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={styles.statText}>
                {item.durationMinutes}m
              </ThemedText>
            </View>
            <View style={styles.stat}>
              <Feather name="check-circle" size={14} color={Colors.light.success} />
              <ThemedText type="small" style={styles.statText}>
                {totalSets} sets
              </ThemedText>
            </View>
          </View>
        </View>
        
        <View style={styles.exerciseList}>
          {item.exercises.slice(0, 3).map((ex, index) => (
            <ThemedText
              key={`${ex.exerciseId}-${index}`}
              type="small"
              style={styles.exerciseName}
            >
              {ex.exerciseName}
            </ThemedText>
          ))}
          {item.exercises.length > 3 ? (
            <ThemedText type="small" style={styles.moreExercises}>
              +{item.exercises.length - 3} more
            </ThemedText>
          ) : null}
        </View>
      </Card>
    );
  };
  
  if (workouts.length === 0) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: headerHeight,
          },
        ]}
      >
        <EmptyState
          image={require("../../assets/images/empty-history.png")}
          title="No workout history"
          message="Complete your first workout to see it here"
        />
      </View>
    );
  }
  
  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      data={workouts}
      keyExtractor={(item) => item.id}
      renderItem={renderWorkout}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  workoutCard: {
    padding: Spacing.lg,
  },
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutDate: {
    opacity: 0.6,
    marginTop: Spacing.xs,
  },
  workoutStats: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statText: {
    opacity: 0.7,
  },
  exerciseList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  exerciseName: {
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 4,
  },
  moreExercises: {
    opacity: 0.6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
});
