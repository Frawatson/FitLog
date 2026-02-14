import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ProgressRing } from "@/components/ProgressRing";
import { EmptyState } from "@/components/EmptyState";
import { AnimatedPress } from "@/components/AnimatedPress";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { MacroTargets, FoodLogEntry, Food } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>(null);
  const [todayTotals, setTodayTotals] = useState<MacroTargets>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [foodLog, setFoodLog] = useState<FoodLogEntry[]>([]);
  
  const [selectedEntry, setSelectedEntry] = useState<FoodLogEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCalories, setEditCalories] = useState("");
  const [editProtein, setEditProtein] = useState("");
  const [editCarbs, setEditCarbs] = useState("");
  const [editFat, setEditFat] = useState("");
  
  const loadData = async () => {
    const [targets, totals, log] = await Promise.all([
      storage.getMacroTargets(),
      storage.getDailyTotals(selectedDate),
      storage.getFoodLog(selectedDate),
    ]);
    setMacroTargets(targets);
    setTodayTotals(totals);
    setFoodLog(log);
  };
  
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedDate])
  );
  
  const handleDeleteEntry = async (entryId: string) => {
    await storage.deleteFoodLogEntry(entryId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelectedEntry(null);
    loadData();
  };

  const openDetail = (entry: FoodLogEntry) => {
    setSelectedEntry(entry);
    setIsEditing(false);
    Haptics.selectionAsync();
  };

  const startEditing = () => {
    if (!selectedEntry) return;
    setEditName(selectedEntry.food.name);
    setEditCalories(String(selectedEntry.food.calories));
    setEditProtein(String(selectedEntry.food.protein));
    setEditCarbs(String(selectedEntry.food.carbs));
    setEditFat(String(selectedEntry.food.fat));
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEntry) return;
    const updatedFood: Food = {
      ...selectedEntry.food,
      name: editName.trim() || selectedEntry.food.name,
      calories: parseInt(editCalories) || 0,
      protein: parseInt(editProtein) || 0,
      carbs: parseInt(editCarbs) || 0,
      fat: parseInt(editFat) || 0,
    };
    await storage.updateFoodLogEntry(selectedEntry.id, updatedFood);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelectedEntry(null);
    setIsEditing(false);
    loadData();
  };
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateStr === today.toISOString().split("T")[0]) return "Today";
    if (dateStr === yesterday.toISOString().split("T")[0]) return "Yesterday";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };
  
  const navigateDate = (direction: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split("T")[0]);
  };
  
  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.dateSelector}>
          <Pressable onPress={() => navigateDate(-1)} hitSlop={8}>
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">{formatDate(selectedDate)}</ThemedText>
          <Pressable
            onPress={() => navigateDate(1)}
            hitSlop={8}
            disabled={selectedDate === new Date().toISOString().split("T")[0]}
          >
            <Feather
              name="chevron-right"
              size={24}
              color={
                selectedDate === new Date().toISOString().split("T")[0]
                  ? theme.textSecondary
                  : theme.text
              }
            />
          </Pressable>
        </View>
        
        {macroTargets ? (
          <View style={styles.macroRings}>
            <ProgressRing
              progress={todayTotals.calories / macroTargets.calories}
              size={90}
              label="Calories"
              value={`${todayTotals.calories}`}
              color={Colors.light.primary}
            />
            <ProgressRing
              progress={todayTotals.protein / macroTargets.protein}
              size={90}
              label="Protein"
              value={`${todayTotals.protein}g`}
              color={Colors.light.success}
            />
            <ProgressRing
              progress={todayTotals.carbs / macroTargets.carbs}
              size={90}
              label="Carbs"
              value={`${todayTotals.carbs}g`}
              color="#FFA500"
            />
            <ProgressRing
              progress={todayTotals.fat / macroTargets.fat}
              size={90}
              label="Fat"
              value={`${todayTotals.fat}g`}
              color="#9B59B6"
            />
          </View>
        ) : null}
        
        <View style={styles.sectionHeader}>
          <ThemedText type="h4">Food Log</ThemedText>
        </View>
        
        {foodLog.length > 0 ? (
          <View style={styles.foodList}>
            {foodLog.map((entry) => (
              <Card
                key={entry.id}
                onPress={() => openDetail(entry)}
                style={styles.foodCard}
              >
                <View style={styles.foodRow}>
                  <View style={styles.foodInfo}>
                    <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={2}>
                      {entry.food.name}
                    </ThemedText>
                    <ThemedText type="small" style={styles.foodMacros}>
                      {entry.food.calories} cal | P: {entry.food.protein}g | C: {entry.food.carbs}g | F: {entry.food.fat}g
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState
            image={require("../../assets/images/empty-foods.png")}
            title="No foods logged"
            message="Track your meals to hit your macro targets"
            actionLabel="Add Food"
            onAction={() => navigation.navigate("AddFood")}
          />
        )}
        
        {foodLog.length > 0 ? (
          <Button
            onPress={() => navigation.navigate("AddFood")}
            style={styles.addButton}
          >
            Add Food
          </Button>
        ) : null}
      </ScrollView>

      <Modal
        visible={selectedEntry !== null}
        animationType="slide"
        transparent
        onRequestClose={() => { setSelectedEntry(null); setIsEditing(false); }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => { setSelectedEntry(null); setIsEditing(false); }}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundCard }]}>
            <View style={styles.modalHandle} />

            {selectedEntry && !isEditing ? (
              <>
                <ThemedText type="h3" style={styles.modalTitle}>
                  {selectedEntry.food.name}
                </ThemedText>

                <View style={styles.macroGrid}>
                  <View style={[styles.macroBox, { backgroundColor: theme.backgroundRoot }]}>
                    <ThemedText type="h2" style={{ color: Colors.light.primary }}>
                      {selectedEntry.food.calories}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Calories</ThemedText>
                  </View>
                </View>

                <View style={styles.macroRow}>
                  <View style={[styles.macroBox, styles.macroBoxSmall, { backgroundColor: theme.backgroundRoot }]}>
                    <ThemedText type="h4" style={{ color: Colors.light.success }}>
                      {selectedEntry.food.protein}g
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Protein</ThemedText>
                  </View>
                  <View style={[styles.macroBox, styles.macroBoxSmall, { backgroundColor: theme.backgroundRoot }]}>
                    <ThemedText type="h4" style={{ color: "#FFA500" }}>
                      {selectedEntry.food.carbs}g
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Carbs</ThemedText>
                  </View>
                  <View style={[styles.macroBox, styles.macroBoxSmall, { backgroundColor: theme.backgroundRoot }]}>
                    <ThemedText type="h4" style={{ color: "#9B59B6" }}>
                      {selectedEntry.food.fat}g
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Fat</ThemedText>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <AnimatedPress
                    onPress={startEditing}
                    style={[styles.actionButton, { backgroundColor: Colors.light.primary }]}
                    testID="button-edit-food"
                  >
                    <Feather name="edit-2" size={18} color="#FFFFFF" />
                    <ThemedText type="body" style={styles.actionButtonText}>Edit</ThemedText>
                  </AnimatedPress>
                  <AnimatedPress
                    onPress={() => handleDeleteEntry(selectedEntry.id)}
                    style={[styles.actionButton, { backgroundColor: "#EF4444" }]}
                    testID="button-delete-food"
                  >
                    <Feather name="trash-2" size={18} color="#FFFFFF" />
                    <ThemedText type="body" style={styles.actionButtonText}>Delete</ThemedText>
                  </AnimatedPress>
                </View>
              </>
            ) : null}

            {selectedEntry && isEditing ? (
              <>
                <ThemedText type="h3" style={styles.modalTitle}>Edit Food</ThemedText>

                <View style={styles.editField}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 4 }}>Name</ThemedText>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border }]}
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
                      style={[styles.editInput, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border }]}
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
                      style={[styles.editInput, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border }]}
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
                      style={[styles.editInput, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border }]}
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
                      style={[styles.editInput, { backgroundColor: theme.backgroundRoot, color: theme.text, borderColor: theme.border }]}
                      value={editFat}
                      onChangeText={setEditFat}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={theme.textSecondary}
                      testID="input-fat"
                    />
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <AnimatedPress
                    onPress={handleSaveEdit}
                    style={[styles.actionButton, { backgroundColor: Colors.light.primary, flex: 1 }]}
                    testID="button-save-food"
                  >
                    <Feather name="check" size={18} color="#FFFFFF" />
                    <ThemedText type="body" style={styles.actionButtonText}>Save</ThemedText>
                  </AnimatedPress>
                  <AnimatedPress
                    onPress={() => setIsEditing(false)}
                    style={[styles.actionButton, { backgroundColor: theme.backgroundRoot, flex: 1 }]}
                    testID="button-cancel-edit"
                  >
                    <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }}>Cancel</ThemedText>
                  </AnimatedPress>
                </View>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dateSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  macroRings: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: Spacing["2xl"],
  },
  sectionHeader: {
    marginBottom: Spacing.lg,
  },
  foodList: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  foodCard: {
    padding: Spacing.lg,
  },
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  foodInfo: {
    flex: 1,
  },
  foodMacros: {
    opacity: 0.6,
    marginTop: Spacing.xs,
  },
  addButton: {
    marginTop: Spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: Spacing["2xl"] + 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    marginBottom: Spacing.xl,
  },
  macroGrid: {
    marginBottom: Spacing.md,
  },
  macroBox: {
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  macroRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  macroBoxSmall: {
    flex: 1,
    padding: Spacing.md,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
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
