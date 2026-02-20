import React, { useState, useEffect } from "react";
import { View, StyleSheet, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { MacroTargets } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MACRO_CONFIG = [
  { key: "calories", label: "Calories", suffix: "kcal", icon: "zap" as const, color: Colors.light.primary, placeholder: "2000" },
  { key: "protein", label: "Protein", suffix: "g", icon: "target" as const, color: Colors.light.success, placeholder: "150" },
  { key: "carbs", label: "Carbs", suffix: "g", icon: "box" as const, color: "#FFA500", placeholder: "200" },
  { key: "fat", label: "Fat", suffix: "g", icon: "droplet" as const, color: "#9B59B6", placeholder: "60" },
];

export default function EditMacrosScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();

  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const macroState: Record<string, { value: string; setter: (v: string) => void }> = {
    calories: { value: calories, setter: setCalories },
    protein: { value: protein, setter: setProtein },
    carbs: { value: carbs, setter: setCarbs },
    fat: { value: fat, setter: setFat },
  };

  useEffect(() => {
    loadMacros();
  }, []);

  const loadMacros = async () => {
    const macros = await storage.getMacroTargets();
    if (macros) {
      setCalories(macros.calories.toString());
      setProtein(macros.protein.toString());
      setCarbs(macros.carbs.toString());
      setFat(macros.fat.toString());
    }
  };

  const handleAutoCalculate = async () => {
    const profile = await storage.getUserProfile();
    if (!profile || !profile.weightKg || !profile.heightCm || !profile.age) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    const macros = storage.calculateMacros(profile);
    setCalories(macros.calories.toString());
    setProtein(macros.protein.toString());
    setCarbs(macros.carbs.toString());
    setFat(macros.fat.toString());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSave = async () => {
    const macros: MacroTargets = {
      calories: parseInt(calories) || 0,
      protein: parseInt(protein) || 0,
      carbs: parseInt(carbs) || 0,
      fat: parseInt(fat) || 0,
    };

    await storage.saveMacroTargets(macros);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };

  // Calorie balance
  const p = parseInt(protein) || 0;
  const c = parseInt(carbs) || 0;
  const f = parseInt(fat) || 0;
  const cal = parseInt(calories) || 0;
  const macroTotal = p * 4 + c * 4 + f * 9;
  const hasMacroValues = p > 0 || c > 0 || f > 0;
  const isBalanced = cal > 0 && hasMacroValues && Math.abs(macroTotal - cal) / cal <= 0.05;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.lg,
        }}
      >
        <ThemedText type="h2" style={styles.title}>
          Macro Targets
        </ThemedText>
        <ThemedText type="body" style={styles.subtitle}>
          Customize your daily nutrition goals
        </ThemedText>

        <AnimatedPress
          onPress={handleAutoCalculate}
          style={[styles.autoCalcButton, { backgroundColor: Colors.light.primary + "15" }]}
        >
          <Feather name="cpu" size={16} color={Colors.light.primary} />
          <ThemedText type="small" style={{ color: Colors.light.primary, fontWeight: "600" }}>
            Auto-calculate from profile
          </ThemedText>
        </AnimatedPress>

        {MACRO_CONFIG.map((macro) => {
          const { value, setter } = macroState[macro.key];
          return (
            <View
              key={macro.key}
              style={[styles.macroCard, { backgroundColor: theme.backgroundDefault }]}
            >
              <View style={styles.macroCardHeader}>
                <View style={[styles.macroIcon, { backgroundColor: macro.color + "20" }]}>
                  <Feather name={macro.icon} size={18} color={macro.color} />
                </View>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{macro.label}</ThemedText>
                <ThemedText type="small" style={{ opacity: 0.5, marginLeft: Spacing.xs }}>{macro.suffix}</ThemedText>
              </View>
              <TextInput
                style={[styles.macroInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={value}
                onChangeText={setter}
                keyboardType="number-pad"
                placeholder={macro.placeholder}
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          );
        })}

        {hasMacroValues && cal > 0 ? (
          <View style={[styles.balanceRow, { backgroundColor: theme.backgroundDefault }]}>
            <Feather
              name={isBalanced ? "check-circle" : "alert-circle"}
              size={16}
              color={isBalanced ? Colors.light.success : "#FFA500"}
            />
            <ThemedText type="small" style={{ color: isBalanced ? Colors.light.success : "#FFA500" }}>
              Macro total: {macroTotal} cal {isBalanced ? "(balanced)" : `(target: ${cal})`}
            </ThemedText>
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg, backgroundColor: theme.backgroundRoot, borderTopColor: theme.border }]}>
        <Button onPress={handleSave}>
          Save Targets
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    opacity: 0.6,
    marginBottom: Spacing.lg,
  },
  autoCalcButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xl,
  },
  macroCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
  },
  macroCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  macroIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  macroInput: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 20,
    fontWeight: "600",
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
});
