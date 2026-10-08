import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Pressable,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight, HeaderButton } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { ExerciseInfoModal } from "@/components/ExerciseInfoModal";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type {
  Routine,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  UnitSystem,
} from "@/types";
import * as storage from "@/lib/storage";
import { weightLabel } from "@/lib/units";
import { showSystemMenu } from "@/components/SystemMenu";
import { webSafeAlert } from "@/lib/webSafeAlert";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "ActiveWorkout">;

// In-progress session, persisted so a page refresh / browser Back / app
// kill doesn't silently destroy a half-finished workout.
const WORKOUT_DRAFT_KEY = "@merge_active_workout_draft";
const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

interface WorkoutDraft {
  routineId: string;
  startedAt: string;
  exercises: WorkoutExercise[];
}

export default function ActiveWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { theme } = useTheme();

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [startTime, setStartTime] = useState(new Date());
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restDuration, setRestDuration] = useState(90);
  const [showRestPicker, setShowRestPicker] = useState(false);
  const [restingExerciseIndex, setRestingExerciseIndex] = useState<
    number | null
  >(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  const [showExerciseInfo, setShowExerciseInfo] = useState(false);
  const [selectedExerciseName, setSelectedExerciseName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Raw text being typed into weight/reps cells, keyed by set id. The
  // numeric model can't hold intermediate states like "22." — parsing
  // on every keystroke ate the decimal point, which made 22.5 kg (or any
  // 2.5 lb microplate load) impossible to enter.
  const [draftText, setDraftText] = useState<
    Record<string, { weight?: string; reps?: string }>
  >({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Wall-clock end of the current rest. Counting "ticks" drifts badly on
  // web, where background tabs throttle intervals to ~1/min.
  const restEndsAtRef = useRef<number | null>(null);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exercisesRef = useRef<WorkoutExercise[]>([]);
  exercisesRef.current = exercises;

  useEffect(() => {
    loadUnitSystem();
    loadRestDuration();
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

  const loadUnitSystem = async () => {
    const profile = await storage.getUserProfile();
    if (profile?.unitSystem) {
      setUnitSystem(profile.unitSystem);
    }
  };

  const loadRestDuration = async () => {
    const saved = await AsyncStorage.getItem("@merge_rest_duration");
    if (saved) {
      setRestDuration(parseInt(saved) || 90);
    }
  };

  const saveRestDuration = async (seconds: number) => {
    setRestDuration(seconds);
    await AsyncStorage.setItem("@merge_rest_duration", seconds.toString());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const loadRoutine = async () => {
    const routines = await storage.getRoutines();
    const found = routines.find((r) => r.id === route.params.routineId);
    if (!found) {
      // Previously this left "Loading..." up forever (e.g. a routine
      // created offline that a server fetch clobbered, or a stale link).
      setLoadFailed(true);
      return;
    }
    setRoutine(found);

    // Resume an interrupted session for this routine (refresh, crash,
    // closed tab) if a recent draft exists.
    try {
      const draftRaw = await AsyncStorage.getItem(WORKOUT_DRAFT_KEY);
      if (draftRaw) {
        const draft: WorkoutDraft = JSON.parse(draftRaw);
        const ageMs = Date.now() - new Date(draft.startedAt).getTime();
        if (
          draft.routineId === found.id &&
          ageMs >= 0 &&
          ageMs < DRAFT_MAX_AGE_MS &&
          Array.isArray(draft.exercises) &&
          draft.exercises.length > 0
        ) {
          setExercises(draft.exercises);
          setStartTime(new Date(draft.startedAt));
          return;
        }
        // Stale, or for a different routine — discard it.
        await AsyncStorage.removeItem(WORKOUT_DRAFT_KEY);
      }
    } catch {
      // Unreadable draft — start fresh.
    }

    // One history read for the whole screen. This used to call
    // getLastWorkoutForExercise per exercise, and EACH call downloaded
    // the user's entire workout history from the server.
    const workouts = await storage.getWorkouts();
    const sorted = workouts
      .filter((w) => w.completedAt)
      .sort(
        (a, b) =>
          new Date(b.completedAt!).getTime() -
          new Date(a.completedAt!).getTime(),
      );
    const lastSetsFor = (exerciseId: string) => {
      for (const workout of sorted) {
        const ex = workout.exercises.find((e) => e.exerciseId === exerciseId);
        if (ex && ex.sets.length > 0) return ex.sets;
      }
      return null;
    };

    const workoutExercises: WorkoutExercise[] = found.exercises.map((ex) => {
      const lastSets = lastSetsFor(ex.exerciseId);
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
    });

    setExercises(workoutExercises);
  };

  // Persist the in-progress session (debounced — state changes on every
  // keystroke). Cleared on finish/cancel.
  useEffect(() => {
    if (!routine || exercises.length === 0 || isSaving) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      const draft: WorkoutDraft = {
        routineId: routine.id,
        startedAt: startTime.toISOString(),
        exercises: exercisesRef.current,
      };
      AsyncStorage.setItem(WORKOUT_DRAFT_KEY, JSON.stringify(draft)).catch(
        () => {},
      );
    }, 400);
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [exercises, routine, startTime, isSaving]);

  // Warn before the tab closes mid-workout (web). The draft above makes
  // a refresh recoverable, but an intentional-looking close still gets a
  // chance to be cancelled once any set has been completed.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const hasProgress = exercises.some((e) => e.sets.some((s) => s.completed));
    if (!hasProgress || isSaving) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set for the prompt to show.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [exercises, isSaving]);

  const handleCancel = () => {
    // Alert.alert is a no-op on react-native-web, so the X button felt
    // dead on the web build — user tapped, nothing happened. Native uses
    // the proper Alert; web falls back to window.confirm.
    const proceed = () => {
      AsyncStorage.removeItem(WORKOUT_DRAFT_KEY).catch(() => {});
      navigation.goBack();
    };
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm("Cancel this workout? Progress will be lost.")
      ) {
        proceed();
      }
      return;
    }
    Alert.alert(
      "Cancel Workout",
      "Are you sure you want to cancel this workout? Progress will be lost.",
      [
        { text: "Keep Training", style: "cancel" },
        {
          text: "Cancel Workout",
          style: "destructive",
          onPress: proceed,
        },
      ],
    );
  };

  // Outer bounds match the TextInput maxLength (4 chars weight, 3 reps).
  // Defensive: paste / autofill could in theory bypass maxLength.
  const MAX_WEIGHT = 9999;
  const MAX_REPS = 999;

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: "weight" | "reps",
    value: string,
  ) => {
    const set = exercises[exerciseIndex].sets[setIndex];

    // Weights accept decimals (22.5 kg, 2.5 lb microplates); reps stay
    // whole numbers. The raw text is kept per-set so intermediate states
    // like "22." survive the keystroke instead of being parsed away.
    const normalized = value.replace(",", ".");
    const parsed =
      field === "weight" ? parseFloat(normalized) : parseInt(normalized, 10);
    const safe = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    const max = field === "weight" ? MAX_WEIGHT : MAX_REPS;
    const clamped = Math.min(safe, max);
    // Round weights to 2 decimals so float noise never reaches storage.
    const final =
      field === "weight" ? Math.round(clamped * 100) / 100 : clamped;

    setDraftText((prev) => ({
      ...prev,
      [set.id]: { ...prev[set.id], [field]: value },
    }));

    // Immutable update — mutating nested set objects in place kept stale
    // references alive across renders.
    setExercises((prev) =>
      prev.map((ex, ei) =>
        ei !== exerciseIndex
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, si) =>
                si !== setIndex ? s : { ...s, [field]: final },
              ),
            },
      ),
    );
  };

  // What a weight/reps cell displays: the text mid-edit if the user is
  // typing, otherwise the stored number.
  const cellValue = (set: WorkoutSet, field: "weight" | "reps"): string => {
    const draft = draftText[set.id]?.[field];
    if (draft !== undefined) return draft;
    const num = set[field];
    return num > 0 ? String(num) : "";
  };

  // On blur, drop the raw text so the cell snaps back to the canonical
  // stored number (e.g. a dangling "22." becomes "22").
  const clearCellDraft = (setId: string, field: "weight" | "reps") => {
    setDraftText((prev) => {
      if (prev[setId]?.[field] === undefined) return prev;
      const next = { ...prev, [setId]: { ...prev[setId] } };
      delete next[setId][field];
      return next;
    });
  };

  const toggleSetComplete = (exerciseIndex: number, setIndex: number) => {
    const updated = [...exercises];
    updated[exerciseIndex].sets[setIndex].completed =
      !updated[exerciseIndex].sets[setIndex].completed;
    setExercises(updated);

    if (updated[exerciseIndex].sets[setIndex].completed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      startRestTimer(exerciseIndex);
    }
  };

  const addSet = (exerciseIndex: number) => {
    const updated = [...exercises];
    const lastSet =
      updated[exerciseIndex].sets[updated[exerciseIndex].sets.length - 1];
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

  const startRestTimer = (exerciseIndex: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setRestingExerciseIndex(exerciseIndex);
    setRestTimer(restDuration);
    setIsResting(true);
    // Count down against a wall-clock deadline, not interval ticks.
    // Browsers throttle background-tab intervals to ~1/minute, so a
    // tick-based countdown froze whenever the user switched tabs. This
    // also keeps side effects out of the setState updater (which
    // double-fires under StrictMode).
    restEndsAtRef.current = Date.now() + restDuration * 1000;
    timerRef.current = setInterval(() => {
      const endsAt = restEndsAtRef.current;
      if (endsAt === null) return;
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRestTimer(remaining);
      if (remaining <= 0) {
        restEndsAtRef.current = null;
        setIsResting(false);
        setRestingExerciseIndex(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 1000);
  };

  const stopRestTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    restEndsAtRef.current = null;
    setIsResting(false);
    setRestingExerciseIndex(null);
    setRestTimer(0);
  };

  const finishWorkout = () => {
    if (!routine || isSaving) return;

    const hasCompletedSet = exercises.some((e) =>
      e.sets.some((s) => s.completed),
    );
    if (!hasCompletedSet) {
      showSystemMenu({
        title: "No completed sets",
        message:
          "You haven't checked off any sets. Finish and save this workout anyway?",
        options: [
          { label: "Finish Anyway", onPress: () => void doFinishWorkout() },
          { label: "Keep Training", cancel: true },
        ],
      });
      return;
    }
    void doFinishWorkout();
  };

  const doFinishWorkout = async () => {
    if (!routine || isSaving) return;
    // Guard against double-clicks: each click used to mint a fresh uuid
    // and save a duplicate workout while the first POST was in flight.
    setIsSaving(true);

    try {
      const endTime = new Date();
      const durationMinutes = Math.round(
        (endTime.getTime() - startTime.getTime()) / 60000,
      );

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
      const updatedRoutine = {
        ...routine,
        lastCompletedAt: endTime.toISOString(),
      };
      await storage.saveRoutine(updatedRoutine);

      await AsyncStorage.removeItem(WORKOUT_DRAFT_KEY).catch(() => {});

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace("WorkoutComplete", { workoutId: workout.id });
    } catch (error) {
      console.error("Failed to save workout:", error);
      setIsSaving(false);
      webSafeAlert(
        "Save failed",
        "Your workout could not be saved. Please try again — your sets are still here.",
      );
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loadFailed) {
    return (
      <ThemedView
        style={[
          styles.container,
          styles.centerContent,
          { paddingTop: headerHeight },
        ]}
      >
        <Feather name="alert-circle" size={40} color={theme.textSecondary} />
        <ThemedText type="h4" style={{ marginTop: Spacing.md }}>
          Workout not found
        </ThemedText>
        <ThemedText
          type="small"
          style={{
            color: theme.textSecondary,
            textAlign: "center",
            marginTop: Spacing.xs,
            marginBottom: Spacing.lg,
          }}
        >
          This routine may have been deleted or hasn&apos;t synced yet.
        </ThemedText>
        <Button onPress={() => navigation.goBack()}>Go Back</Button>
      </ThemedView>
    );
  }

  if (!routine) {
    return (
      <ThemedView
        style={[
          styles.container,
          styles.centerContent,
          { paddingTop: headerHeight },
        ]}
      >
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {showRestPicker ? (
        <View
          style={[
            styles.restPickerOverlay,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Rest Duration
          </ThemedText>
          <View style={styles.restPickerRow}>
            {[30, 60, 90, 120, 180].map((seconds) => (
              <Pressable
                key={seconds}
                onPress={() => saveRestDuration(seconds)}
                style={[
                  styles.restPickerOption,
                  {
                    backgroundColor:
                      restDuration === seconds
                        ? Colors.light.primary
                        : theme.backgroundSecondary,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{
                    color: restDuration === seconds ? "#FFFFFF" : theme.text,
                    fontWeight: "600",
                  }}
                >
                  {seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <AnimatedPress
            onPress={() => setShowRestPicker(false)}
            style={{ marginTop: Spacing.md }}
          >
            <ThemedText type="small" style={{ color: Colors.light.primary }}>
              Done
            </ThemedText>
          </AnimatedPress>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText type="h2" style={styles.routineName}>
          {routine.name}
        </ThemedText>

        {exercises.map((exercise, exerciseIndex) => (
          // Index in the key: a routine can legitimately list the same
          // exercise twice (EditRoutine allows it), and duplicate keys
          // make React recycle the wrong card.
          <Card
            key={`${exercise.exerciseId}-${exerciseIndex}`}
            style={styles.exerciseCard}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.sm,
              }}
            >
              <Pressable
                onPress={() => {
                  setSelectedExerciseName(exercise.exerciseName);
                  setShowExerciseInfo(true);
                }}
                hitSlop={8}
              >
                <Feather name="info" size={18} color={Colors.light.primary} />
              </Pressable>
              <Pressable
                onPress={() =>
                  navigation.navigate("ExerciseHistory", {
                    exerciseId: exercise.exerciseId,
                    exerciseName: exercise.exerciseName,
                  })
                }
                style={{ flex: 1 }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: Spacing.xs,
                  }}
                >
                  <ThemedText type="h4" style={styles.exerciseName}>
                    {exercise.exerciseName}
                  </ThemedText>
                  <Feather
                    name="chevron-right"
                    size={16}
                    color={theme.textSecondary}
                  />
                </View>
              </Pressable>
            </View>

            <View style={styles.setHeader}>
              <ThemedText
                type="small"
                style={[styles.headerCell, { flex: 0.5 }]}
              >
                Set
              </ThemedText>
              <ThemedText type="small" style={styles.headerCell}>
                Weight ({weightLabel(unitSystem)})
              </ThemedText>
              <ThemedText type="small" style={styles.headerCell}>
                Reps
              </ThemedText>
              <View style={{ width: 44 }} />
            </View>

            {exercise.sets.map((set, setIndex) => (
              <View key={set.id} style={styles.setRow}>
                <ThemedText
                  type="body"
                  style={[styles.setNumber, { flex: 0.5 }]}
                >
                  {setIndex + 1}
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      borderColor: theme.text,
                    },
                  ]}
                  // decimal-pad so 22.5 kg / 2.5 lb plates are enterable.
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  // maxLength caps the visible value ("9999.5") — without
                  // it, a tap-and-hold zero or paste of "999999" overflows
                  // the box and stores nonsense in the workout history.
                  maxLength={6}
                  value={cellValue(set, "weight")}
                  onChangeText={(v) =>
                    updateSet(exerciseIndex, setIndex, "weight", v)
                  }
                  onBlur={() => clearCellDraft(set.id, "weight")}
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                />
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      borderColor: theme.text,
                    },
                  ]}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={3}
                  value={cellValue(set, "reps")}
                  onChangeText={(v) =>
                    updateSet(exerciseIndex, setIndex, "reps", v)
                  }
                  onBlur={() => clearCellDraft(set.id, "reps")}
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

            <View style={styles.cardFooter}>
              <AnimatedPress
                onPress={() => addSet(exerciseIndex)}
                style={styles.addSetButton}
              >
                <Feather name="plus" size={18} color={Colors.light.primary} />
                <ThemedText
                  type="small"
                  style={{
                    color: Colors.light.primary,
                    marginLeft: Spacing.xs,
                  }}
                >
                  Add Set
                </ThemedText>
              </AnimatedPress>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: Spacing.sm,
                }}
              >
                {isResting && restingExerciseIndex === exerciseIndex ? (
                  <View
                    style={[
                      styles.restTimerInline,
                      { backgroundColor: Colors.light.primary },
                    ]}
                  >
                    <Feather name="clock" size={14} color="#FFFFFF" />
                    <ThemedText
                      type="body"
                      style={{
                        color: "#FFFFFF",
                        fontWeight: "700",
                        marginLeft: Spacing.xs,
                      }}
                    >
                      {formatTime(restTimer)}
                    </ThemedText>
                    <AnimatedPress
                      onPress={stopRestTimer}
                      style={styles.skipButtonInline}
                    >
                      <ThemedText
                        type="caption"
                        style={{ color: "#FFFFFF", fontWeight: "600" }}
                      >
                        Skip
                      </ThemedText>
                    </AnimatedPress>
                  </View>
                ) : null}
                <AnimatedPress
                  onPress={() => setShowRestPicker(!showRestPicker)}
                  style={styles.restSettingsButton}
                >
                  <Feather
                    name="clock"
                    size={18}
                    color={Colors.light.primary}
                  />
                  <ThemedText
                    type="small"
                    style={{ color: Colors.light.primary }}
                  >
                    {restDuration < 60
                      ? `${restDuration}s`
                      : `${restDuration / 60}m`}
                  </ThemedText>
                </AnimatedPress>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <Button
          onPress={finishWorkout}
          disabled={isSaving}
          style={styles.finishButton}
        >
          {isSaving ? "Saving..." : "Finish Workout"}
        </Button>
      </View>
      <ExerciseInfoModal
        visible={showExerciseInfo}
        exerciseName={selectedExerciseName}
        onClose={() => setShowExerciseInfo(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  restTimerInline: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  skipButtonInline: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: BorderRadius.xs,
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
    // Match the body setRow exactly (same gap, no extra horizontal
    // padding) so the Weight / Reps column labels actually sit above
    // the input boxes underneath them.
    gap: Spacing.sm,
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
    // minWidth: 0 overrides RN's default `minWidth: auto` which
    // refuses to shrink a flex item below its intrinsic content size.
    // Without this, the weight + reps cells stayed wide enough to
    // hold their content, pushing the check column off-screen on
    // narrower phones.
    minWidth: 0,
    height: 44,
    borderRadius: BorderRadius.xs,
    // Visible border so the weight/reps cells read as input fields
    // rather than blending into the card background — especially in
    // dark mode where the field bg sat almost the same shade as the
    // card. borderColor is applied per-instance via theme.text.
    borderWidth: 1.5,
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
    paddingVertical: Spacing.md,
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
  restPickerOverlay: {
    position: "absolute",
    top: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 20,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  restPickerRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  restPickerOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  restSettingsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
});
