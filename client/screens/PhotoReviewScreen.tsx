import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Image, Pressable, TextInput, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Food } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getLocalDateString } from "@/lib/dateUtils";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ScreenRouteProp = RouteProp<RootStackParamList, "PhotoReview">;

interface ReviewItem {
  name: string;
  category: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: string;
  notes: string;
  servingSize: string;
}

export default function PhotoReviewScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { theme } = useTheme();

  const { foods, imageUri, mode } = route.params;

  const [items, setItems] = useState<ReviewItem[]>(
    foods.map((f: any) => ({
      name: f.name || "",
      category: f.category || "",
      grams: f.estimatedWeightGrams || 0,
      calories: f.calories || 0,
      protein: f.protein || 0,
      carbs: f.carbs || 0,
      fat: f.fat || 0,
      confidence: f.confidence || "medium",
      notes: f.notes || "",
      servingSize: f.servingSize || "",
    }))
  );

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const bgElevated = (theme as any).backgroundElevated || theme.backgroundSecondary;

  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const updateItem = (index: number, field: keyof ReviewItem, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      const numFields = ["grams", "calories", "protein", "carbs", "fat"];
      if (numFields.includes(field)) {
        (updated[index] as any)[field] = parseInt(value) || 0;
      } else {
        (updated[index] as any)[field] = value;
      }
      return updated;
    });
  };

  const removeItem = (index: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const createPersistentImageUri = async (uri: string): Promise<string | undefined> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 600 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (result.base64) {
        return `data:image/jpeg;base64,${result.base64}`;
      }
    } catch (error) {
      console.error("Failed to create persistent image:", error);
    }
    return undefined;
  };

  const handleLogAll = async () => {
    if (items.length === 0) return;

    const today = getLocalDateString();
    let persistentImageUri: string | undefined;
    if (imageUri) {
      persistentImageUri = await createPersistentImageUri(imageUri);
    }

    const combinedName = items.map((i) => i.name).join(", ");
    const food: Food = {
      id: uuidv4(),
      name: combinedName,
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      isSaved: false,
    };

    await storage.addFoodLogEntry(food, today, persistentImageUri);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    navigation.popTo("Main");
  };

  const confidenceColor = (c: string) => {
    if (c === "high") return Colors.light.success;
    if (c === "medium") return "#FFA500";
    return "#FF3B30";
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: insets.bottom + Spacing["2xl"],
        paddingHorizontal: Spacing.lg,
      }}
    >
      <Image source={{ uri: imageUri }} style={styles.heroImage} />

      {mode ? (
        <View style={[styles.modeBadge, { backgroundColor: bgElevated }]}>
          <Feather name="target" size={14} color={Colors.light.primary} />
          <ThemedText type="small" style={{ fontWeight: "600" }}>
            {mode === "lean" ? "Lean / Cut Mode" : mode === "bulk" ? "Bulk Mode" : "Maintenance Mode"}
          </ThemedText>
        </View>
      ) : null}

      <Card style={styles.totalsCard}>
        <ThemedText type="h3" style={{ textAlign: "center", marginBottom: Spacing.sm }}>
          {totals.calories} cal
        </ThemedText>
        <View style={styles.totalsRow}>
          <View style={styles.totalsMacro}>
            <ThemedText type="small" style={{ color: Colors.light.success, fontWeight: "700" }}>
              {totals.protein}g
            </ThemedText>
            <ThemedText type="small" style={{ opacity: 0.6 }}>Protein</ThemedText>
          </View>
          <View style={[styles.totalsDivider, { backgroundColor: theme.border }]} />
          <View style={styles.totalsMacro}>
            <ThemedText type="small" style={{ color: "#FFA500", fontWeight: "700" }}>
              {totals.carbs}g
            </ThemedText>
            <ThemedText type="small" style={{ opacity: 0.6 }}>Carbs</ThemedText>
          </View>
          <View style={[styles.totalsDivider, { backgroundColor: theme.border }]} />
          <View style={styles.totalsMacro}>
            <ThemedText type="small" style={{ color: "#9B59B6", fontWeight: "700" }}>
              {totals.fat}g
            </ThemedText>
            <ThemedText type="small" style={{ opacity: 0.6 }}>Fat</ThemedText>
          </View>
        </View>
      </Card>

      <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
        {items.length} item{items.length !== 1 ? "s" : ""} identified
      </ThemedText>

      {items.map((item, index) => {
        const isExpanded = expandedIndex === index;
        return (
          <Card key={index} style={styles.itemCard}>
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setExpandedIndex(isExpanded ? null : index);
              }}
              style={styles.itemHeader}
            >
              <View style={styles.itemHeaderLeft}>
                <View style={[styles.confidenceDot, { backgroundColor: confidenceColor(item.confidence) }]} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="small" style={{ opacity: 0.6 }}>
                    ~{item.grams}g | {item.calories} cal
                  </ThemedText>
                </View>
              </View>
              <View style={styles.itemHeaderRight}>
                <Pressable
                  onPress={() => removeItem(index)}
                  hitSlop={8}
                  style={styles.removeBtn}
                  testID={`remove-item-${index}`}
                >
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </Pressable>
                <Feather
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.textSecondary}
                />
              </View>
            </Pressable>

            {isExpanded ? (
              <View style={styles.itemDetails}>
                {item.notes ? (
                  <ThemedText type="small" style={styles.notesText}>
                    {item.notes}
                  </ThemedText>
                ) : null}
                <View style={styles.editRow}>
                  <View style={styles.editField}>
                    <ThemedText type="small" style={styles.editLabel}>Grams</ThemedText>
                    <TextInput
                      style={[styles.editInput, { color: theme.text, borderColor: theme.border, backgroundColor: bgElevated }]}
                      value={item.grams.toString()}
                      onChangeText={(v) => updateItem(index, "grams", v)}
                      keyboardType="number-pad"
                      testID={`edit-grams-${index}`}
                    />
                  </View>
                  <View style={styles.editField}>
                    <ThemedText type="small" style={styles.editLabel}>Calories</ThemedText>
                    <TextInput
                      style={[styles.editInput, { color: theme.text, borderColor: theme.border, backgroundColor: bgElevated }]}
                      value={item.calories.toString()}
                      onChangeText={(v) => updateItem(index, "calories", v)}
                      keyboardType="number-pad"
                      testID={`edit-calories-${index}`}
                    />
                  </View>
                </View>
                <View style={styles.editRow}>
                  <View style={styles.editField}>
                    <ThemedText type="small" style={[styles.editLabel, { color: Colors.light.success }]}>P (g)</ThemedText>
                    <TextInput
                      style={[styles.editInput, { color: theme.text, borderColor: theme.border, backgroundColor: bgElevated }]}
                      value={item.protein.toString()}
                      onChangeText={(v) => updateItem(index, "protein", v)}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.editField}>
                    <ThemedText type="small" style={[styles.editLabel, { color: "#FFA500" }]}>C (g)</ThemedText>
                    <TextInput
                      style={[styles.editInput, { color: theme.text, borderColor: theme.border, backgroundColor: bgElevated }]}
                      value={item.carbs.toString()}
                      onChangeText={(v) => updateItem(index, "carbs", v)}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.editField}>
                    <ThemedText type="small" style={[styles.editLabel, { color: "#9B59B6" }]}>F (g)</ThemedText>
                    <TextInput
                      style={[styles.editInput, { color: theme.text, borderColor: theme.border, backgroundColor: bgElevated }]}
                      value={item.fat.toString()}
                      onChangeText={(v) => updateItem(index, "fat", v)}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </Card>
        );
      })}

      {items.length > 0 ? (
        <Button onPress={handleLogAll} style={styles.logButton}>
          Log Meal ({totals.calories} cal)
        </Button>
      ) : (
        <ThemedText type="body" style={{ textAlign: "center", opacity: 0.6, marginTop: Spacing.xl }}>
          All items removed. Go back to try again.
        </ThemedText>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroImage: {
    width: "100%",
    height: 180,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    resizeMode: "cover",
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  totalsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  totalsMacro: {
    alignItems: "center",
    flex: 1,
  },
  totalsDivider: {
    width: 1,
    height: 28,
  },
  itemCard: {
    padding: 0,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  itemHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
  },
  itemHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  removeBtn: {
    padding: 4,
  },
  itemDetails: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  notesText: {
    fontStyle: "italic",
    opacity: 0.6,
    marginBottom: Spacing.xs,
  },
  editRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  editField: {
    flex: 1,
  },
  editLabel: {
    fontWeight: "600",
    marginBottom: 4,
    fontSize: 12,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Platform.OS === "ios" ? Spacing.sm : Spacing.xs,
    fontSize: 15,
    textAlign: "center",
  },
  logButton: {
    marginTop: Spacing.lg,
  },
});
