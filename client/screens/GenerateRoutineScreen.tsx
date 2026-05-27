import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AnimatedPress } from "@/components/AnimatedPress";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import * as storage from "@/lib/storage";
import { AUTH_TOKEN_KEY } from "@/lib/authStorage";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { Routine, RoutineExercise } from "@/types";
import { v4 as uuidv4 } from "uuid";

// Preview shape captured from server response and rendered before save.
// We hold the server's default name + the partialMuscles warning so the
// preview view can show both and the user can still rename / regenerate.
type PreviewRoutine = {
  defaultName: string;
  exercises: RoutineExercise[];
  partialMuscles: string[];
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MUSCLE_GROUPS = [
  { id: "chest", label: "Chest", icon: "heart" },
  { id: "shoulders", label: "Shoulders", icon: "circle" },
  { id: "biceps", label: "Biceps", icon: "disc" },
  { id: "triceps", label: "Triceps", icon: "disc" },
  { id: "forearms", label: "Forearms", icon: "disc" },
  { id: "lats", label: "Back (Lats)", icon: "layers" },
  { id: "middle_back", label: "Middle Back", icon: "layers" },
  { id: "lower_back", label: "Lower Back", icon: "layers" },
  { id: "traps", label: "Traps", icon: "layers" },
  { id: "abdominals", label: "Abs", icon: "target" },
  { id: "quadriceps", label: "Quads", icon: "zap" },
  { id: "hamstrings", label: "Hamstrings", icon: "zap" },
  { id: "glutes", label: "Glutes", icon: "zap" },
  { id: "calves", label: "Calves", icon: "zap" },
];

const DIFFICULTY_LEVELS = [
  { id: "beginner", label: "Beginner", description: "New to lifting" },
  { id: "intermediate", label: "Intermediate", description: "1-3 years" },
  { id: "expert", label: "Advanced", description: "3+ years" },
];

const EQUIPMENT_OPTIONS = [
  { id: "barbell", label: "Barbell" },
  { id: "dumbbells", label: "Dumbbells" },
  { id: "cables", label: "Cables" },
  { id: "machines", label: "Machines" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "bodyweight", label: "Bodyweight" },
  { id: "resistance_bands", label: "Bands" },
  { id: "pull_up_bar", label: "Pull-up Bar" },
];

const GOAL_OPTIONS = [
  { id: "build_muscle", label: "Build Muscle", icon: "trending-up" },
  { id: "build_strength", label: "Build Strength", icon: "award" },
  { id: "lose_fat", label: "Lose Fat", icon: "activity" },
  { id: "endurance", label: "Endurance", icon: "repeat" },
  { id: "general_fitness", label: "General Fitness", icon: "heart" },
];

function CollapsibleSection({
  title,
  subtitle,
  isExpanded,
  onToggle,
  children,
  badge,
  theme,
}: {
  title: string;
  subtitle?: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string;
  theme: any;
}) {
  return (
    <View style={[sectionStyles.wrapper, { borderColor: theme.border }]}>
      <AnimatedPress
        onPress={onToggle}
        style={sectionStyles.header}
        testID={`section-toggle-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <View style={sectionStyles.headerLeft}>
          <ThemedText type="h4">{title}</ThemedText>
          {badge ? (
            <View style={[sectionStyles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText type="caption" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                {badge}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <Feather
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.textSecondary}
        />
      </AnimatedPress>
      {subtitle && !isExpanded ? (
        <ThemedText type="caption" style={{ color: theme.textSecondary, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md }}>
          {subtitle}
        </ThemedText>
      ) : null}
      {isExpanded ? (
        <View style={sectionStyles.content}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrapper: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
});

export default function GenerateRoutineScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();

  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("intermediate");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string>("build_muscle");
  const [routineName, setRoutineName] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewRoutine | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    muscles: true,
    goal: false,
    equipment: false,
    difficulty: false,
    extras: false,
  });

  const toggleSection = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleMuscle = (muscleId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMuscles((prev) =>
      prev.includes(muscleId)
        ? prev.filter((id) => id !== muscleId)
        : [...prev, muscleId]
    );
  };

  const toggleEquipment = (equipId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedEquipment((prev) =>
      prev.includes(equipId)
        ? prev.filter((id) => id !== equipId)
        : [...prev, equipId]
    );
  };

  const selectDifficulty = (difficultyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDifficulty(difficultyId);
  };

  const selectGoal = (goalId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGoal(goalId);
  };

  const fetchGeneratedRoutine = async (): Promise<PreviewRoutine> => {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    const apiUrl = getApiUrl();
    const response = await fetch(new URL("/api/generate-routine", apiUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        muscleGroups: selectedMuscles,
        difficulty: selectedDifficulty,
        name: routineName || undefined,
        equipment: selectedEquipment.length > 0 ? selectedEquipment : undefined,
        goal: selectedGoal,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error || "Failed to generate routine");
    }

    const data = await response.json();
    const rawExercises = Array.isArray(data.exercises) ? data.exercises : [];
    const exercises: RoutineExercise[] = rawExercises.map((ex: any, index: number) => ({
      exerciseId: uuidv4(),
      exerciseName: ex.name,
      order: index,
    }));

    return {
      defaultName: typeof data.name === "string" && data.name ? data.name : "Generated Workout",
      exercises,
      partialMuscles: Array.isArray(data.partialMuscles) ? data.partialMuscles : [],
    };
  };

  const generateRoutine = async () => {
    if (selectedMuscles.length === 0) {
      setError("Please select at least one muscle group");
      return;
    }

    setError(null);
    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await fetchGeneratedRoutine();
      setPreview(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.error("Error generating routine:", err);
      setError(err.message || "Failed to generate routine. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateRoutine = async () => {
    if (isGenerating || isSaving) return;
    setError(null);
    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await fetchGeneratedRoutine();
      setPreview(result);
    } catch (err: any) {
      console.error("Error regenerating routine:", err);
      setError(err.message || "Failed to regenerate. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGenerating(false);
    }
  };

  const savePreviewedRoutine = async () => {
    if (!preview || isSaving) return;
    setIsSaving(true);
    try {
      const newRoutine: Routine = {
        id: uuidv4(),
        name: routineName.trim() || preview.defaultName,
        exercises: preview.exercises,
        createdAt: new Date().toISOString(),
      };
      await storage.saveRoutine(newRoutine);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("Main", { screen: "RoutinesTab" });
    } catch (err: any) {
      console.error("Error saving routine:", err);
      setError(err.message || "Failed to save routine.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIsSaving(false);
    }
  };

  const backToForm = () => {
    setPreview(null);
    setError(null);
  };

  const musclesBadge = selectedMuscles.length > 0 ? `${selectedMuscles.length}` : undefined;
  const equipBadge = selectedEquipment.length > 0 ? `${selectedEquipment.length}` : undefined;
  const goalLabel = GOAL_OPTIONS.find((g) => g.id === selectedGoal)?.label;
  const diffLabel = DIFFICULTY_LEVELS.find((d) => d.id === selectedDifficulty)?.label;

  if (preview) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing["3xl"],
            paddingHorizontal: Spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="h2" style={{ marginBottom: Spacing.xs }}>Your workout</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
            Review the exercises below. Rename, regenerate, or save.
          </ThemedText>

          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
            Routine name
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
                marginBottom: Spacing.lg,
              },
            ]}
            placeholder={preview.defaultName}
            placeholderTextColor={theme.textSecondary}
            value={routineName}
            onChangeText={setRoutineName}
            maxLength={100}
          />

          {preview.partialMuscles.length > 0 ? (
            <View style={[styles.errorContainer, { backgroundColor: "#FFB30022", marginBottom: Spacing.lg }]}>
              <Feather name="alert-triangle" size={18} color="#FFB300" />
              <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm, flex: 1 }}>
                No exercises matched for: {preview.partialMuscles.map((m) => m.replace("_", " ")).join(", ")}.
                Try regenerating or relaxing equipment filters.
              </ThemedText>
            </View>
          ) : null}

          <View style={[styles.previewCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              {preview.exercises.length} exercise{preview.exercises.length === 1 ? "" : "s"}
            </ThemedText>
            {preview.exercises.map((ex, index) => (
              <View key={ex.exerciseId} style={styles.previewRow}>
                <View style={[styles.previewNumber, { backgroundColor: theme.primary }]}>
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    {index + 1}
                  </ThemedText>
                </View>
                <ThemedText type="body" style={{ flex: 1 }}>{ex.exerciseName}</ThemedText>
              </View>
            ))}
          </View>

          {error ? (
            <View style={[styles.errorContainer, { backgroundColor: `${theme.error}15`, marginTop: Spacing.lg }]}>
              <Feather name="alert-circle" size={18} color={theme.error} />
              <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.sm, flex: 1 }}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          <Button
            onPress={savePreviewedRoutine}
            disabled={isSaving || isGenerating || preview.exercises.length === 0}
            style={styles.generateButton}
          >
            {isSaving ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <ThemedText style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>Saving...</ThemedText>
              </View>
            ) : (
              <View style={styles.loadingContainer}>
                <Feather name="check" size={20} color="#FFFFFF" />
                <ThemedText style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "700" }}>
                  Save Routine
                </ThemedText>
              </View>
            )}
          </Button>

          <AnimatedPress
            onPress={regenerateRoutine}
            disabled={isGenerating || isSaving}
            style={[
              styles.secondaryButton,
              { borderColor: theme.border, opacity: isGenerating || isSaving ? 0.5 : 1 },
            ]}
          >
            {isGenerating ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={theme.text} size="small" />
                <ThemedText style={{ marginLeft: Spacing.sm }}>Regenerating...</ThemedText>
              </View>
            ) : (
              <View style={styles.loadingContainer}>
                <Feather name="refresh-cw" size={18} color={theme.text} />
                <ThemedText style={{ marginLeft: Spacing.sm, fontWeight: "600" }}>
                  Regenerate
                </ThemedText>
              </View>
            )}
          </AnimatedPress>

          <AnimatedPress
            onPress={backToForm}
            disabled={isSaving || isGenerating}
            style={[styles.textButton, { opacity: isSaving || isGenerating ? 0.5 : 1 }]}
          >
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Back to settings
            </ThemedText>
          </AnimatedPress>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["3xl"],
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <CollapsibleSection
          title="Muscle Groups"
          subtitle={selectedMuscles.length > 0
            ? selectedMuscles.map((id) => MUSCLE_GROUPS.find((m) => m.id === id)?.label).join(", ")
            : "Tap to select muscles"}
          isExpanded={expandedSections.muscles}
          onToggle={() => toggleSection("muscles")}
          badge={musclesBadge}
          theme={theme}
        >
          <View style={styles.chipGrid}>
            {MUSCLE_GROUPS.map((muscle) => {
              const isSelected = selectedMuscles.includes(muscle.id);
              return (
                <AnimatedPress
                  key={muscle.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => toggleMuscle(muscle.id)}
                  testID={`chip-muscle-${muscle.id}`}
                >
                  <Feather
                    name={muscle.icon as any}
                    size={14}
                    color={isSelected ? "#FFFFFF" : theme.textSecondary}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: isSelected ? "#FFFFFF" : theme.text,
                      fontWeight: isSelected ? "600" : "400",
                    }}
                  >
                    {muscle.label}
                  </ThemedText>
                </AnimatedPress>
              );
            })}
          </View>
        </CollapsibleSection>

        <CollapsibleSection
          title="Training Goal"
          subtitle={goalLabel}
          isExpanded={expandedSections.goal}
          onToggle={() => toggleSection("goal")}
          theme={theme}
        >
          <View style={styles.chipGrid}>
            {GOAL_OPTIONS.map((goal) => {
              const isSelected = selectedGoal === goal.id;
              return (
                <AnimatedPress
                  key={goal.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => selectGoal(goal.id)}
                  testID={`chip-goal-${goal.id}`}
                >
                  <Feather
                    name={goal.icon as any}
                    size={14}
                    color={isSelected ? "#FFFFFF" : theme.textSecondary}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: isSelected ? "#FFFFFF" : theme.text,
                      fontWeight: isSelected ? "600" : "400",
                    }}
                  >
                    {goal.label}
                  </ThemedText>
                </AnimatedPress>
              );
            })}
          </View>
        </CollapsibleSection>

        <CollapsibleSection
          title="Equipment"
          subtitle={selectedEquipment.length > 0
            ? selectedEquipment.map((id) => EQUIPMENT_OPTIONS.find((e) => e.id === id)?.label).join(", ")
            : "Full gym (default)"}
          isExpanded={expandedSections.equipment}
          onToggle={() => toggleSection("equipment")}
          badge={equipBadge}
          theme={theme}
        >
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
            Leave empty to assume full gym access
          </ThemedText>
          <View style={styles.chipGrid}>
            {EQUIPMENT_OPTIONS.map((equip) => {
              const isSelected = selectedEquipment.includes(equip.id);
              return (
                <AnimatedPress
                  key={equip.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => toggleEquipment(equip.id)}
                  testID={`chip-equip-${equip.id}`}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: isSelected ? "#FFFFFF" : theme.text,
                      fontWeight: isSelected ? "600" : "400",
                    }}
                  >
                    {equip.label}
                  </ThemedText>
                </AnimatedPress>
              );
            })}
          </View>
        </CollapsibleSection>

        <CollapsibleSection
          title="Difficulty"
          subtitle={diffLabel}
          isExpanded={expandedSections.difficulty}
          onToggle={() => toggleSection("difficulty")}
          theme={theme}
        >
          <View style={styles.difficultyContainer}>
            {DIFFICULTY_LEVELS.map((level) => {
              const isSelected = selectedDifficulty === level.id;
              return (
                <AnimatedPress
                  key={level.id}
                  style={[
                    styles.difficultyCard,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => selectDifficulty(level.id)}
                  testID={`chip-difficulty-${level.id}`}
                >
                  <ThemedText
                    type="h4"
                    style={{ color: isSelected ? "#FFFFFF" : theme.text }}
                  >
                    {level.label}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{ color: isSelected ? "rgba(255,255,255,0.8)" : theme.textSecondary }}
                  >
                    {level.description}
                  </ThemedText>
                </AnimatedPress>
              );
            })}
          </View>
        </CollapsibleSection>

        <CollapsibleSection
          title="Routine Name"
          subtitle={routineName ? routineName.substring(0, 40) : "Optional"}
          isExpanded={expandedSections.extras}
          onToggle={() => toggleSection("extras")}
          theme={theme}
        >
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
            Routine Name
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="e.g., Upper Body Strength"
            placeholderTextColor={theme.textSecondary}
            value={routineName}
            onChangeText={setRoutineName}
            maxLength={100}
            testID="input-routine-name"
          />
        </CollapsibleSection>

        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: `${theme.error}15` }]}>
            <Feather name="alert-circle" size={18} color={theme.error} />
            <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.sm, flex: 1 }}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <Button
          onPress={generateRoutine}
          disabled={isGenerating || selectedMuscles.length === 0}
          style={styles.generateButton}
          testID="button-generate"
        >
          {isGenerating ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <ThemedText style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
                Building your workout...
              </ThemedText>
            </View>
          ) : (
            <View style={styles.loadingContainer}>
              <Feather name="zap" size={20} color="#FFFFFF" />
              <ThemedText style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "700" }}>
                Generate Routine
              </ThemedText>
            </View>
          )}
        </Button>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  difficultyContainer: {
    gap: Spacing.sm,
  },
  difficultyCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  previewNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  textButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
});
