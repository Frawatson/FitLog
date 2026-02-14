import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
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
import type { MacroTargets, FoodLogEntry } from "@/types";
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

  const openDetail = (entry: FoodLogEntry) => {
    Haptics.selectionAsync();
    navigation.navigate("FoodDetail", { entry });
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
});
