import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, Platform, Image, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Food } from "@/types";
import { FOOD_DATABASE, FoodDatabaseItem, searchFoods } from "@/lib/foodDatabase";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface APIFoodResult {
  id: string;
  name: string;
  brand: string | null;
  type: string;
  servingSize: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

export default function AddFoodScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  
  const [savedFoods, setSavedFoods] = useState<Food[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<APIFoodResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const [foodImage, setFoodImage] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();
  
  useEffect(() => {
    loadSavedFoods();
  }, []);
  
  // Debounced search - tries API first, falls back to local database
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const url = new URL("/api/foods/search", getApiUrl());
        url.searchParams.set("query", searchQuery.trim());
        
        const response = await fetch(url.toString());
        if (response.ok) {
          const data = await response.json();
          if (data.foods && data.foods.length > 0) {
            setSearchResults(data.foods);
          } else {
            // Fall back to local database if API returns no results
            const localResults = searchFoods(searchQuery).map(f => ({
              id: f.id,
              name: f.name,
              brand: null,
              type: "local",
              servingSize: f.servingSize,
              calories: f.calories,
              fat: f.fat,
              carbs: f.carbs,
              protein: f.protein,
            }));
            setSearchResults(localResults);
          }
        } else {
          // API error - fall back to local database
          const localResults = searchFoods(searchQuery).map(f => ({
            id: f.id,
            name: f.name,
            brand: null,
            type: "local",
            servingSize: f.servingSize,
            calories: f.calories,
            fat: f.fat,
            carbs: f.carbs,
            protein: f.protein,
          }));
          setSearchResults(localResults);
        }
      } catch (error) {
        console.error("Food search error:", error);
        // Network error - fall back to local database
        const localResults = searchFoods(searchQuery).map(f => ({
          id: f.id,
          name: f.name,
          brand: null,
          type: "local",
          servingSize: f.servingSize,
          calories: f.calories,
          fat: f.fat,
          carbs: f.carbs,
          protein: f.protein,
        }));
        setSearchResults(localResults);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);
  
  const loadSavedFoods = async () => {
    const foods = await storage.getSavedFoods();
    setSavedFoods(foods);
  };
  
  const takePhoto = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        if (!result.canAskAgain && Platform.OS !== "web") {
          try {
            await Linking.openSettings();
          } catch (error) {
            console.error("Could not open settings:", error);
          }
        }
        return;
      }
    }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      base64: true,
      exif: false,
    });
    
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFoodImage(asset.uri);
      setShowForm(true);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await analyzePhoto(asset.base64 || null, asset.uri);
    }
  };
  
  const pickImage = async () => {
    if (!mediaPermission?.granted) {
      const result = await requestMediaPermission();
      if (!result.granted) {
        if (!result.canAskAgain && Platform.OS !== "web") {
          try {
            await Linking.openSettings();
          } catch (error) {
            console.error("Could not open settings:", error);
          }
        }
        return;
      }
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      base64: true,
      exif: false,
    });
    
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFoodImage(asset.uri);
      setShowForm(true);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await analyzePhoto(asset.base64 || null, asset.uri);
    }
  };
  
  const analyzePhoto = async (base64: string | null, uri: string) => {
    setIsAnalyzingPhoto(true);
    try {
      const url = new URL("/api/foods/analyze-photo", getApiUrl());
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          imageBase64: base64,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.foods && data.foods.length > 0) {
          let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
          const foodNames: string[] = [];
          for (const food of data.foods) {
            totalCals += food.calories || 0;
            totalProtein += food.protein || 0;
            totalCarbs += food.carbs || 0;
            totalFat += food.fat || 0;
            const label = food.estimatedWeightGrams
              ? `${food.name} (${food.estimatedWeightGrams}g)`
              : food.servingSize
                ? `${food.servingSize} ${food.name}`
                : food.name;
            foodNames.push(label);
          }
          setName(foodNames.join(", "));
          setCalories(Math.round(totalCals).toString());
          setProtein(Math.round(totalProtein).toString());
          setCarbs(Math.round(totalCarbs).toString());
          setFat(Math.round(totalFat).toString());
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } else {
          console.log("Could not identify food:", data.message);
        }
      }
    } catch (error) {
      console.error("Error analyzing photo:", error);
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };
  
  const handleSelectApiFood = (food: APIFoodResult) => {
    setName(food.brand ? `${food.name} (${food.brand})` : food.name);
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
  
  const handleQuickAddApiFood = async (food: APIFoodResult) => {
    const foodEntry: Food = {
      id: uuidv4(),
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
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
          <Pressable onPress={() => {
            setShowForm(false);
            setFoodImage(null);
            setName("");
            setCalories("");
            setProtein("");
            setCarbs("");
            setFat("");
          }}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">Add Food</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        
        {foodImage ? (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: foodImage }} style={styles.imagePreview} />
            {isAnalyzingPhoto ? (
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <ThemedText style={styles.analyzingText}>Identifying food...</ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}
        
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
          
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.light.primary} />
              <ThemedText type="small" style={{ marginLeft: Spacing.sm }}>
                Searching foods...
              </ThemedText>
            </View>
          ) : searchResults.length > 0 ? (
            <View style={styles.searchResultsContainer}>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Search Results
              </ThemedText>
              {searchResults.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleSelectApiFood(item)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginBottom: Spacing.sm })}
                >
                  <Card style={styles.foodCard}>
                    <View style={styles.foodContent}>
                      <View style={styles.foodInfo}>
                        <ThemedText type="body" style={{ fontWeight: "600" }}>
                          {item.name}
                        </ThemedText>
                        {item.brand ? (
                          <ThemedText type="small" style={styles.brandName}>
                            {item.brand}
                          </ThemedText>
                        ) : null}
                        <ThemedText type="small" style={styles.foodMacros}>
                          {item.calories} cal | P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                        </ThemedText>
                        <ThemedText type="small" style={styles.servingSize}>
                          {item.servingSize}
                        </ThemedText>
                      </View>
                      <View style={styles.actionButtons}>
                        <Pressable
                          onPress={() => handleQuickAddApiFood(item)}
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
          ) : searchQuery.length >= 2 ? (
            <View style={styles.noResultsContainer}>
              <ThemedText type="small" style={{ textAlign: "center", opacity: 0.6 }}>
                No foods found for "{searchQuery}"
              </ThemedText>
            </View>
          ) : null}
          
          <View style={styles.addButtonsRow}>
            <Pressable 
              onPress={takePhoto}
              style={[styles.photoButton, { backgroundColor: theme.backgroundElevated }]}
            >
              <Feather name="camera" size={24} color={Colors.light.primary} />
              <ThemedText type="small" style={{ color: theme.text }}>Take Photo</ThemedText>
            </Pressable>
            <Pressable 
              onPress={pickImage}
              style={[styles.photoButton, { backgroundColor: theme.backgroundElevated }]}
            >
              <Feather name="image" size={24} color={Colors.light.primary} />
              <ThemedText type="small" style={{ color: theme.text }}>Pick Photo</ThemedText>
            </Pressable>
          </View>
          
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
          
          {searchQuery.length < 2 && searchResults.length === 0 ? (
            <View style={styles.tipContainer}>
              <Feather name="search" size={48} color={theme.textSecondary} style={{ opacity: 0.5 }} />
              <ThemedText type="body" style={[styles.tipText, { color: theme.textSecondary }]}>
                Search for any food to get nutritional info
              </ThemedText>
              <ThemedText type="small" style={[styles.tipSubtext, { color: theme.textSecondary }]}>
                Powered by FatSecret food database
              </ThemedText>
            </View>
          ) : null}
        </View>
      }
      data={[]}
      keyExtractor={() => "empty"}
      renderItem={() => null}
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
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
  },
  noResultsContainer: {
    paddingVertical: Spacing.xl,
  },
  newFoodButton: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  tipContainer: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    gap: Spacing.md,
  },
  tipText: {
    textAlign: "center",
    fontWeight: "500",
  },
  tipSubtext: {
    textAlign: "center",
    opacity: 0.6,
  },
  brandName: {
    opacity: 0.5,
    fontStyle: "italic",
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
  addButtonsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  photoButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  imagePreviewContainer: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.lg,
    position: "relative",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  analyzingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  analyzingText: {
    color: "#FFFFFF",
    marginTop: Spacing.md,
    fontWeight: "600",
  },
});
