import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Pressable, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Food } from "@/types";
import { searchFoods, FoodDatabaseItem, FOOD_DATABASE } from "@/lib/foodDatabase";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type CategoryFilter = "all" | "protein" | "carbs" | "dairy" | "vegetables" | "fruits" | "fats" | "snacks";

export default function AddFoodScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  
  const [savedFoods, setSavedFoods] = useState<Food[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodDatabaseItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  
  useEffect(() => {
    loadSavedFoods();
  }, []);
  
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const results = searchFoods(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);
  
  const loadSavedFoods = async () => {
    const foods = await storage.getSavedFoods();
    setSavedFoods(foods);
  };
  
  const handleSelectDatabaseFood = (food: FoodDatabaseItem) => {
    setName(food.name);
    setCalories(food.calories.toString());
    setProtein(food.protein.toString());
    setCarbs(food.carbs.toString());
    setFat(food.fat.toString());
    setSearchQuery("");
    setSearchResults([]);
    setShowForm(true);
    Haptics.selectionAsync();
  };
  
  const handleQuickAdd = async (food: Food) => {
    const today = new Date().toISOString().split("T")[0];
    await storage.addFoodLogEntry(food, today);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
  };
  
  const handleQuickAddDatabase = async (food: FoodDatabaseItem) => {
    const foodEntry: Food = {
      id: uuidv4(),
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      isSaved: false,
    };
    const today = new Date().toISOString().split("T")[0];
    await storage.addFoodLogEntry(foodEntry, today);
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
  
  const getFilteredDatabaseFoods = () => {
    if (categoryFilter === "all") {
      return FOOD_DATABASE.slice(0, 20);
    }
    return FOOD_DATABASE.filter((f) => f.category === categoryFilter).slice(0, 20);
  };
  
  const renderCategoryFilter = (category: CategoryFilter, label: string) => (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        setCategoryFilter(category);
      }}
      style={[
        styles.filterChip,
        {
          backgroundColor: categoryFilter === category ? Colors.light.primary : theme.backgroundElevated,
        },
      ]}
    >
      <ThemedText
        type="small"
        style={{ color: categoryFilter === category ? "#FFFFFF" : theme.text, fontWeight: "600" }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
  
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
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          <View style={[styles.searchContainer, { backgroundColor: theme.backgroundElevated }]}>
            <Feather name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search foods..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
          
          {searchResults.length > 0 ? (
            <View style={styles.searchResultsContainer}>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Search Results
              </ThemedText>
              {searchResults.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleSelectDatabaseFood(item)}
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
                        <ThemedText type="small" style={styles.servingSize}>
                          {item.servingSize}
                        </ThemedText>
                      </View>
                      <View style={styles.actionButtons}>
                        <Pressable
                          onPress={() => handleQuickAddDatabase(item)}
                          hitSlop={8}
                        >
                          <Feather name="plus-circle" size={24} color={Colors.light.primary} />
                        </Pressable>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          ) : null}
          
          <Button
            onPress={() => setShowForm(true)}
            style={[styles.newFoodButton, { backgroundColor: Colors.light.primary }]}
          >
            Add Custom Food
          </Button>
          
          {savedFoods.length > 0 ? (
            <>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Saved Foods
              </ThemedText>
              {savedFoods.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleQuickAdd(item)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginBottom: Spacing.sm })}
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
              ))}
            </>
          ) : null}
          
          <ThemedText type="h4" style={styles.sectionTitle}>
            Food Database
          </ThemedText>
          
          <View style={styles.filtersContainer}>
            {renderCategoryFilter("all", "All")}
            {renderCategoryFilter("protein", "Protein")}
            {renderCategoryFilter("carbs", "Carbs")}
            {renderCategoryFilter("dairy", "Dairy")}
            {renderCategoryFilter("vegetables", "Veggies")}
            {renderCategoryFilter("fruits", "Fruits")}
            {renderCategoryFilter("fats", "Fats")}
          </View>
        </View>
      }
      data={getFilteredDatabaseFoods()}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => handleSelectDatabaseFood(item)}
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
                <ThemedText type="small" style={styles.servingSize}>
                  {item.servingSize}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => handleQuickAddDatabase(item)}
                hitSlop={8}
              >
                <Feather name="plus-circle" size={24} color={Colors.light.primary} />
              </Pressable>
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchResultsContainer: {
    marginBottom: Spacing.lg,
  },
  newFoodButton: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  filtersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
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
  servingSize: {
    opacity: 0.4,
    marginTop: Spacing.xs,
    fontStyle: "italic",
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
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
