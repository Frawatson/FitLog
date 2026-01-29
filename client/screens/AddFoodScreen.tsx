import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Food } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AddFoodScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  
  const [savedFoods, setSavedFoods] = useState<Food[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  
  useEffect(() => {
    loadSavedFoods();
  }, []);
  
  const loadSavedFoods = async () => {
    const foods = await storage.getSavedFoods();
    setSavedFoods(foods);
  };
  
  const handleQuickAdd = async (food: Food) => {
    const today = new Date().toISOString().split("T")[0];
    await storage.addFoodLogEntry(food, today);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
  };
  
  const handleSubmit = async () => {
    if (!name.trim() || !calories) {
      return;
    }
    
    const food: Food = {
      id: uuidv4(),
      name: name.trim(),
      calories: parseInt(calories) || 0,
      protein: parseInt(protein) || 0,
      carbs: parseInt(carbs) || 0,
      fat: parseInt(fat) || 0,
      isSaved: saveAsFavorite,
    };
    
    if (saveAsFavorite) {
      await storage.saveFood({
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      });
    }
    
    const today = new Date().toISOString().split("T")[0];
    await storage.addFoodLogEntry(food, today);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };
  
  if (showForm) {
    return (
      <KeyboardAwareScrollViewCompat
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => setShowForm(false)}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">Add Food</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        
        <Input
          label="Food Name"
          placeholder="e.g., Chicken Breast"
          value={name}
          onChangeText={setName}
        />
        
        <Input
          label="Calories"
          placeholder="0"
          keyboardType="number-pad"
          value={calories}
          onChangeText={setCalories}
        />
        
        <View style={styles.macroRow}>
          <View style={styles.macroInput}>
            <Input
              label="Protein (g)"
              placeholder="0"
              keyboardType="number-pad"
              value={protein}
              onChangeText={setProtein}
            />
          </View>
          <View style={styles.macroInput}>
            <Input
              label="Carbs (g)"
              placeholder="0"
              keyboardType="number-pad"
              value={carbs}
              onChangeText={setCarbs}
            />
          </View>
          <View style={styles.macroInput}>
            <Input
              label="Fat (g)"
              placeholder="0"
              keyboardType="number-pad"
              value={fat}
              onChangeText={setFat}
            />
          </View>
        </View>
        
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setSaveAsFavorite(!saveAsFavorite);
          }}
          style={styles.favoriteToggle}
        >
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: saveAsFavorite ? Colors.light.primary : "transparent",
                borderColor: saveAsFavorite ? Colors.light.primary : theme.border,
              },
            ]}
          >
            {saveAsFavorite ? (
              <Feather name="check" size={16} color="#FFFFFF" />
            ) : null}
          </View>
          <ThemedText type="body">Save to favorites</ThemedText>
        </Pressable>
        
        <Button onPress={handleSubmit} style={styles.submitButton}>
          Add to Log
        </Button>
      </KeyboardAwareScrollViewCompat>
    );
  }
  
  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      ListHeaderComponent={
        <View>
          <Button
            onPress={() => setShowForm(true)}
            style={[styles.newFoodButton, { backgroundColor: Colors.light.primary }]}
          >
            Add Custom Food
          </Button>
          
          {savedFoods.length > 0 ? (
            <ThemedText type="h4" style={styles.sectionTitle}>
              Saved Foods
            </ThemedText>
          ) : null}
        </View>
      }
      data={savedFoods}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => handleQuickAdd(item)}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Card style={styles.foodCard}>
            <View style={styles.foodContent}>
              <View style={styles.foodInfo}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {item.name}
                </ThemedText>
                <ThemedText type="small" style={styles.foodMacros}>
                  {item.calories} cal | P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                </ThemedText>
              </View>
              <Feather name="plus-circle" size={24} color={Colors.light.primary} />
            </View>
          </Card>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  newFoodButton: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  foodCard: {
    padding: Spacing.lg,
  },
  foodContent: {
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
  macroRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  macroInput: {
    flex: 1,
  },
  favoriteToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
});
