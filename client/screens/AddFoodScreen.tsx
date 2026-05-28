import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, Platform, Image, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeaderButton, useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Food } from "@/types";
import { FOOD_DATABASE, FoodDatabaseItem, searchFoods } from "@/lib/foodDatabase";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";
import { getLocalDateString } from "@/lib/dateUtils";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type AddFoodRouteProp = RouteProp<RootStackParamList, "AddFood">;

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
  const route = useRoute<AddFoodRouteProp>();
  const { theme } = useTheme();

  const prefill = route.params?.prefill;

  const [savedFoods, setSavedFoods] = useState<Food[]>([]);
  const [recentMeals, setRecentMeals] = useState<import("@/types").FoodLogEntry[]>([]);
  const [showForm, setShowForm] = useState(!!prefill);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<APIFoodResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Tracks whether the most recent search fell back to local results
  // because the AI endpoint was unavailable (503 / network), as opposed
  // to "AI ran but returned no matches". Lets the empty / sparse-results
  // UI show the right copy instead of the generic "No foods found".
  const [searchUsedLocalFallback, setSearchUsedLocalFallback] = useState(false);
  const [name, setName] = useState(prefill?.name || "");
  const [calories, setCalories] = useState(prefill?.calories || "");
  const [protein, setProtein] = useState(prefill?.protein || "");
  const [carbs, setCarbs] = useState(prefill?.carbs || "");
  const [fat, setFat] = useState(prefill?.fat || "");
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const [servingSize, setServingSize] = useState<string | undefined>(prefill?.serving);
  const [foodImage, setFoodImage] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<FoodDatabaseItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Per-entry outer bounds — generous enough for huge meals (e.g. a
  // 5000-cal cheat day combo) but rejects typos like "99999".
  const MAX_CAL_PER_ENTRY = 10000;
  const MAX_MACRO_G = 1000;
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameSuggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();
  
  const resetForm = useCallback(() => {
    setShowForm(false);
    setFoodImage(null);
    setPhotoError(null);
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setServingSize(undefined);
    setNameSuggestions([]);
    setShowSuggestions(false);
  }, []);

  useEffect(() => {
    if (showForm) {
      navigation.setOptions({
        headerLeft: () => (
          <HeaderButton onPress={resetForm}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </HeaderButton>
        ),
      });
    } else {
      navigation.setOptions({
        headerLeft: undefined,
      });
    }
  }, [showForm, navigation, theme.text, resetForm]);

  useEffect(() => {
    loadSavedFoods();
    loadRecentMeals();
    return () => {
      if (nameSuggestTimeoutRef.current) clearTimeout(nameSuggestTimeoutRef.current);
    };
  }, []);

  const loadRecentMeals = async () => {
    const meals = await storage.getRecentMeals(5);
    setRecentMeals(meals);
  };

  const handleRelogMeal = async (entry: import("@/types").FoodLogEntry) => {
    const today = getLocalDateString();
    await storage.addFoodLogEntry(entry.food, today, entry.imageUri);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigation.goBack();
  };
  
  // Debounced search - tries API first, falls back to local database
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchUsedLocalFallback(false);
      return;
    }
    
    setIsSearching(true);
    const localFallback = (): APIFoodResult[] => searchFoods(searchQuery).map(f => ({
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
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const url = new URL("/api/foods/search", getApiUrl());
        url.searchParams.set("query", searchQuery.trim());

        const response = await fetch(url.toString(), { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          if (data.foods && data.foods.length > 0) {
            setSearchResults(data.foods);
            setSearchUsedLocalFallback(false);
          } else {
            // AI ran successfully but found no matches — still try local
            // for partial matches, but mark that AI was up.
            setSearchResults(localFallback());
            setSearchUsedLocalFallback(false);
          }
        } else {
          // 503 / other error — AI is down. Fall back to local DB and
          // tell the user so an empty result isn't read as "no food".
          setSearchResults(localFallback());
          setSearchUsedLocalFallback(true);
        }
      } catch (error) {
        console.error("Food search error:", error);
        // Network error — same treatment as 503.
        setSearchResults(localFallback());
        setSearchUsedLocalFallback(true);
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
  
  const compressImage = async (uri: string): Promise<string | null> => {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1536 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      return manipulated.base64 || null;
    } catch (error) {
      console.error("Image compression failed:", error);
      return null;
    }
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
      base64: false,
      exif: false,
    });
    
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFoodImage(asset.uri);
      setShowForm(true);
      setIsAnalyzingPhoto(true);
      setPhotoError(null);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const compressedBase64 = await compressImage(asset.uri);
      await analyzePhoto(compressedBase64, asset.uri);
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
      base64: false,
      exif: false,
    });
    
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFoodImage(asset.uri);
      setShowForm(true);
      setIsAnalyzingPhoto(true);
      setPhotoError(null);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const compressedBase64 = await compressImage(asset.uri);
      await analyzePhoto(compressedBase64, asset.uri);
    }
  };
  
  const analyzePhoto = async (base64: string | null, uri: string) => {
    if (!base64) {
      // compressImage failed — without this branch we sent null to the
      // server, which 400'd back as a generic "Failed to analyze photo".
      setPhotoError("Couldn't process this image. Try a different photo, or enter details manually.");
      setIsAnalyzingPhoto(false);
      return;
    }
    try {
      const url = new URL("/api/foods/analyze-photo", getApiUrl());
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ 
          imageBase64: base64,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.foods && data.foods.length > 0) {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          setIsAnalyzingPhoto(false);
          navigation.navigate("PhotoReview", {
            foods: data.foods,
            imageUri: uri,
            imageBase64: base64 || undefined,
            mode: data.mode,
          });
          resetForm();
          return;
        } else {
          setPhotoError(data.message || "Could not identify food. Please enter details manually.");
        }
      } else {
        const errData = await response.json().catch(() => null);
        setPhotoError(errData?.message || errData?.error || "Failed to analyze photo. Please try again.");
      }
    } catch (error: any) {
      console.error("Error analyzing photo:", error);
      if (error?.name === "AbortError") {
        setPhotoError("Analysis timed out. Please try again with a simpler photo.");
      } else {
        setPhotoError("Network error analyzing photo. Please try again.");
      }
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };
  
  const handleNameChange = (text: string) => {
    setName(text);
    if (submitError) setSubmitError(null);
    // Debounce the local-DB scan — was running on every keystroke,
    // synchronously, with no upper bound on DB growth.
    if (nameSuggestTimeoutRef.current) clearTimeout(nameSuggestTimeoutRef.current);
    if (text.trim().length < 2) {
      setNameSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    nameSuggestTimeoutRef.current = setTimeout(() => {
      const matches = searchFoods(text);
      setNameSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    }, 200);
  };

  const handleSelectSuggestion = (food: FoodDatabaseItem) => {
    setName(food.name);
    setCalories(food.calories.toString());
    setProtein(food.protein.toString());
    setCarbs(food.carbs.toString());
    setFat(food.fat.toString());
    setShowSuggestions(false);
    setNameSuggestions([]);
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
  };

  const handleSelectApiFood = (food: APIFoodResult) => {
    setName(food.brand ? `${food.name} (${food.brand})` : food.name);
    setCalories(food.calories.toString());
    setProtein(food.protein.toString());
    setCarbs(food.carbs.toString());
    setFat(food.fat.toString());
    setServingSize(food.servingSize || undefined);
    setSearchQuery("");
    setSearchResults([]);
    setShowForm(true);
    Haptics.selectionAsync();
  };
  
  const handleQuickAdd = async (food: Food) => {
    const today = getLocalDateString();
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
      ...(food.servingSize ? { serving: food.servingSize } : {}),
    };
    const today = getLocalDateString();
    await storage.addFoodLogEntry(foodEntry, today);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
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

  const handleSubmit = async () => {
    if (!name.trim()) {
      setSubmitError("Please enter a food name.");
      return;
    }
    const cal = parseInt(calories.trim(), 10);
    if (!Number.isFinite(cal) || cal <= 0 || cal > MAX_CAL_PER_ENTRY) {
      setSubmitError(`Calories must be between 1 and ${MAX_CAL_PER_ENTRY}.`);
      return;
    }
    const p = protein.trim() === "" ? 0 : parseInt(protein.trim(), 10);
    const cb = carbs.trim() === "" ? 0 : parseInt(carbs.trim(), 10);
    const f = fat.trim() === "" ? 0 : parseInt(fat.trim(), 10);
    for (const [val, label] of [[p, "Protein"], [cb, "Carbs"], [f, "Fat"]] as const) {
      if (!Number.isFinite(val) || val < 0 || val > MAX_MACRO_G) {
        setSubmitError(`${label} must be between 0 and ${MAX_MACRO_G}g.`);
        return;
      }
    }
    setSubmitError(null);

    const food: Food = {
      id: uuidv4(),
      name: name.trim(),
      calories: cal,
      protein: p,
      carbs: cb,
      fat: f,
      isSaved: saveAsFavorite,
      ...(servingSize ? { serving: servingSize } : {}),
    };
    
    if (saveAsFavorite) {
      await storage.saveFood({
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        ...(food.serving ? { serving: food.serving } : {}),
      });
    }
    
    let persistentImageUri: string | undefined;
    if (foodImage) {
      persistentImageUri = await createPersistentImageUri(foodImage);
    }
    
    const today = getLocalDateString();
    await storage.addFoodLogEntry(food, today, persistentImageUri);
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
        {foodImage ? (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: foodImage }} style={styles.imagePreview} />
            {isAnalyzingPhoto ? (
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <ThemedText style={styles.analyzingText}>Analyzing your food...</ThemedText>
                <ThemedText style={styles.analyzingSubtext}>This usually takes 5-10 seconds</ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}
        
        {photoError ? (
          <ThemedText style={styles.photoErrorText}>{photoError}</ThemedText>
        ) : null}
        
        <View style={{ zIndex: 10 }}>
          <Input
            label="Food Name"
            placeholder="e.g., Chicken Breast"
            value={name}
            onChangeText={handleNameChange}
            // Close suggestions on blur, with a small delay so a tap on
            // a suggestion (which also blurs the input) can land before
            // the dropdown unmounts.
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            testID="input-food-name"
          />
          {showSuggestions ? (
            <View style={[styles.suggestionsDropdown, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              {nameSuggestions.map((item) => (
                <AnimatedPress
                  key={item.id}
                  onPress={() => handleSelectSuggestion(item)}
                  style={[
                    styles.suggestionItem,
                    { borderBottomColor: theme.border },
                  ]}
                  testID={`suggestion-${item.id}`}
                >
                  <ThemedText type="body" style={{ fontWeight: "500" }}>{item.name}</ThemedText>
                  <ThemedText type="small" style={{ opacity: 0.6 }}>
                    {item.calories} cal | P: {item.protein}g | C: {item.carbs}g | F: {item.fat}g
                  </ThemedText>
                </AnimatedPress>
              ))}
            </View>
          ) : null}
        </View>
        
        <Input
          label="Calories"
          placeholder="0"
          keyboardType="number-pad"
          value={calories}
          onChangeText={(t) => { setCalories(t); if (submitError) setSubmitError(null); }}
        />

        <View style={styles.macroRow}>
          <View style={styles.macroInput}>
            <Input
              label="Protein (g)"
              placeholder="0"
              keyboardType="number-pad"
              value={protein}
              onChangeText={(t) => { setProtein(t); if (submitError) setSubmitError(null); }}
            />
          </View>
          <View style={styles.macroInput}>
            <Input
              label="Carbs (g)"
              placeholder="0"
              keyboardType="number-pad"
              value={carbs}
              onChangeText={(t) => { setCarbs(t); if (submitError) setSubmitError(null); }}
            />
          </View>
          <View style={styles.macroInput}>
            <Input
              label="Fat (g)"
              placeholder="0"
              keyboardType="number-pad"
              value={fat}
              onChangeText={(t) => { setFat(t); if (submitError) setSubmitError(null); }}
            />
          </View>
        </View>
        
        <AnimatedPress
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
        </AnimatedPress>
        
        {submitError ? (
          <View style={styles.submitErrorContainer}>
            <Feather name="alert-circle" size={16} color={Colors.light.error} />
            <ThemedText type="small" style={{ color: Colors.light.error, flex: 1 }}>
              {submitError}
            </ThemedText>
          </View>
        ) : null}

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
              {searchUsedLocalFallback ? (
                <ThemedText type="small" style={{ opacity: 0.6, marginBottom: Spacing.sm }}>
                  AI search is offline — showing local results only.
                </ThemedText>
              ) : null}
              {searchResults.map((item) => (
                <Card
                  key={item.id}
                  onPress={() => handleSelectApiFood(item)}
                  style={[styles.foodCard, { marginBottom: Spacing.sm }]}
                >
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
                    <Pressable
                      onPress={() => handleQuickAddApiFood(item)}
                      hitSlop={8}
                    >
                      <Feather name="plus-circle" size={24} color={Colors.light.primary} />
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          ) : searchQuery.length >= 2 ? (
            <View style={styles.noResultsContainer}>
              <ThemedText type="small" style={{ textAlign: "center", opacity: 0.6 }}>
                {searchUsedLocalFallback
                  ? `AI search is offline and no local matches for "${searchQuery}". Try Custom Food.`
                  : `No foods found for "${searchQuery}"`}
              </ThemedText>
            </View>
          ) : null}
          
          <View style={styles.addButtonsRow}>
            <AnimatedPress
              onPress={takePhoto}
              style={[styles.photoButton, { backgroundColor: theme.backgroundElevated }]}
            >
              <Feather name="camera" size={24} color={Colors.light.primary} />
              <ThemedText type="small" style={{ color: theme.text }}>Take Photo</ThemedText>
            </AnimatedPress>
            <AnimatedPress
              onPress={pickImage}
              style={[styles.photoButton, { backgroundColor: theme.backgroundElevated }]}
            >
              <Feather name="image" size={24} color={Colors.light.primary} />
              <ThemedText type="small" style={{ color: theme.text }}>Pick Photo</ThemedText>
            </AnimatedPress>
            <AnimatedPress
              onPress={() => navigation.navigate("BarcodeScanner")}
              style={[styles.photoButton, { backgroundColor: theme.backgroundElevated }]}
            >
              <Feather name="maximize" size={24} color={Colors.light.primary} />
              <ThemedText type="small" style={{ color: theme.text }}>Scan Barcode</ThemedText>
            </AnimatedPress>
          </View>
          
          <Button
            onPress={() => setShowForm(true)}
            style={[styles.newFoodButton, { backgroundColor: Colors.light.primary }]}
          >
            Add Custom Food
          </Button>

          {recentMeals.length > 0 ? (
            <>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Recent Meals
              </ThemedText>
              {recentMeals.map((entry) => (
                <Card
                  key={entry.id}
                  onPress={() => handleRelogMeal(entry)}
                  style={[styles.foodCard, { marginBottom: Spacing.sm }]}
                >
                  <View style={styles.foodContent}>
                    {entry.imageUri ? (
                      <Image
                        source={{ uri: entry.imageUri }}
                        style={styles.recentMealThumb}
                      />
                    ) : null}
                    <View style={styles.foodInfo}>
                      <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
                        {entry.food.name}
                      </ThemedText>
                      <ThemedText type="small" style={styles.foodMacros}>
                        {entry.food.calories} cal | P: {entry.food.protein}g | C: {entry.food.carbs}g | F: {entry.food.fat}g
                      </ThemedText>
                      <ThemedText type="small" style={{ opacity: 0.4, marginTop: 2 }}>
                        {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </ThemedText>
                    </View>
                    <Feather name="refresh-cw" size={20} color={Colors.light.primary} />
                  </View>
                </Card>
              ))}
            </>
          ) : null}
          
          {savedFoods.length > 0 ? (
            <>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Saved Foods
              </ThemedText>
              {savedFoods.map((item) => (
                <Card
                  key={item.id}
                  onPress={() => handleQuickAdd(item)}
                  style={[styles.foodCard, { marginBottom: Spacing.sm }]}
                >
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
                AI-powered nutrition data
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
  submitErrorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.light.error + "15",
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  recentMealThumb: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
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
  analyzingSubtext: {
    color: "rgba(255,255,255,0.7)",
    marginTop: Spacing.xs,
    fontSize: 13,
  },
  photoErrorText: {
    color: "#FF3B30",
    fontSize: 14,
    textAlign: "center" as const,
    marginBottom: Spacing.md,
  },
  suggestionsDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    maxHeight: 200,
    overflow: "hidden",
  },
  suggestionItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
});
