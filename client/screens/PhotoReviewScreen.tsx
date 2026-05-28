import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Image, Pressable, TextInput, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp, StackActions } from "@react-navigation/native";
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

// Numeric fields are kept as strings so the user can clear an input
// without it snapping back to "0" mid-typing. Parsing happens once at
// totals / save time via parseN().
interface ReviewItem {
  name: string;
  category: string;
  grams: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  confidence: string;
  notes: string;
  servingSize: string;
}

const parseN = (s: string): number => {
  const n = parseInt((s || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

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
      grams: String(f.estimatedWeightGrams || 0),
      calories: String(f.calories || 0),
      protein: String(f.protein || 0),
      carbs: String(f.carbs || 0),
      fat: String(f.fat || 0),
      confidence: f.confidence || "medium",
      notes: f.notes || "",
      servingSize: f.servingSize || "",
    }))
  );

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isLogging, setIsLogging] = useState(false);
  const bgElevated = (theme as any).backgroundElevated || theme.backgroundSecondary;

  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + parseN(item.calories),
      protein: acc.protein + parseN(item.protein),
      carbs: acc.carbs + parseN(item.carbs),
      fat: acc.fat + parseN(item.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const updateItem = (index: number, field: keyof ReviewItem, value: string) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
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
    if (items.length === 0 || isLogging) return;
    // Drop any item that's been zeroed out — the screen lets the user
    // delete a row, but they can also just clear all fields. Either way
    // we don't want a 0-cal placeholder entry in the log.
    const valid = items.filter(
      (i) => parseN(i.calories) > 0 || parseN(i.protein) > 0 || parseN(i.carbs) > 0 || parseN(i.fat) > 0,
    );
    if (valid.length === 0) return;

    setIsLogging(true);
    try {
      const today = getLocalDateString();
      let persistentImageUri: string | undefined;
      if (imageUri) {
        persistentImageUri = await createPersistentImageUri(imageUri);
      }

      // One log entry per identified item so the user can edit / delete
      // each one independently later. The meal photo is attached only to
      // the first entry — duplicating the same base64 image across N
      // rows would blow up AsyncStorage.
      for (let i = 0; i < valid.length; i++) {
        const item = valid[i];
        const food: Food = {
          id: uuidv4(),
          name: item.name,
          calories: parseN(item.calories),
          protein: parseN(item.protein),
          carbs: parseN(item.carbs),
          fat: parseN(item.fat),
          isSaved: false,
          ...(item.servingSize ? { serving: item.servingSize } : {}),
        };
        const imageForEntry = i === 0 ? persistentImageUri : undefined;
        await storage.addFoodLogEntry(food, today, imageForEntry);
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      navigation.dispatch(StackActions.popToTop());
    } catch (err) {
      console.error("Failed to log meal:", err);
      setIsLogging(false);
    }
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
            <ThemedText type="small" style={{ color: Colors.light.macroCarbs, fontWeight: "700" }}>
              {totals.carbs}g
            </ThemedText>
            <ThemedText type="small" style={{ opacity: 0.6 }}>Carbs</ThemedText>
          </View>
          <View style={[styles.totalsDivider, { backgroundColor: theme.border }]} />
          <View style={styles.totalsMacro}>
            <ThemedText type="small" style={{ color: Colors.light.macroFat, fontWeight: "700" }}>
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
                    ~{parseN(item.grams)}g | {parseN(item.calories)} cal
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
                      value={item.grams}
                      onChangeText={(v) => updateItem(index, "grams", v)}
                      keyboardType="number-pad"
                      testID={`edit-grams-${index}`}
                    />
                  </View>
                  <View style={styles.editField}>
                    <ThemedText type="small" style={styles.editLabel}>Calories</ThemedText>
                    <TextInput
                      style={[styles.editInput, { color: theme.text, borderColor: theme.border, backgroundColor: bgElevated }]}
                      value={item.calories}
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
                      value={item.protein}
                      onChangeText={(v) => updateItem(index, "protein", v)}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.editField}>
                    <ThemedText type="small" style={[styles.editLabel, { color: Colors.light.macroCarbs }]}>C (g)</ThemedText>
                    <TextInput
                      style={[styles.editInput, { color: theme.text, borderColor: theme.border, backgroundColor: bgElevated }]}
                      value={item.carbs}
                      onChangeText={(v) => updateItem(index, "carbs", v)}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.editField}>
                    <ThemedText type="small" style={[styles.editLabel, { color: Colors.light.macroFat }]}>F (g)</ThemedText>
                    <TextInput
                      style={[styles.editInput, { color: theme.text, borderColor: theme.border, backgroundColor: bgElevated }]}
                      value={item.fat}
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
        <Button onPress={handleLogAll} disabled={isLogging} style={styles.logButton}>
          {isLogging ? "Saving..." : `Log Meal (${totals.calories} cal)`}
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
