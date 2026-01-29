import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Workout } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "WorkoutComplete">;

export default function WorkoutCompleteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { theme } = useTheme();
  
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [progressions, setProgressions] = useState<{ exercise: string; message: string }[]>([]);
  
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  
  useEffect(() => {
    loadWorkout();
    
    scale.value = withSpring(1, { damping: 12 });
    opacity.value = withDelay(300, withSpring(1));
  }, []);
  
  const loadWorkout = async () => {
    const workouts = await storage.getWorkouts();
    const found = workouts.find((w) => w.id === route.params.workoutId);
    if (found) {
      setWorkout(found);
      
      // Calculate progressions
      const progs: { exercise: string; message: string }[] = [];
      for (const ex of found.exercises) {
        const completedSets = ex.sets.filter((s) => s.completed);
        if (completedSets.length > 0) {
          const { message } = storage.calculateProgression(
            ex.exerciseId,
            ex.exerciseName,
            ex.sets.map((s) => ({
              weight: s.weight,
              reps: s.reps,
              completed: s.completed,
            }))
          );
          progs.push({ exercise: ex.exerciseName, message });
        }
      }
      setProgressions(progs);
    }
  };
  
  const handleDone = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
  };
  
  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  
  const totalSets = workout?.exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0) || 0;
  const totalVolume = workout?.exercises.reduce((acc, ex) => {
    return acc + ex.sets.reduce((setAcc, s) => {
      if (s.completed) {
        return setAcc + s.weight * s.reps;
      }
      return setAcc;
    }, 0);
  }, 0) || 0;
  
  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing["3xl"] }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.checkmarkContainer, checkmarkStyle]}>
          <View style={[styles.checkmark, { backgroundColor: Colors.light.success }]}>
            <Feather name="check" size={48} color="#FFFFFF" />
          </View>
        </Animated.View>
        
        <Animated.View style={contentStyle}>
          <ThemedText type="h1" style={styles.title}>
            Workout Complete!
          </ThemedText>
          
          {workout ? (
            <>
              <ThemedText type="body" style={styles.subtitle}>
                {workout.routineName} - {workout.durationMinutes} minutes
              </ThemedText>
              
              <View style={styles.statsRow}>
                <Card style={styles.statCard}>
                  <ThemedText type="h2" style={{ color: Colors.light.primary }}>
                    {totalSets}
                  </ThemedText>
                  <ThemedText type="small">Sets Completed</ThemedText>
                </Card>
                <Card style={styles.statCard}>
                  <ThemedText type="h2" style={{ color: Colors.light.success }}>
                    {Math.round(totalVolume).toLocaleString()}
                  </ThemedText>
                  <ThemedText type="small">lbs Lifted</ThemedText>
                </Card>
              </View>
              
              {progressions.length > 0 ? (
                <Card style={styles.progressionCard}>
                  <ThemedText type="h4" style={styles.progressionTitle}>
                    Next Session Recommendations
                  </ThemedText>
                  {progressions.map((prog, index) => (
                    <View key={index} style={styles.progressionItem}>
                      <Feather name="trending-up" size={18} color={Colors.light.success} />
                      <View style={styles.progressionText}>
                        <ThemedText type="body" style={{ fontWeight: "600" }}>
                          {prog.exercise}
                        </ThemedText>
                        <ThemedText type="small" style={{ opacity: 0.7 }}>
                          {prog.message}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </Card>
              ) : null}
            </>
          ) : null}
        </Animated.View>
      </ScrollView>
      
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button onPress={handleDone} style={styles.doneButton}>
          Done
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  checkmarkContainer: {
    marginBottom: Spacing["2xl"],
  },
  checkmark: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
    marginBottom: Spacing["2xl"],
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    width: "100%",
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.xl,
  },
  progressionCard: {
    width: "100%",
    padding: Spacing.lg,
  },
  progressionTitle: {
    marginBottom: Spacing.lg,
  },
  progressionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  progressionText: {
    flex: 1,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  doneButton: {
    width: "100%",
  },
});
