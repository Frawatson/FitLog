import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
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

  const renderRoutine = ({ item }: { item: Routine }) => (
    <Card style={styles.routineCard}>
      <View style={styles.routineHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText type="h3">{item.name}</ThemedText>
          <ThemedText type="small" style={styles.routineInfo}>
            {item.exercises.length} exercise{item.exercises.length !== 1 ? "s" : ""}
          </ThemedText>
          {item.lastCompletedAt ? (
            <ThemedText type="small" style={styles.lastCompleted}>
              Last completed: {new Date(item.lastCompletedAt).toLocaleDateString()}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.routineActions}>
          <Pressable
            onPress={() => handleDelete(item)}
            style={[styles.actionButton, { backgroundColor: theme.backgroundElevated }]}
          >
            <Feather name="trash-2" size={18} color={Colors.light.error} />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              navigation.navigate("EditRoutine", { routineId: item.id });
            }}
            style={[styles.actionButton, { backgroundColor: theme.backgroundElevated }]}
          >
            <Feather name="edit-2" size={18} color={theme.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => handleStartWorkout(item)}
            style={[styles.actionButton, styles.playButton]}
          >
            <Feather name="play" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Card>
  );
  
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
        <Card
          onPress={() => navigation.navigate("EditRoutine", {})}
          style={styles.createButton}
        >
          <ThemedText type="body" style={{ fontWeight: "600", textAlign: "center" }}>
            Or create from scratch
          </ThemedText>
        </Card>
      </View>
    );
  }
  
  const renderDeleteModal = () => {
    if (!deleteModalVisible) return null;
    
    return (
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={styles.modalOverlay} onPress={cancelDelete}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
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
                <ThemedText type="body" style={{ fontWeight: "600" }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.deleteButton]}
                onPress={confirmDelete}
              >
                <ThemedText type="body" style={{ fontWeight: "600", color: "#FFFFFF" }}>Delete</ThemedText>
              </Pressable>
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
          <View style={styles.headerButtons}>
            <Card 
              style={styles.templateButton}
              onPress={() => navigation.navigate("RoutineTemplates")}
            >
              <View style={styles.templateButtonContent}>
                <View style={[styles.templateIcon, { backgroundColor: Colors.light.primary }]}>
                  <Feather name="grid" size={16} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Browse Templates
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </View>
            </Card>
            <Card 
              style={styles.templateButton}
              onPress={() => navigation.navigate("GenerateRoutine")}
            >
              <View style={styles.templateButtonContent}>
                <View style={[styles.templateIcon, { backgroundColor: "#9333EA" }]}>
                  <Feather name="zap" size={16} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Generate Custom Routine
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </View>
            </Card>
          </View>
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
  lastCompleted: {
    opacity: 0.5,
    marginTop: Spacing.xs,
  },
  routineActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginLeft: Spacing.md,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    backgroundColor: Colors.light.primary,
  },
  templateButton: {
    padding: Spacing.lg,
  },
  templateButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  templateIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtons: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  createButton: {
    alignItems: "center",
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
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
