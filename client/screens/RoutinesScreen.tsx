import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, Alert } from "react-native";
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
    Alert.alert(
      "Delete Routine",
      `Are you sure you want to delete "${routine.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await storage.deleteRoutine(routine.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadRoutines();
          },
        },
      ]
    );
  };
  
  const renderRoutine = ({ item }: { item: Routine }) => (
    <Pressable
      onPress={() => navigation.navigate("EditRoutine", { routineId: item.id })}
      onLongPress={() => handleDelete(item)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Card style={styles.routineCard}>
        <View style={styles.routineHeader}>
          <ThemedText type="h3">{item.name}</ThemedText>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
        <ThemedText type="small" style={styles.routineInfo}>
          {item.exercises.length} exercise{item.exercises.length !== 1 ? "s" : ""}
        </ThemedText>
        {item.lastCompletedAt ? (
          <ThemedText type="small" style={styles.lastCompleted}>
            Last completed: {new Date(item.lastCompletedAt).toLocaleDateString()}
          </ThemedText>
        ) : null}
      </Card>
    </Pressable>
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
        <Pressable
          onPress={() => navigation.navigate("EditRoutine", {})}
          style={[styles.createButton, { backgroundColor: theme.backgroundElevated }]}
        >
          <ThemedText type="body" style={{ fontWeight: "600" }}>
            Or create from scratch
          </ThemedText>
        </Pressable>
      </View>
    );
  }
  
  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      ListHeaderComponent={
        <Pressable
          onPress={() => navigation.navigate("RoutineTemplates")}
          style={({ pressed }) => [
            styles.templateButton,
            { backgroundColor: theme.backgroundElevated, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={[styles.templateIcon, { backgroundColor: Colors.light.primary }]}>
            <Feather name="grid" size={16} color="#FFFFFF" />
          </View>
          <ThemedText type="body" style={{ fontWeight: "600" }}>
            Browse Workout Templates
          </ThemedText>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>
      }
      data={routines}
      keyExtractor={(item) => item.id}
      renderItem={renderRoutine}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
    />
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
    alignItems: "center",
  },
  routineInfo: {
    opacity: 0.6,
    marginTop: Spacing.xs,
  },
  lastCompleted: {
    opacity: 0.5,
    marginTop: Spacing.xs,
  },
  templateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  templateIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    alignItems: "center",
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
});
