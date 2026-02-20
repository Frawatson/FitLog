import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, ScrollView, Pressable, Image, Platform, Linking, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ProgressRing } from "@/components/ProgressRing";
import { EmptyState } from "@/components/EmptyState";
import { AnimatedPress } from "@/components/AnimatedPress";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { MacroTargets, FoodLogEntry } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";
import { getLocalDateString } from "@/lib/dateUtils";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PeriodMode = "day" | "week" | "month";

function getDateRange(date: string, mode: PeriodMode): { start: string; end: string; days: number } {
  const d = new Date(date);
  if (mode === "day") {
    return { start: date, end: date, days: 1 };
  }
  if (mode === "week") {
    const dayOfWeek = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - dayOfWeek);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const actualEnd = end > today ? today : end;
    const dayCount = Math.floor((actualEnd.getTime() - start.getTime()) / 86400000) + 1;
    return {
      start: getLocalDateString(start),
      end: getLocalDateString(actualEnd),
      days: Math.max(dayCount, 1),
    };
  }
  // month
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const actualEnd = endOfMonth > today ? today : endOfMonth;
  const dayCount = Math.floor((actualEnd.getTime() - start.getTime()) / 86400000) + 1;
  return {
    start: getLocalDateString(start),
    end: getLocalDateString(actualEnd),
    days: Math.max(dayCount, 1),
  };
}

