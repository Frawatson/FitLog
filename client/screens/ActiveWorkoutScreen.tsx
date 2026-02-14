import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Routine, Workout, WorkoutExercise, WorkoutSet } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "ActiveWorkout">;

export default function ActiveWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { theme } = useTheme();
  
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [startTime] = useState(new Date());
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    loadRoutine();
    
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton onPress={handleCancel}>
          <Feather name="x" size={24} color={theme.text} />
        </HeaderButton>
      ),
    });
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  const loadRoutine = async () => {
    const routines = await storage.getRoutines();
    const found = routines.find((r) => r.id === route.params.routineId);
    if (found) {
      setRoutine(found);
      
      // Initialize exercises with empty sets
      const workoutExercises: WorkoutExercise[] = await Promise.all(
        found.exercises.map(async (ex) => {
          const lastSets = await storage.getLastWorkoutForExercise(ex.exerciseId);
          const initialSets: WorkoutSet[] = lastSets
            ? lastSets.map((s) => ({
                id: uuidv4(),
                weight: s.weight,
                reps: s.reps,
                completed: false,
              }))
            : [
                { id: uuidv4(), weight: 0, reps: 0, completed: false },
                { id: uuidv4(), weight: 0, reps: 0, completed: false },
                { id: uuidv4(), weight: 0, reps: 0, completed: false },
              ];
          
          return {
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            sets: initialSets,
          };
        })
      );
      
      setExercises(workoutExercises);
    }
  };
  
  const handleCancel = () => {
    Alert.alert(
      "Cancel Workout",
      "Are you sure you want to cancel this workout? Progress will be lost.",
      [
        { text: "Keep Training", style: "cancel" },
        {
          text: "Cancel Workout",
          style: "destructive",
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };
  
  const updateSet = (exerciseIndex: number, setIndex: number, field: "weight" | "reps", value: string) => {
    const updated = [...exercises];
    const numValue = parseInt(value) || 0;
    updated[exerciseIndex].sets[setIndex][field] = numValue;
    setExercises(updated);
  };
  
  const toggleSetComplete = (exerciseIndex: number, setIndex: number) => {
    const updated = [...exercises];
    updated[exerciseIndex].sets[setIndex].completed = !updated[exerciseIndex].sets[setIndex].completed;
    setExercises(updated);
    
    if (updated[exerciseIndex].sets[setIndex].completed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      startRestTimer();
    }
  };
  
  const addSet = (exerciseIndex: number) => {
    const updated = [...exercises];
    const lastSet = updated[exerciseIndex].sets[updated[exerciseIndex].sets.length - 1];
    updated[exerciseIndex].sets.push({
      id: uuidv4(),
      weight: lastSet?.weight || 0,
      reps: lastSet?.reps || 0,
      completed: false,
    });
    setExercises(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const removeSet = (exerciseIndex: number, setIndex: number) => {
    if (exercises[exerciseIndex].sets.length <= 1) return;
    const updated = [...exercises];
    updated[exerciseIndex].sets.splice(setIndex, 1);
    setExercises(updated);
  };
  
  const startRestTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setRestTimer(90);
    setIsResting(true);
    timerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev <= 1) {
          setIsResting(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  const stopRestTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsResting(false);
    setRestTimer(0);
  };
  
  const finishWorkout = async () => {
    if (!routine) return;
    
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    
    const workout: Workout = {
      id: uuidv4(),
      routineId: routine.id,
      routineName: routine.name,
      exercises,
      startedAt: startTime.toISOString(),
      completedAt: endTime.toISOString(),
      durationMinutes,
    };
    
    await storage.saveWorkout(workout);
    
    // Update routine's last completed date
    const updatedRoutine = { ...routine, lastCompletedAt: endTime.toISOString() };
    await storage.saveRoutine(updatedRoutine);
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.replace("WorkoutComplete", { workoutId: workout.id });
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  if (!routine) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }
  
  return (
    <ThemedView style={styles.container}>
      {isResting ? (
        <View style={[styles.restBanner, { backgroundColor: Colors.light.primary }]}>
          <View style={styles.restContent}>
            <ThemedText type="small" style={{ color: "#FFFFFF" }}>
              Rest Timer
            </ThemedText>
            <ThemedText type="h1" style={{ color: "#FFFFFF" }}>
              {formatTime(restTimer)}
            </ThemedText>
          </View>
          <AnimatedPress onPress={stopRestTimer} style={styles.skipButton}>
            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Skip
            </ThemedText>
          </AnimatedPress>
        </View>
      ) : null}
      
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.xl + (isResting ? 80 : 0),
            paddingBottom: insets.bottom + 100,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText type="h2" style={styles.routineName}>
          {routine.name}
        </ThemedText>
        
        {exercises.map((exercise, exerciseIndex) => (
          <Card key={exercise.exerciseId} style={styles.exerciseCard}>
            <ThemedText type="h4" style={styles.exerciseName}>
              {exercise.exerciseName}
            </ThemedText>
            
            <View style={styles.setHeader}>
              <ThemedText type="small" style={[styles.headerCell, { flex: 0.5 }]}>
                Set
              </ThemedText>
              <ThemedText type="small" style={styles.headerCell}>
                Weight (lbs)
              </ThemedText>
              <ThemedText type="small" style={styles.headerCell}>
                Reps
              </ThemedText>
              <View style={{ width: 44 }} />
            </View>
            
            {exercise.sets.map((set, setIndex) => (
              <View key={set.id} style={styles.setRow}>
                <ThemedText type="body" style={[styles.setNumber, { flex: 0.5 }]}>
                  {setIndex + 1}
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                    },
                  ]}
                  keyboardType="number-pad"
                  value={set.weight > 0 ? set.weight.toString() : ""}
                  onChangeText={(v) => updateSet(exerciseIndex, setIndex, "weight", v)}
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                />
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                    },
                  ]}
                  keyboardType="number-pad"
                  value={set.reps > 0 ? set.reps.toString() : ""}
                  onChangeText={(v) => updateSet(exerciseIndex, setIndex, "reps", v)}
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                />
                <AnimatedPress
                  onPress={() => toggleSetComplete(exerciseIndex, setIndex)}
                  style={[
                    styles.checkButton,
                    {
                      backgroundColor: set.completed
                        ? Colors.light.success
                        : theme.backgroundDefault,
                    },
                  ]}
                >
                  <Feather
                    name="check"
                    size={20}
                    color={set.completed ? "#FFFFFF" : theme.textSecondary}
                  />
                </AnimatedPress>
              </View>
            ))}
            
            <AnimatedPress
              onPress={() => addSet(exerciseIndex)}
              style={styles.addSetButton}
            >
              <Feather name="plus" size={18} color={Colors.light.primary} />
              <ThemedText type="small" style={{ color: Colors.light.primary, marginLeft: Spacing.xs }}>
                Add Set
              </ThemedText>
            </AnimatedPress>
          </Card>
        ))}
      </ScrollView>
      
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button onPress={finishWorkout} style={styles.finishButton}>
          Finish Workout
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  restBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
  },
  restContent: {
    alignItems: "center",
  },
  skipButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: BorderRadius.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  routineName: {
    marginBottom: Spacing.xl,
  },
  exerciseCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  exerciseName: {
    marginBottom: Spacing.md,
  },
  setHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  headerCell: {
    flex: 1,
    opacity: 0.6,
    textAlign: "center",
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  setNumber: {
    textAlign: "center",
    fontWeight: "600",
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.xs,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  checkButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  addSetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  finishButton: {
    width: "100%",
  },
});
