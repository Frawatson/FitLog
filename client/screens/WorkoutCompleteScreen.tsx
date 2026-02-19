import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, Platform } from "react-native";
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
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

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
  const [newPRs, setNewPRs] = useState<{ exercise: string; weight: number; reps: number }[]>([]);
  const viewShotRef = useRef<ViewShot>(null);
  
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

      // Check for new PRs by comparing against all previous workouts
      const previousWorkouts = workouts.filter((w) => w.id !== found.id && w.completedAt);
      const prs: { exercise: string; weight: number; reps: number }[] = [];

      for (const ex of found.exercises) {
        const completedSets = ex.sets.filter((s) => s.completed && s.weight > 0);
        if (completedSets.length === 0) continue;

        const currentMaxWeight = Math.max(...completedSets.map((s) => s.weight));

        // Find previous max weight for this exercise
        let previousMaxWeight = 0;
        for (const prevW of previousWorkouts) {
          for (const prevEx of prevW.exercises) {
            if (prevEx.exerciseId === ex.exerciseId) {
              for (const s of prevEx.sets) {
                if (s.completed && s.weight > previousMaxWeight) {
                  previousMaxWeight = s.weight;
                }
              }
            }
          }
        }

        if (currentMaxWeight > previousMaxWeight && previousMaxWeight > 0) {
          const bestSet = completedSets.find((s) => s.weight === currentMaxWeight);
          prs.push({
            exercise: ex.exerciseName,
            weight: currentMaxWeight,
            reps: bestSet?.reps || 0,
          });
        }
      }
      setNewPRs(prs);
    }
  };
  
  const handleDone = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
  };

  const handleShare = async () => {
    try {
      if (!viewShotRef.current?.capture) return;
      const uri = await viewShotRef.current.capture();
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share Workout Summary",
        });
      }
    } catch (error) {
      console.error("Error sharing workout:", error);
    }
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
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 1 }}
            style={{ backgroundColor: theme.backgroundRoot, padding: Spacing.lg, borderRadius: BorderRadius["2xl"] }}
          >
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
              
              {newPRs.length > 0 ? (
                <Card style={[styles.progressionCard, { marginBottom: Spacing.lg }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.lg }}>
                    <Feather name="award" size={22} color="#FFB300" />
                    <ThemedText type="h4" style={{ color: "#FFB300" }}>New Personal Records!</ThemedText>
                  </View>
                  {newPRs.map((pr, index) => (
                    <View key={index} style={styles.progressionItem}>
                      <View style={[styles.prBadge, { backgroundColor: "#FFB30020" }]}>
                        <Feather name="star" size={16} color="#FFB300" />
                      </View>
                      <View style={styles.progressionText}>
                        <ThemedText type="body" style={{ fontWeight: "600" }}>
                          {pr.exercise}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: "#FFB300" }}>
                          {pr.weight} lbs x {pr.reps} reps
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </Card>
              ) : null}

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
          </ViewShot>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.footerButtons}>
          <Button
            onPress={handleShare}
            variant="outline"
            style={styles.shareButton}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
              <Feather name="share-2" size={18} color={Colors.light.primary} />
              <ThemedText type="body" style={{ color: Colors.light.primary, fontWeight: "600" }}>
                Share
              </ThemedText>
            </View>
          </Button>
          <Button
            onPress={() => navigation.navigate("CreatePost", {
              prefill: {
                postType: "workout" as const,
                referenceId: workout?.id,
                referenceData: workout ? {
                  routineName: workout.routineName,
                  durationMinutes: workout.durationMinutes,
                  totalSets: workout.exercises.reduce((acc: number, e: any) => acc + e.sets.length, 0),
                  exerciseCount: workout.exercises.length,
                  totalVolumeKg: workout.totalVolumeKg,
                } : undefined,
              },
            })}
            variant="outline"
            style={styles.shareButton}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
              <Feather name="users" size={18} color={Colors.light.primary} />
              <ThemedText type="body" style={{ color: Colors.light.primary, fontWeight: "600" }}>
                Post
              </ThemedText>
            </View>
          </Button>
          <Button onPress={handleDone} style={styles.doneButton}>
            Done
          </Button>
        </View>
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
  footerButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  shareButton: {
    flex: 1,
  },
  doneButton: {
    flex: 2,
  },
  prBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
