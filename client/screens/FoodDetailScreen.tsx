import React, { useState, useLayoutEffect } from "react";
import { View, StyleSheet, TextInput, ScrollView, Image, Dimensions } from "react-native";
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
import type { Food } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const SCREEN_WIDTH = Dimensions.get("window").width;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, "FoodDetail">;

export default function FoodDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { theme } = useTheme();

  const { entry } = route.params;
  const imageUri = entry.imageUri || entry.food.imageUri;

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
        {imageUri ? (
          <View style={styles.editImageContainer}>
            <Image source={{ uri: imageUri }} style={styles.editImage} />
          </View>
        ) : null}

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
      contentContainerStyle={{ paddingTop: imageUri ? 0 : headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }}
    >
      {imageUri ? (
        <View style={[styles.heroImageContainer, { marginTop: 0 }]}>
          <Image source={{ uri: imageUri }} style={styles.heroImage} />
          <View style={styles.heroOverlay} />
          <View style={[styles.heroCalories, { top: headerHeight + Spacing.sm }]}>
            <ThemedText type="h1" style={styles.heroCaloriesText}>
              {entry.food.calories}
            </ThemedText>
            <ThemedText type="small" style={styles.heroCaloriesLabel}>cal</ThemedText>
          </View>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: Spacing.lg }}>
        {imageUri ? null : (
          <View style={styles.macroGrid}>
            <View style={[styles.macroBox, { backgroundColor: theme.backgroundCard }]}>
              <ThemedText type="h1" style={{ color: Colors.light.primary }}>
                {entry.food.calories}
              </ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>Calories</ThemedText>
            </View>
          </View>
        )}

        {imageUri ? (
          <View style={styles.foodNameRow}>
            <ThemedText type="h3" style={{ color: theme.text, flex: 1 }}>
              {entry.food.name}
            </ThemedText>
          </View>
        ) : null}

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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  heroCalories: {
    position: "absolute",
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  heroCaloriesText: {
    color: "#FFFFFF",
    fontSize: 22,
  },
  heroCaloriesLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  foodNameRow: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
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
  editImageContainer: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.lg,
    height: 160,
  },
  editImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
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
