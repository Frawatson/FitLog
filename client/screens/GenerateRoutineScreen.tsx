import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import * as storage from "@/lib/storage";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { WorkoutRoutine, Exercise } from "@/types";
import { v4 as uuidv4 } from "uuid";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MUSCLE_GROUPS = [
  { id: "abdominals", label: "Abs", icon: "target" },
  { id: "biceps", label: "Biceps", icon: "activity" },
  { id: "triceps", label: "Triceps", icon: "activity" },
  { id: "chest", label: "Chest", icon: "heart" },
  { id: "lats", label: "Back (Lats)", icon: "layers" },
  { id: "middle_back", label: "Middle Back", icon: "layers" },
  { id: "lower_back", label: "Lower Back", icon: "layers" },
  { id: "shoulders", label: "Shoulders", icon: "circle" },
  { id: "quadriceps", label: "Quads", icon: "zap" },
  { id: "hamstrings", label: "Hamstrings", icon: "zap" },
  { id: "glutes", label: "Glutes", icon: "zap" },
  { id: "calves", label: "Calves", icon: "zap" },
  { id: "forearms", label: "Forearms", icon: "activity" },
  { id: "traps", label: "Traps", icon: "layers" },
];

const DIFFICULTY_LEVELS = [
  { id: "beginner", label: "Beginner", description: "New to lifting" },
  { id: "intermediate", label: "Intermediate", description: "1-3 years experience" },
  { id: "expert", label: "Advanced", description: "3+ years experience" },
];

export default function GenerateRoutineScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("intermediate");
  const [routineName, setRoutineName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMuscle = (muscleId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMuscles((prev) =>
      prev.includes(muscleId)
        ? prev.filter((id) => id !== muscleId)
        : [...prev, muscleId]
    );
  };

  const selectDifficulty = (difficultyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDifficulty(difficultyId);
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
      const apiUrl = getApiUrl();
      const response = await fetch(new URL("/api/generate-routine", apiUrl).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          muscleGroups: selectedMuscles,
          difficulty: selectedDifficulty,
          name: routineName || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate routine");
      }

      const data = await response.json();
      
      const exercises: Exercise[] = data.exercises.map((ex: any) => ({
        id: ex.id || uuidv4(),
        name: ex.name,
        muscleGroup: ex.muscleGroup || ex.muscle,
        equipment: ex.equipment || "bodyweight",
        defaultSets: ex.sets || 3,
        defaultReps: ex.reps || 10,
        defaultRestSeconds: ex.restSeconds || 60,
      }));

      const newRoutine: WorkoutRoutine = {
        id: uuidv4(),
        name: routineName || data.name || "Generated Workout",
        exercises,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const routines = await storage.getRoutines();
      await storage.saveRoutines([...routines, newRoutine]);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("Main", { screen: "Routines" });
    } catch (err) {
      console.error("Error generating routine:", err);
      setError("Failed to generate routine. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Routine Name (Optional)
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="e.g., Upper Body Strength"
            placeholderTextColor={theme.textSecondary}
            value={routineName}
            onChangeText={setRoutineName}
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Target Muscle Groups
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
            Select the muscles you want to train
          </ThemedText>
          <View style={styles.muscleGrid}>
            {MUSCLE_GROUPS.map((muscle) => {
              const isSelected = selectedMuscles.includes(muscle.id);
              return (
                <Pressable
                  key={muscle.id}
                  style={[
                    styles.muscleChip,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => toggleMuscle(muscle.id)}
                >
                  <Feather
                    name={muscle.icon as any}
                    size={16}
                    color={isSelected ? "#FFFFFF" : theme.text}
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
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Difficulty Level
          </ThemedText>
          <View style={styles.difficultyContainer}>
            {DIFFICULTY_LEVELS.map((level) => {
              const isSelected = selectedDifficulty === level.id;
              return (
                <Pressable
                  key={level.id}
                  style={[
                    styles.difficultyCard,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => selectDifficulty(level.id)}
                >
                  <ThemedText
                    type="h4"
                    style={{
                      color: isSelected ? "#FFFFFF" : theme.text,
                    }}
                  >
                    {level.label}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{
                      color: isSelected ? "rgba(255,255,255,0.8)" : theme.textSecondary,
                    }}
                  >
                    {level.description}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={20} color={theme.error} />
            <ThemedText style={{ color: theme.error, marginLeft: Spacing.sm }}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.summarySection}>
          <Card style={styles.summaryCard}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
              Your Workout
            </ThemedText>
            <View style={styles.summaryRow}>
              <Feather name="target" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                {selectedMuscles.length > 0
                  ? selectedMuscles.map((id) => MUSCLE_GROUPS.find((m) => m.id === id)?.label).join(", ")
                  : "No muscles selected"}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <Feather name="bar-chart-2" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                {DIFFICULTY_LEVELS.find((d) => d.id === selectedDifficulty)?.label} level
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <Feather name="list" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                ~{selectedMuscles.length * 3} exercises will be generated
              </ThemedText>
            </View>
          </Card>
        </View>

        <Button
          onPress={generateRoutine}
          disabled={isGenerating || selectedMuscles.length === 0}
          style={styles.generateButton}
        >
          {isGenerating ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <ThemedText style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
                Generating...
              </ThemedText>
            </View>
          ) : (
            <>
              <Feather name="zap" size={20} color="#FFFFFF" />
              <ThemedText style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "700" }}>
                Generate Routine
              </ThemedText>
            </>
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
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1,
  },
  muscleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  muscleChip: {
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
  },
  summarySection: {
    marginBottom: Spacing.xl,
  },
  summaryCard: {
    padding: Spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
});
