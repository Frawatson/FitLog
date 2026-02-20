import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { AnimatedPress } from "@/components/AnimatedPress";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Routine } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RoutinesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [routineToDelete, setRoutineToDelete] = useState<Routine | null>(null);
  const [expandedRoutines, setExpandedRoutines] = useState<Set<string>>(new Set());
  
  const loadRoutines = async () => {
    const data = await storage.getRoutines();
    setRoutines(data);
    setLoading(false);
  };
  
  useFocusEffect(
    useCallback(() => {
      loadRoutines();
    }, [])
  );
  
  const handleDelete = (routine: Routine) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRoutineToDelete(routine);
    setDeleteModalVisible(true);
  };
  
  const confirmDelete = async () => {
    if (routineToDelete) {
      await storage.deleteRoutine(routineToDelete.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDeleteModalVisible(false);
      setRoutineToDelete(null);
      loadRoutines();
    }
  };
  
  const cancelDelete = () => {
    setDeleteModalVisible(false);
    setRoutineToDelete(null);
  };
  
  const handleStartWorkout = (routine: Routine) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ActiveWorkout", { routineId: routine.id });
  };

  const toggleExpand = (routineId: string) => {
    setExpandedRoutines((prev) => {
      const next = new Set(prev);
      next.has(routineId) ? next.delete(routineId) : next.add(routineId);
      return next;
    });
    Haptics.selectionAsync();
  };

  const renderRoutine = ({ item }: { item: Routine }) => {
    const exercisePreview = item.exercises.map(e => e.exerciseName);
    const isExpanded = expandedRoutines.has(item.id);

    return (
      <Card style={styles.routineCard}>
        <Pressable onPress={() => toggleExpand(item.id)}>
          <View style={styles.routineHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText type="h3">{item.name}</ThemedText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.xs }}>
                <ThemedText type="small" style={{ opacity: 0.6 }}>
                  {item.exercises.length} exercise{item.exercises.length !== 1 ? "s" : ""}
                  {item.lastCompletedAt
                    ? `  \u00B7  ${new Date(item.lastCompletedAt).toLocaleDateString()}`
                    : ""}
                </ThemedText>
                <Feather
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={theme.textSecondary}
                />
              </View>
            </View>
            <AnimatedPress
              onPress={() => handleStartWorkout(item)}
              style={styles.playButton}
            >
              <Feather name="play" size={18} color="#FFFFFF" />
            </AnimatedPress>
          </View>
        </Pressable>

        {isExpanded && exercisePreview.length > 0 && (
          <View style={styles.exercisePreview}>
            {exercisePreview.map((name, i) => (
              <View key={i} style={styles.exercisePreviewItem}>
                <View style={[styles.exerciseDot, { backgroundColor: Colors.light.primary }]} />
                <ThemedText type="small" numberOfLines={1}>
                  {name}
                </ThemedText>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.secondaryActions, { borderTopColor: theme.border }]}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              navigation.navigate("EditRoutine", { routineId: item.id });
            }}
            style={[styles.secondaryButton, { backgroundColor: theme.backgroundElevated }]}
          >
            <Feather name="edit-2" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
              Edit
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => handleDelete(item)}
            style={[styles.secondaryButton, { backgroundColor: Colors.light.error + "10" }]}
          >
            <Feather name="trash-2" size={16} color={Colors.light.error} />
            <ThemedText type="small" style={{ color: Colors.light.error, marginLeft: Spacing.sm }}>
              Delete
            </ThemedText>
          </Pressable>
        </View>
      </Card>
    );
  };
  
  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: headerHeight + Spacing.xl,
            paddingHorizontal: Spacing.lg,
          },
        ]}
      >
        <View style={{ gap: Spacing.md }}>
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
        </View>
      </View>
    );
  }

  if (routines.length === 0 && !loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: headerHeight,
            paddingBottom: tabBarHeight,
          },
        ]}
      >
        <EmptyState
          image={require("../../assets/images/empty-routines.png")}
          title="No routines yet"
          message="Create your first workout routine or browse templates"
          actionLabel="Browse Templates"
          onAction={() => navigation.navigate("RoutineTemplates")}
        />
        <View style={styles.emptyStatePills}>
          <AnimatedPress
            onPress={() => navigation.navigate("GenerateRoutine")}
            style={[styles.pillButton, { backgroundColor: "#9333EA" + "15" }]}
          >
            <View style={[styles.pillIcon, { backgroundColor: "#9333EA" }]}>
              <Feather name="zap" size={14} color="#FFFFFF" />
            </View>
            <ThemedText type="small" style={{ fontWeight: "600", color: "#9333EA" }}>
              Generate Routine
            </ThemedText>
          </AnimatedPress>
          <AnimatedPress
            onPress={() => navigation.navigate("ExerciseLibrary")}
            style={[styles.pillButton, { backgroundColor: "#0D9488" + "15" }]}
          >
            <View style={[styles.pillIcon, { backgroundColor: "#0D9488" }]}>
              <Feather name="book-open" size={14} color="#FFFFFF" />
            </View>
            <ThemedText type="small" style={{ fontWeight: "600", color: "#0D9488" }}>
              Exercise Library
            </ThemedText>
          </AnimatedPress>
        </View>
      </View>
    );
  }
  
  const renderDeleteModal = () => {
    if (!deleteModalVisible) return null;
    
    return (
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={styles.modalOverlay} onPress={cancelDelete}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundCard }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIconContainer}>
              <Feather name="trash-2" size={32} color={Colors.light.error} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>Delete Routine</ThemedText>
            <ThemedText type="body" style={styles.modalMessage}>
              Are you sure you want to delete "{routineToDelete?.name}"? This action cannot be undone.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelDelete}
              >
                <ThemedText type="body" style={{ fontWeight: "600", color: "#1F2937" }}>Cancel</ThemedText>
              </Pressable>
              <AnimatedPress
                style={[styles.modalButton, styles.deleteButton]}
                onPress={confirmDelete}
              >
                <ThemedText type="body" style={{ fontWeight: "600", color: "#FFFFFF" }}>Delete</ThemedText>
              </AnimatedPress>
            </View>
          </Pressable>
        </Pressable>
      </View>
    );
  };

  return (
    <>
      <FlatList
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ListHeaderComponent={
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
            style={{ marginBottom: Spacing.lg }}
          >
            <AnimatedPress
              onPress={() => navigation.navigate("RoutineTemplates")}
              style={[styles.pillButton, { backgroundColor: Colors.light.primary + "15" }]}
            >
              <View style={[styles.pillIcon, { backgroundColor: Colors.light.primary }]}>
                <Feather name="grid" size={14} color="#FFFFFF" />
              </View>
              <ThemedText type="small" style={{ fontWeight: "600", color: Colors.light.primary }}>
                Templates
              </ThemedText>
            </AnimatedPress>

            <AnimatedPress
              onPress={() => navigation.navigate("GenerateRoutine")}
              style={[styles.pillButton, { backgroundColor: "#9333EA" + "15" }]}
            >
              <View style={[styles.pillIcon, { backgroundColor: "#9333EA" }]}>
                <Feather name="zap" size={14} color="#FFFFFF" />
              </View>
              <ThemedText type="small" style={{ fontWeight: "600", color: "#9333EA" }}>
                Generate
              </ThemedText>
            </AnimatedPress>

            <AnimatedPress
              onPress={() => navigation.navigate("ExerciseLibrary")}
              style={[styles.pillButton, { backgroundColor: "#0D9488" + "15" }]}
            >
              <View style={[styles.pillIcon, { backgroundColor: "#0D9488" }]}>
                <Feather name="book-open" size={14} color="#FFFFFF" />
              </View>
              <ThemedText type="small" style={{ fontWeight: "600", color: "#0D9488" }}>
                Exercises
              </ThemedText>
            </AnimatedPress>
          </ScrollView>
        }
        data={routines}
        keyExtractor={(item) => item.id}
        renderItem={renderRoutine}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      />
      {renderDeleteModal()}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pillRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  pillIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  routineCard: {
    padding: Spacing.lg,
  },
  routineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  routineInfo: {
    opacity: 0.6,
    marginTop: Spacing.xs,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  exercisePreview: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  exercisePreviewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  exerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  secondaryActions: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  emptyStatePills: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    zIndex: 1000,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  modalMessage: {
    textAlign: "center",
    opacity: 0.7,
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F3F4F6",
  },
  deleteButton: {
    backgroundColor: Colors.light.error,
  },
});
