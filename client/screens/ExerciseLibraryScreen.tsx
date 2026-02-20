import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  SectionList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ExerciseInfoModal } from "@/components/ExerciseInfoModal";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { syncToServer } from "@/lib/syncService";
import * as storage from "@/lib/storage";
import type { Routine } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface LibraryExercise {
  name: string;
  bodyPart: string | null;
  equipment: string | null;
  targetMuscle: string | null;
  hasGif: boolean;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ExerciseLibraryScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();

  const [exercises, setExercises] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedExercise, setSelectedExercise] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [addedExercises, setAddedExercises] = useState<Set<string>>(new Set());

  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [pendingExercise, setPendingExercise] = useState<{ id: string; name: string; muscleGroup: string } | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    const result = await syncToServer<LibraryExercise[]>(
      "/api/exercises/library",
      "GET"
    );
    if (result.success && result.data) {
      setExercises(result.data);
    }
    setLoading(false);
  };

  const handleAdd = async (item: LibraryExercise) => {
    const muscleGroup = capitalize(item.bodyPart || "Other");
    const exercise = await storage.addExercise(item.name, muscleGroup);
    setAddedExercises((prev) => new Set(prev).add(item.name));

    setPendingExercise({ id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup });
    const data = await storage.getRoutines();
    setRoutines(data);
    setShowRoutineModal(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleNewRoutine = () => {
    if (!pendingExercise) return;
    setShowRoutineModal(false);
    navigation.navigate("EditRoutine", {
      prefillExercise: pendingExercise,
    });
    setPendingExercise(null);
  };

  const handleAddToRoutine = async (routine: Routine) => {
    if (!pendingExercise) return;

    const alreadyExists = routine.exercises.some(
      (e) => e.exerciseName === pendingExercise.name
    );

    if (alreadyExists) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowRoutineModal(false);
      setPendingExercise(null);
      return;
    }

    const updatedRoutine: Routine = {
      ...routine,
      exercises: [
        ...routine.exercises,
        {
          exerciseId: pendingExercise.id,
          exerciseName: pendingExercise.name,
          order: routine.exercises.length,
        },
      ],
    };

    await storage.saveRoutine(updatedRoutine);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setShowRoutineModal(false);
    setPendingExercise(null);
  };

  const dismissModal = () => {
    setShowRoutineModal(false);
    setPendingExercise(null);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return exercises;
    const q = search.toLowerCase();
    return exercises.filter(
      (ex) =>
        ex.name.toLowerCase().includes(q) ||
        ex.bodyPart?.toLowerCase().includes(q) ||
        ex.equipment?.toLowerCase().includes(q)
    );
  }, [exercises, search]);

  const sections = useMemo(() => {
    const grouped: Record<string, LibraryExercise[]> = {};
    for (const ex of filtered) {
      const letter = ex.name[0].toUpperCase();
      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(ex);
    }
    return Object.keys(grouped)
      .sort()
      .map((letter) => ({ title: letter, data: grouped[letter] }));
  }, [filtered]);

  const gifCount = exercises.filter((e) => e.hasGif).length;

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: headerHeight + Spacing.xl,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.name}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View
              style={[
                styles.searchBar,
                { backgroundColor: theme.backgroundCard, borderColor: theme.border },
              ]}
            >
              <Feather name="search" size={18} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.textPrimary }]}
                placeholder="Search exercises..."
                placeholderTextColor={theme.textSecondary}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")}>
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
            <ThemedText type="small" style={{ opacity: 0.6, marginTop: Spacing.sm }}>
              {filtered.length} exercises — {gifCount} with GIF demos
            </ThemedText>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <ThemedText
            type="h4"
            style={[styles.sectionHeader, { color: Colors.light.primary }]}
          >
            {title}
          </ThemedText>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setSelectedExercise(item.name);
              setShowInfo(true);
            }}
            style={[
              styles.exerciseRow,
              { backgroundColor: theme.backgroundCard },
            ]}
          >
            <View
              style={[
                styles.gifIndicator,
                {
                  backgroundColor: item.hasGif
                    ? Colors.light.primary + "20"
                    : Colors.light.error + "20",
                },
              ]}
            >
              <Feather
                name={item.hasGif ? "check" : "x"}
                size={14}
                color={item.hasGif ? Colors.light.primary : Colors.light.error}
              />
            </View>
            <View style={styles.exerciseInfo}>
              <ThemedText type="body" style={{ fontWeight: "500" }}>
                {item.name}
              </ThemedText>
              {(item.bodyPart || item.equipment) && (
                <ThemedText
                  type="caption"
                  style={{ opacity: 0.6, marginTop: 2, textTransform: "capitalize" }}
                >
                  {[item.bodyPart, item.equipment].filter(Boolean).join(" · ")}
                </ThemedText>
              )}
            </View>
            {addedExercises.has(item.name) ? (
              <View style={styles.addedBadge}>
                <Feather name="check" size={16} color={Colors.light.success} />
              </View>
            ) : (
              <Pressable
                onPress={() => handleAdd(item)}
                hitSlop={8}
                style={styles.addButton}
              >
                <Feather name="plus-circle" size={22} color={Colors.light.primary} />
              </Pressable>
            )}
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="search" size={48} color={theme.textSecondary} style={{ opacity: 0.3 }} />
            <ThemedText type="body" style={{ opacity: 0.5, marginTop: Spacing.md }}>
              No exercises found
            </ThemedText>
          </View>
        }
      />
      <ExerciseInfoModal
        visible={showInfo}
        exerciseName={selectedExercise}
        onClose={() => setShowInfo(false)}
      />

      <Modal
        visible={showRoutineModal}
        transparent
        animationType="fade"
        onRequestClose={dismissModal}
      >
        <Pressable style={styles.modalOverlay} onPress={dismissModal}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.backgroundCard }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText type="h3" style={{ marginBottom: Spacing.xs }}>
              Add to Routine
            </ThemedText>
            <ThemedText type="small" style={{ opacity: 0.6, marginBottom: Spacing.lg }}>
              {pendingExercise?.name}
            </ThemedText>

            <Pressable
              onPress={handleNewRoutine}
              style={[styles.routineOption, { backgroundColor: Colors.light.primary + "10" }]}
            >
              <View style={[styles.routineOptionIcon, { backgroundColor: Colors.light.primary }]}>
                <Feather name="plus" size={16} color="#FFFFFF" />
              </View>
              <ThemedText type="body" style={{ fontWeight: "600", color: Colors.light.primary }}>
                New Routine
              </ThemedText>
            </Pressable>

            {routines.length > 0 && (
              <>
                <ThemedText type="small" style={{ opacity: 0.5, marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
                  Existing Routines
                </ThemedText>
                <ScrollView style={{ maxHeight: 240 }}>
                  {routines.map((routine) => (
                    <Pressable
                      key={routine.id}
                      onPress={() => handleAddToRoutine(routine)}
                      style={[styles.routineOption, { backgroundColor: theme.backgroundElevated }]}
                    >
                      <View style={[styles.routineOptionIcon, { backgroundColor: theme.backgroundSecondary }]}>
                        <Feather name="list" size={16} color={theme.textSecondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="body" style={{ fontWeight: "500" }}>
                          {routine.name}
                        </ThemedText>
                        <ThemedText type="caption" style={{ opacity: 0.6 }}>
                          {routine.exercises.length} exercise{routine.exercises.length !== 1 ? "s" : ""}
                        </ThemedText>
                      </View>
                      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  sectionHeader: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.xs,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    gap: Spacing.md,
  },
  gifIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseInfo: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  addButton: {
    padding: Spacing.xs,
  },
  addedBadge: {
    padding: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  routineOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  routineOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
