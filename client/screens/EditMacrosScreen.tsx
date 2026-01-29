import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Input } from "@/components/Input";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import type { MacroTargets } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function EditMacrosScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  
  useEffect(() => {
    loadMacros();
    
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton onPress={handleSave}>
          <ThemedText type="link" style={{ fontWeight: "600" }}>Save</ThemedText>
        </HeaderButton>
      ),
    });
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
  
  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <ThemedText type="h2" style={styles.title}>
        Edit Macro Targets
      </ThemedText>
      <ThemedText type="body" style={styles.subtitle}>
        Customize your daily nutrition goals
      </ThemedText>
      
      <Input
        label="Calories"
        placeholder="2000"
        keyboardType="number-pad"
        value={calories}
        onChangeText={setCalories}
      />
      
      <Input
        label="Protein (g)"
        placeholder="150"
        keyboardType="number-pad"
        value={protein}
        onChangeText={setProtein}
      />
      
      <Input
        label="Carbs (g)"
        placeholder="200"
        keyboardType="number-pad"
        value={carbs}
        onChangeText={setCarbs}
      />
      
      <Input
        label="Fat (g)"
        placeholder="60"
        keyboardType="number-pad"
        value={fat}
        onChangeText={setFat}
      />
    </KeyboardAwareScrollViewCompat>
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
    marginBottom: Spacing["2xl"],
  },
});
