import React, { useState, useCallback } from "react";
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
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { MacroTargets, FoodLogEntry } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();
  
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
      quality: 0.7,
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
          [{ resize: { width: 1024 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
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
