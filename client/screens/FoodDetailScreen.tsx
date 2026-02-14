import React, { useState, useLayoutEffect } from "react";
import { View, StyleSheet, TextInput, ScrollView, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Food, FoodLogEntry } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, "FoodDetail">;

export default function FoodDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { theme } = useTheme();

  const { entry } = route.params;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(entry.food.name);
  const [editCalories, setEditCalories] = useState(String(entry.food.calories));
  const [editProtein, setEditProtein] = useState(String(entry.food.protein));
  const [editCarbs, setEditCarbs] = useState(String(entry.food.carbs));
  const [editFat, setEditFat] = useState(String(entry.food.fat));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: isEditing ? "Edit Food" : entry.food.name,
    });
  }, [isEditing, entry.food.name]);

  const handleDelete = async () => {
    await storage.deleteFoodLogEntry(entry.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };

  const startEditing = () => {
    setEditName(entry.food.name);
    setEditCalories(String(entry.food.calories));
    setEditProtein(String(entry.food.protein));
    setEditCarbs(String(entry.food.carbs));
    setEditFat(String(entry.food.fat));
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    const updatedFood: Food = {
      ...entry.food,
      name: editName.trim() || entry.food.name,
      calories: parseInt(editCalories) || 0,
      protein: parseInt(editProtein) || 0,
      carbs: parseInt(editCarbs) || 0,
      fat: parseInt(editFat) || 0,
    };
    await storage.updateFoodLogEntry(entry.id, updatedFood);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };

  if (isEditing) {
    return (
      <KeyboardAwareScrollViewCompat
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + 120 }}
      >
        <View style={styles.editField}>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 4 }}>Name</ThemedText>
          <TextInput
            style={[styles.editInput, { backgroundColor: theme.backgroundCard, color: theme.text, borderColor: theme.border }]}
            value={editName}
            onChangeText={setEditName}
            placeholder="Food name"
            placeholderTextColor={theme.textSecondary}
            testID="input-food-name"
          />
        </View>

        <View style={styles.editRow}>
          <View style={styles.editFieldHalf}>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 4 }}>Calories</ThemedText>
            <TextInput
              style={[styles.editInput, { backgroundColor: theme.backgroundCard, color: theme.text, borderColor: theme.border }]}
              value={editCalories}
              onChangeText={setEditCalories}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              testID="input-calories"
            />
          </View>
          <View style={styles.editFieldHalf}>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 4 }}>Protein (g)</ThemedText>
            <TextInput
              style={[styles.editInput, { backgroundColor: theme.backgroundCard, color: theme.text, borderColor: theme.border }]}
              value={editProtein}
              onChangeText={setEditProtein}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              testID="input-protein"
            />
          </View>
        </View>

        <View style={styles.editRow}>
          <View style={styles.editFieldHalf}>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 4 }}>Carbs (g)</ThemedText>
            <TextInput
              style={[styles.editInput, { backgroundColor: theme.backgroundCard, color: theme.text, borderColor: theme.border }]}
              value={editCarbs}
              onChangeText={setEditCarbs}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              testID="input-carbs"
            />
          </View>
          <View style={styles.editFieldHalf}>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 4 }}>Fat (g)</ThemedText>
            <TextInput
              style={[styles.editInput, { backgroundColor: theme.backgroundCard, color: theme.text, borderColor: theme.border }]}
              value={editFat}
              onChangeText={setEditFat}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              testID="input-fat"
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Button onPress={handleSaveEdit}>Save</Button>
          <Button onPress={() => setIsEditing(false)}>Cancel</Button>
        </View>
      </KeyboardAwareScrollViewCompat>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }}
    >
      <View style={styles.macroGrid}>
        <View style={[styles.macroBox, { backgroundColor: theme.backgroundCard }]}>
          <ThemedText type="h1" style={{ color: Colors.light.primary }}>
            {entry.food.calories}
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>Calories</ThemedText>
        </View>
      </View>

      <View style={styles.macroRow}>
        <View style={[styles.macroBox, styles.macroBoxSmall, { backgroundColor: theme.backgroundCard }]}>
          <ThemedText type="h3" style={{ color: Colors.light.success }}>
            {entry.food.protein}g
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Protein</ThemedText>
        </View>
        <View style={[styles.macroBox, styles.macroBoxSmall, { backgroundColor: theme.backgroundCard }]}>
          <ThemedText type="h3" style={{ color: "#FFA500" }}>
            {entry.food.carbs}g
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Carbs</ThemedText>
        </View>
        <View style={[styles.macroBox, styles.macroBoxSmall, { backgroundColor: theme.backgroundCard }]}>
          <ThemedText type="h3" style={{ color: "#9B59B6" }}>
            {entry.food.fat}g
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Fat</ThemedText>
        </View>
      </View>

      {entry.food.serving ? (
        <View style={[styles.servingBox, { backgroundColor: theme.backgroundCard }]}>
          <Feather name="info" size={16} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, flex: 1 }}>
            {entry.food.serving}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.actions}>
        <AnimatedPress
          onPress={startEditing}
          style={[styles.actionButton, { backgroundColor: Colors.light.primary }]}
          testID="button-edit-food"
        >
          <Feather name="edit-2" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.actionButtonText}>Edit</ThemedText>
        </AnimatedPress>
        <AnimatedPress
          onPress={handleDelete}
          style={[styles.actionButton, { backgroundColor: "#EF4444" }]}
          testID="button-delete-food"
        >
          <Feather name="trash-2" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.actionButtonText}>Delete</ThemedText>
        </AnimatedPress>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  macroGrid: {
    marginBottom: Spacing.lg,
  },
  macroBox: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  macroRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  macroBoxSmall: {
    flex: 1,
    padding: Spacing.lg,
  },
  servingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  editField: {
    marginBottom: Spacing.md,
  },
  editRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  editFieldHalf: {
    flex: 1,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
  },
});
