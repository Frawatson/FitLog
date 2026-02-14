import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Pressable, Modal } from "react-native";
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
import { AnimatedPress } from "@/components/AnimatedPress";
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
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const handleCancel = () => {
    if (name || exercises.length > 0) {
      setShowDiscardModal(true);
    } else {
      navigation.goBack();
    }
  };

  useEffect(() => {
    if (showExerciseList) {
      navigation.setOptions({
        headerTitle: "Add Exercise",
        headerLeft: () => (
          <HeaderButton onPress={() => setShowExerciseList(false)}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </HeaderButton>
        ),
        headerRight: () => null,
      });
    } else {
      navigation.setOptions({
        headerTitle: isNew ? "New Routine" : "Edit Routine",
        headerLeft: () => (
          <HeaderButton onPress={handleCancel}>
            <Feather name="x" size={24} color={theme.text} />
          </HeaderButton>
        ),
        headerRight: () => (
          <HeaderButton onPress={handleSave}>
            <ThemedText type="link" style={{ fontWeight: "600" }}>Save</ThemedText>
          </HeaderButton>
        ),
      });
    }
  }, [name, exercises, theme, showExerciseList]);
  
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
                <AnimatedPress
                  key={`${ex.id}-${idx}`}
                  onPress={() => addExercise(ex)}
                  style={[
                    styles.exerciseOption,
                    {
                      backgroundColor: theme.backgroundDefault,
                    },
                  ]}
                >
                  <ThemedText type="body">{ex.name}</ThemedText>
                  <Feather name="plus" size={20} color={Colors.light.primary} />
                </AnimatedPress>
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
      
      <Modal
        visible={showDiscardModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDiscardModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowDiscardModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Discard Changes?</ThemedText>
            <ThemedText type="body" style={{ opacity: 0.7, marginBottom: Spacing.xl }}>
              You have unsaved changes. Are you sure you want to leave?
            </ThemedText>
            <View style={styles.modalButtons}>
              <AnimatedPress
                onPress={() => setShowDiscardModal(false)}
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText type="body" style={{ fontWeight: "600" }}>Stay</ThemedText>
              </AnimatedPress>
              <AnimatedPress
                onPress={() => {
                  setShowDiscardModal(false);
                  navigation.goBack();
                }}
                style={[styles.modalButton, { backgroundColor: Colors.light.error }]}
              >
                <ThemedText type="body" style={{ fontWeight: "600", color: "#FFFFFF" }}>Discard</ThemedText>
              </AnimatedPress>
            </View>
          </View>
        </Pressable>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
