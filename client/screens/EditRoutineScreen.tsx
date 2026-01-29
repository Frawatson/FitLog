import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Pressable, Alert } from "react-native";
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
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Routine, RoutineExercise, Exercise } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "EditRoutine">;

export default function EditRoutineScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { theme } = useTheme();
  
  const routineId = route.params?.routineId;
  const isNew = !routineId;
  
  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [showExerciseList, setShowExerciseList] = useState(false);
  
  useEffect(() => {
    loadData();
  }, []);
  
  useEffect(() => {
    navigation.setOptions({
      headerTitle: isNew ? "New Routine" : "Edit Routine",
      headerRight: () => (
        <HeaderButton onPress={handleSave}>
          <ThemedText type="link" style={{ fontWeight: "600" }}>Save</ThemedText>
        </HeaderButton>
      ),
    });
  }, [name, exercises]);
  
  const loadData = async () => {
    const exerciseData = await storage.getExercises();
    setAllExercises(exerciseData);
    
    if (routineId) {
      const routines = await storage.getRoutines();
      const existing = routines.find((r) => r.id === routineId);
      if (existing) {
        setName(existing.name);
        setExercises(existing.exercises);
      }
    }
  };
  
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a routine name");
      return;
    }
    
    const routine: Routine = {
      id: routineId || uuidv4(),
      name: name.trim(),
      exercises,
      createdAt: new Date().toISOString(),
    };
    
    await storage.saveRoutine(routine);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };
  
  const addExercise = (exercise: Exercise) => {
    const newExercise: RoutineExercise = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      order: exercises.length,
    };
    setExercises([...exercises, newExercise]);
    setShowExerciseList(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const removeExercise = (index: number) => {
    const updated = exercises.filter((_, i) => i !== index);
    setExercises(updated.map((e, i) => ({ ...e, order: i })));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const groupedExercises = allExercises.reduce((acc, ex) => {
    if (!acc[ex.muscleGroup]) {
      acc[ex.muscleGroup] = [];
    }
    acc[ex.muscleGroup].push(ex);
    return acc;
  }, {} as Record<string, Exercise[]>);
  
  if (showExerciseList) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.xl }]}>
        <View style={styles.header}>
          <ThemedText type="h2">Add Exercise</ThemedText>
          <Pressable onPress={() => setShowExerciseList(false)}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>
        
        <FlatList
          data={Object.entries(groupedExercises)}
          keyExtractor={([group]) => group}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
          renderItem={({ item: [group, exs] }) => (
            <View style={styles.groupSection}>
              <ThemedText type="h4" style={styles.groupTitle}>
                {group}
              </ThemedText>
              {exs.map((ex, idx) => (
                <Pressable
                  key={`${ex.id}-${idx}`}
                  onPress={() => addExercise(ex)}
                  style={({ pressed }) => [
                    styles.exerciseOption,
                    {
                      backgroundColor: theme.backgroundDefault,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <ThemedText type="body">{ex.name}</ThemedText>
                  <Feather name="plus" size={20} color={Colors.light.primary} />
                </Pressable>
              ))}
            </View>
          )}
        />
      </ThemedView>
    );
  }
  
  return (
    <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.xl }]}>
      <View style={styles.content}>
        <Input
          label="Routine Name"
          placeholder="e.g., Push Day"
          value={name}
          onChangeText={setName}
        />
        
        <ThemedText type="h4" style={styles.sectionTitle}>
          Exercises
        </ThemedText>
        
        {exercises.length > 0 ? (
          <View style={styles.exerciseList}>
            {exercises.map((exercise, index) => (
              <View
                key={`${exercise.exerciseId}-${index}`}
                style={[styles.exerciseItem, { backgroundColor: theme.backgroundDefault }]}
              >
                <View style={styles.exerciseInfo}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {index + 1}. {exercise.exerciseName}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => removeExercise(index)}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={18} color={Colors.light.error} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        
        <Button
          onPress={() => setShowExerciseList(true)}
          style={[styles.addButton, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={styles.addButtonContent}>
            <Feather name="plus" size={20} color={Colors.light.primary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: Colors.light.primary }}>
              Add Exercise
            </ThemedText>
          </View>
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  exerciseList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  exerciseItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  exerciseInfo: {
    flex: 1,
  },
  addButton: {
    borderWidth: 2,
    borderColor: Colors.light.primary,
    borderStyle: "dashed",
  },
  addButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  groupSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  groupTitle: {
    marginBottom: Spacing.md,
    opacity: 0.6,
  },
  exerciseOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
});