function formatPeriodLabel(date: string, mode: PeriodMode): string {
  const d = new Date(date);
  if (mode === "day") {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date === getLocalDateString(today)) return "Today";
    if (date === getLocalDateString(yesterday)) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  if (mode === "week") {
    const range = getDateRange(date, "week");
    const s = new Date(range.start);
    const e = new Date(range.end);
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function NutritionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();

  const [periodMode, setPeriodMode] = useState<PeriodMode>("day");
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>(null);
  const [todayTotals, setTodayTotals] = useState<MacroTargets>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [periodAverages, setPeriodAverages] = useState<MacroTargets>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [periodDaysLogged, setPeriodDaysLogged] = useState(0);
  const [foodLog, setFoodLog] = useState<FoodLogEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  const loadData = async () => {
    if (periodMode === "day") {
      const [targets, totals, log] = await Promise.all([
        storage.getMacroTargets(),
        storage.getDailyTotals(selectedDate),
        storage.getFoodLog(selectedDate),
      ]);
      setMacroTargets(targets);
      setTodayTotals(totals);
      setFoodLog(log);
    } else {
      const range = getDateRange(selectedDate, periodMode);
      const [targets, allEntries] = await Promise.all([
        storage.getMacroTargets(),
        storage.getFoodLog(),
      ]);
      setMacroTargets(targets);
      const periodEntries = allEntries.filter(
        (e) => e.date >= range.start && e.date <= range.end
      );

      // Group by date and sum
      const dailyMap = new Map<string, MacroTargets>();
      for (const entry of periodEntries) {
        const existing = dailyMap.get(entry.date) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
        existing.calories += entry.food.calories;
        existing.protein += entry.food.protein;
        existing.carbs += entry.food.carbs;
        existing.fat += entry.food.fat;
        dailyMap.set(entry.date, existing);
      }

      const daysWithData = dailyMap.size;
      const divisor = Math.max(daysWithData, 1);
      const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      for (const day of dailyMap.values()) {
        totals.calories += day.calories;
        totals.protein += day.protein;
        totals.carbs += day.carbs;
        totals.fat += day.fat;
      }

      setPeriodAverages({
        calories: Math.round(totals.calories / divisor),
        protein: Math.round(totals.protein / divisor),
        carbs: Math.round(totals.carbs / divisor),
        fat: Math.round(totals.fat / divisor),
      });
      setPeriodDaysLogged(daysWithData);
      setFoodLog(periodEntries);
    }
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedDate, periodMode])
  );

  const openDetail = (entry: FoodLogEntry) => {
    Haptics.selectionAsync();
    navigation.navigate("FoodDetail", { entry });
  };

  const navigateDate = (direction: number) => {
    const current = new Date(selectedDate);
    if (periodMode === "day") {
      current.setDate(current.getDate() + direction);
    } else if (periodMode === "week") {
      current.setDate(current.getDate() + direction * 7);
    } else {
      current.setMonth(current.getMonth() + direction);
    }
    setSelectedDate(getLocalDateString(current));
  };

  const isAtToday = (() => {
    const today = getLocalDateString();
    if (periodMode === "day") return selectedDate === today;
    const range = getDateRange(selectedDate, periodMode);
    return range.end >= today;
  })();

  const macroColor = (actual: number, target: number): string => {
    if (target === 0) return theme.text;
    const ratio = actual / target;
    if (ratio >= 0.85 && ratio <= 1.15) return Colors.light.success;
    return Colors.light.error;
  };

  const handleCameraFAB = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        if (!result.canAskAgain && Platform.OS !== "web") {
          try { await Linking.openSettings(); } catch {}
        }
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      base64: false,
      exif: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsAnalyzing(true);
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1536 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        const base64 = manipulated.base64 || null;
        const url = new URL("/api/foods/analyze-photo", getApiUrl());
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        const response = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ imageBase64: base64 }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.foods && data.foods.length > 0) {
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            navigation.navigate("PhotoReview", {
              foods: data.foods,
              imageUri: asset.uri,
              imageBase64: base64 || undefined,
              mode: data.mode,
            });
          } else {
            navigation.navigate("AddFood");
          }
        } else {
          navigation.navigate("AddFood");
        }
      } catch {
        navigation.navigate("AddFood");
      } finally {
        setIsAnalyzing(false);
      }
    }
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
        {isLoading ? (
          <View style={{ gap: Spacing.xl }}>
            <SkeletonLoader variant="line" width="50%" height={32} style={{ alignSelf: "center" }} />
            <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
              <SkeletonLoader variant="circle" height={90} />
              <SkeletonLoader variant="circle" height={90} />
              <SkeletonLoader variant="circle" height={90} />
              <SkeletonLoader variant="circle" height={90} />
            </View>
            <SkeletonLoader variant="card" />
            <SkeletonLoader variant="card" />
          </View>
        ) : (
        <>
        {/* Period Toggle */}
        <View style={styles.periodToggle}>
          {(["day", "week", "month"] as PeriodMode[]).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => {
                setPeriodMode(mode);
                setSelectedDate(getLocalDateString());
              }}
              style={[
                styles.periodButton,
                {
                  backgroundColor:
                    periodMode === mode ? Colors.light.primary : theme.backgroundSecondary,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  fontWeight: "600",
                  color: periodMode === mode ? "#FFFFFF" : theme.textSecondary,
                }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={styles.dateSelector}>
          <Pressable onPress={() => navigateDate(-1)} hitSlop={8}>
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">{formatPeriodLabel(selectedDate, periodMode)}</ThemedText>
          <Pressable
            onPress={() => navigateDate(1)}
            hitSlop={8}
            disabled={isAtToday}
          >
            <Feather
              name="chevron-right"
              size={24}
              color={isAtToday ? theme.textSecondary : theme.text}
            />
          </Pressable>
        </View>

        {macroTargets && periodMode === "day" ? (
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

        {macroTargets && periodMode !== "day" ? (
          <Card style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <ThemedText type="h4">Daily Averages</ThemedText>
              <ThemedText type="caption" style={{ opacity: 0.5 }}>
                {periodDaysLogged} day{periodDaysLogged !== 1 ? "s" : ""} logged
              </ThemedText>
            </View>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <ThemedText type="caption" style={{ opacity: 0.6 }}>Calories</ThemedText>
                <ThemedText
                  type="h3"
                  style={{ color: macroColor(periodAverages.calories, macroTargets.calories) }}
                >
                  {periodAverages.calories}
                </ThemedText>
                <ThemedText type="caption" style={{ opacity: 0.4 }}>
                  / {macroTargets.calories}
                </ThemedText>
              </View>
              <View style={styles.summaryItem}>
                <ThemedText type="caption" style={{ opacity: 0.6 }}>Protein</ThemedText>
                <ThemedText
                  type="h3"
                  style={{ color: macroColor(periodAverages.protein, macroTargets.protein) }}
                >
                  {periodAverages.protein}g
                </ThemedText>
                <ThemedText type="caption" style={{ opacity: 0.4 }}>
                  / {macroTargets.protein}g
                </ThemedText>
              </View>
              <View style={styles.summaryItem}>
                <ThemedText type="caption" style={{ opacity: 0.6 }}>Carbs</ThemedText>
                <ThemedText
                  type="h3"
                  style={{ color: macroColor(periodAverages.carbs, macroTargets.carbs) }}
                >
                  {periodAverages.carbs}g
                </ThemedText>
                <ThemedText type="caption" style={{ opacity: 0.4 }}>
                  / {macroTargets.carbs}g
                </ThemedText>
              </View>
              <View style={styles.summaryItem}>
                <ThemedText type="caption" style={{ opacity: 0.6 }}>Fat</ThemedText>
                <ThemedText
                  type="h3"
                  style={{ color: macroColor(periodAverages.fat, macroTargets.fat) }}
                >
                  {periodAverages.fat}g
                </ThemedText>
                <ThemedText type="caption" style={{ opacity: 0.4 }}>
                  / {macroTargets.fat}g
                </ThemedText>
              </View>
            </View>
          </Card>
        ) : null}

        <View style={styles.sectionHeader}>
          <ThemedText type="h4">
            {periodMode === "day" ? "Food Log" : "All Foods This Period"}
          </ThemedText>
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
                  {(entry.imageUri || entry.food.imageUri) ? (
                    <Image
                      source={{ uri: entry.imageUri || entry.food.imageUri }}
                      style={styles.foodThumbnail}
                    />
                  ) : (
                    <View style={[styles.foodIconPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                      <Feather name="coffee" size={20} color={theme.textSecondary} />
                    </View>
                  )}
                  <View style={styles.foodInfo}>
                    <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
                      {entry.food.name}
                    </ThemedText>
                    <View style={styles.macroRow}>
                      <ThemedText type="small" style={{ fontWeight: "700", color: Colors.light.primary }}>
                        {entry.food.calories}
                      </ThemedText>
                      <ThemedText type="small" style={{ opacity: 0.5 }}> cal</ThemedText>
                      <View style={styles.macroDot} />
                      <ThemedText type="small" style={{ color: Colors.light.success, fontWeight: "600" }}>
                        P {entry.food.protein}g
                      </ThemedText>
                      <View style={styles.macroDot} />
                      <ThemedText type="small" style={{ color: "#FFA500", fontWeight: "600" }}>
                        C {entry.food.carbs}g
                      </ThemedText>
                      <View style={styles.macroDot} />
                      <ThemedText type="small" style={{ color: "#9B59B6", fontWeight: "600" }}>
                        F {entry.food.fat}g
                      </ThemedText>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState
            image={require("../../assets/images/empty-foods.png")}
            title={periodMode === "day" ? "No foods logged" : "No foods this period"}
            message={periodMode === "day" ? "Track your meals to hit your macro targets" : "Log meals daily to see your averages here"}
            actionLabel={periodMode === "day" ? "Add Food" : undefined}
            onAction={periodMode === "day" ? () => navigation.navigate("AddFood") : undefined}
          />
        )}

        {foodLog.length > 0 && periodMode === "day" ? (
          <Button
            onPress={() => navigation.navigate("AddFood")}
            style={styles.addButton}
          >
            Add Food
          </Button>
        ) : null}
        </>
        )}
      </ScrollView>

      <Pressable
        onPress={handleCameraFAB}
        disabled={isAnalyzing}
        style={[
          styles.fab,
          { bottom: tabBarHeight + Spacing.lg },
        ]}
        testID="button-camera-fab"
      >
        {isAnalyzing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Feather name="camera" size={24} color="#FFFFFF" />
        )}
      </Pressable>

      {isAnalyzing ? (
        <View style={[styles.analyzingBanner, { bottom: tabBarHeight + Spacing.lg + 68 }]}>
          <View style={[styles.analyzingBannerInner, { backgroundColor: theme.backgroundSecondary }]}>
            <ActivityIndicator size="small" color={Colors.light.primary} />
            <ThemedText type="small" style={{ fontWeight: "600" }}>Analyzing photo...</ThemedText>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  periodToggle: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    alignSelf: "center",
  },
  periodButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
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
  summaryCard: {
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
    gap: 2,
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
    gap: Spacing.md,
  },
  foodThumbnail: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
  },
  foodIconPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  foodInfo: {
    flex: 1,
    gap: 4,
  },
  macroRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  macroDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#999",
    marginHorizontal: 5,
  },
  addButton: {
    marginTop: Spacing.lg,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  analyzingBanner: {
    position: "absolute",
    right: Spacing.lg,
    alignItems: "flex-end",
  },
  analyzingBannerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
});
