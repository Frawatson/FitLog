import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";
import type {
  UserProfile,
  MacroTargets,
  Exercise,
  Routine,
  Workout,
  BodyWeightEntry,
  Food,
  FoodLogEntry,
  RunEntry,
} from "@/types";
import { getApiUrl } from "@/lib/query-client";

const STORAGE_KEYS = {
  USER_PROFILE: "@fitlog_user_profile",
  MACRO_TARGETS: "@fitlog_macro_targets",
  EXERCISES: "@fitlog_exercises",
  ROUTINES: "@fitlog_routines",
  WORKOUTS: "@fitlog_workouts",
  BODY_WEIGHTS: "@fitlog_body_weights",
  SAVED_FOODS: "@fitlog_saved_foods",
  FOOD_LOG: "@fitlog_food_log",
  RUN_HISTORY: "@fitlog_run_history",
};

// Default exercises
const DEFAULT_EXERCISES: Exercise[] = [
  { id: "1", name: "Squat", muscleGroup: "Legs", isCustom: false },
  { id: "2", name: "Bench Press", muscleGroup: "Chest", isCustom: false },
  { id: "3", name: "Deadlift", muscleGroup: "Back", isCustom: false },
  { id: "4", name: "Barbell Row", muscleGroup: "Back", isCustom: false },
  { id: "5", name: "Lat Pulldown", muscleGroup: "Back", isCustom: false },
  { id: "6", name: "Overhead Press", muscleGroup: "Shoulders", isCustom: false },
  { id: "7", name: "Bicep Curl", muscleGroup: "Arms", isCustom: false },
  { id: "8", name: "Tricep Extension", muscleGroup: "Arms", isCustom: false },
  { id: "9", name: "Leg Press", muscleGroup: "Legs", isCustom: false },
  { id: "10", name: "Romanian Deadlift", muscleGroup: "Legs", isCustom: false },
  { id: "11", name: "Incline DB Press", muscleGroup: "Chest", isCustom: false },
  { id: "12", name: "Dumbbell Fly", muscleGroup: "Chest", isCustom: false },
  { id: "13", name: "Lateral Raise", muscleGroup: "Shoulders", isCustom: false },
  { id: "14", name: "Face Pull", muscleGroup: "Shoulders", isCustom: false },
  { id: "15", name: "Leg Curl", muscleGroup: "Legs", isCustom: false },
  { id: "16", name: "Leg Extension", muscleGroup: "Legs", isCustom: false },
  { id: "17", name: "Calf Raise", muscleGroup: "Legs", isCustom: false },
  { id: "18", name: "Cable Row", muscleGroup: "Back", isCustom: false },
];

// User Profile
export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
}

// Macro Targets
export async function getMacroTargets(): Promise<MacroTargets | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.MACRO_TARGETS);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function saveMacroTargets(targets: MacroTargets): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.MACRO_TARGETS, JSON.stringify(targets));
}

// Calculate macros based on profile
export function calculateMacros(profile: UserProfile): MacroTargets {
  const { weightKg, heightCm, age, sex, goal, activityLevel } = profile;
  
  // Mifflin-St Jeor equation for BMR
  let bmr: number;
  if (sex === "male") {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
  
  // Activity multiplier
  const activityMultiplier = activityLevel === "5-6" ? 1.725 : 1.55;
  let tdee = bmr * activityMultiplier;
  
  // Adjust for goal
  switch (goal) {
    case "lose_fat":
      tdee -= 500;
      break;
    case "gain_muscle":
      tdee += 300;
      break;
    case "recomposition":
      // Slight surplus on training days, deficit on rest - simplified to maintenance
      break;
    case "maintain":
      break;
  }
  
  const calories = Math.round(tdee);
  const protein = Math.round(weightKg * 2); // 2g per kg
  const fat = Math.round((calories * 0.25) / 9); // 25% from fat
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  
  return { calories, protein, carbs, fat };
}

// Exercises
export async function getExercises(): Promise<Exercise[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
    if (data) {
      return JSON.parse(data);
    }
    // Initialize with defaults
    await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(DEFAULT_EXERCISES));
    return DEFAULT_EXERCISES;
  } catch {
    return DEFAULT_EXERCISES;
  }
}

export async function addExercise(name: string, muscleGroup: string): Promise<Exercise> {
  const exercises = await getExercises();
  const newExercise: Exercise = {
    id: uuidv4(),
    name,
    muscleGroup,
    isCustom: true,
  };
  exercises.push(newExercise);
  await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));
  return newExercise;
}

// Routines
export async function getRoutines(): Promise<Routine[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveRoutine(routine: Routine): Promise<void> {
  const routines = await getRoutines();
  const existingIndex = routines.findIndex((r) => r.id === routine.id);
  if (existingIndex >= 0) {
    routines[existingIndex] = routine;
  } else {
    routines.push(routine);
  }
  await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
}

export async function deleteRoutine(routineId: string): Promise<void> {
  const routines = await getRoutines();
  const filtered = routines.filter((r) => r.id !== routineId);
  await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(filtered));
}

// Workouts
export async function getWorkouts(): Promise<Workout[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveWorkout(workout: Workout): Promise<void> {
  const workouts = await getWorkouts();
  const existingIndex = workouts.findIndex((w) => w.id === workout.id);
  if (existingIndex >= 0) {
    workouts[existingIndex] = workout;
  } else {
    workouts.push(workout);
  }
  await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
}

export async function getLastWorkoutForExercise(
  exerciseId: string
): Promise<{ weight: number; reps: number }[] | null> {
  const workouts = await getWorkouts();
  // Sort by date descending
  const sorted = workouts
    .filter((w) => w.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  
  for (const workout of sorted) {
    const exercise = workout.exercises.find((e) => e.exerciseId === exerciseId);
    if (exercise && exercise.sets.length > 0) {
      return exercise.sets.map((s) => ({ weight: s.weight, reps: s.reps }));
    }
  }
  return null;
}

const AUTH_TOKEN_KEY = "@fitlog_auth_token";

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

// Body Weight
export async function getBodyWeights(): Promise<BodyWeightEntry[]> {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    
    if (token) {
      try {
        const response = await fetch(new URL("/api/body-weights", getApiUrl()).toString(), {
          headers: await getAuthHeaders(),
        });
        
        if (response.ok) {
          const serverData = await response.json();
          const entries: BodyWeightEntry[] = serverData.map((item: any) => ({
            id: String(item.id),
            weightKg: item.weightKg,
            date: item.date.split("T")[0],
          }));
          await AsyncStorage.setItem(STORAGE_KEYS.BODY_WEIGHTS, JSON.stringify(entries));
          return entries;
        }
      } catch (e) {
        console.log("Failed to fetch body weights from server, using local data");
      }
    }
    
    const data = await AsyncStorage.getItem(STORAGE_KEYS.BODY_WEIGHTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addBodyWeight(weightKg: number): Promise<BodyWeightEntry> {
  const entries = await getBodyWeightsLocal();
  const today = new Date().toISOString().split("T")[0];
  
  const existingIndex = entries.findIndex((e) => e.date === today);
  let entry: BodyWeightEntry = {
    id: existingIndex >= 0 ? entries[existingIndex].id : uuidv4(),
    weightKg,
    date: today,
  };
  
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  
  if (token) {
    try {
      const response = await fetch(new URL("/api/body-weights", getApiUrl()).toString(), {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ weightKg, date: new Date().toISOString() }),
      });
      
      if (response.ok) {
        const serverEntry = await response.json();
        entry = {
          id: String(serverEntry.id),
          weightKg: serverEntry.weightKg,
          date: serverEntry.date.split("T")[0],
        };
      }
    } catch (e) {
      console.log("Failed to sync body weight to server, saving locally");
    }
  }
  
  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }
  
  await AsyncStorage.setItem(STORAGE_KEYS.BODY_WEIGHTS, JSON.stringify(entries));
  return entry;
}

async function getBodyWeightsLocal(): Promise<BodyWeightEntry[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.BODY_WEIGHTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Saved Foods
export async function getSavedFoods(): Promise<Food[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_FOODS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveFood(food: Omit<Food, "id" | "isSaved">): Promise<Food> {
  const foods = await getSavedFoods();
  const newFood: Food = {
    ...food,
    id: uuidv4(),
    isSaved: true,
  };
  foods.push(newFood);
  await AsyncStorage.setItem(STORAGE_KEYS.SAVED_FOODS, JSON.stringify(foods));
  return newFood;
}

export async function deleteSavedFood(foodId: string): Promise<void> {
  const foods = await getSavedFoods();
  const filtered = foods.filter((f) => f.id !== foodId);
  await AsyncStorage.setItem(STORAGE_KEYS.SAVED_FOODS, JSON.stringify(filtered));
}

// Food Log
export async function getFoodLog(date?: string): Promise<FoodLogEntry[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FOOD_LOG);
    const entries: FoodLogEntry[] = data ? JSON.parse(data) : [];
    if (date) {
      return entries.filter((e) => e.date === date);
    }
    return entries;
  } catch {
    return [];
  }
}

export async function addFoodLogEntry(food: Food, date: string): Promise<FoodLogEntry> {
  const entries = await getFoodLog();
  const entry: FoodLogEntry = {
    id: uuidv4(),
    foodId: food.id,
    food,
    date,
    createdAt: new Date().toISOString(),
  };
  entries.push(entry);
  await AsyncStorage.setItem(STORAGE_KEYS.FOOD_LOG, JSON.stringify(entries));
  return entry;
}

export async function deleteFoodLogEntry(entryId: string): Promise<void> {
  const entries = await getFoodLog();
  const filtered = entries.filter((e) => e.id !== entryId);
  await AsyncStorage.setItem(STORAGE_KEYS.FOOD_LOG, JSON.stringify(filtered));
}

// Get daily totals
export async function getDailyTotals(date: string): Promise<MacroTargets> {
  const entries = await getFoodLog(date);
  return entries.reduce(
    (acc, entry) => ({
      calories: acc.calories + entry.food.calories,
      protein: acc.protein + entry.food.protein,
      carbs: acc.carbs + entry.food.carbs,
      fat: acc.fat + entry.food.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

// Calculate progression suggestion
export function calculateProgression(
  exerciseId: string,
  exerciseName: string,
  lastSets: { weight: number; reps: number; completed: boolean }[]
): { suggestedWeight: number; message: string } {
  if (lastSets.length === 0) {
    return { suggestedWeight: 0, message: "Start with a comfortable weight" };
  }
  
  const completedSets = lastSets.filter((s) => s.completed);
  const failedSets = lastSets.filter((s) => !s.completed);
  const lastWeight = lastSets[0].weight;
  
  // If all sets completed, suggest increase
  if (failedSets.length === 0) {
    const increase = lastWeight >= 50 ? 5 : 2.5;
    return {
      suggestedWeight: lastWeight + increase,
      message: `Great work! Try ${lastWeight + increase} lbs next time`,
    };
  }
  
  // If multiple sets failed, suggest decrease
  if (failedSets.length >= 2) {
    const decrease = lastWeight * 0.05;
    const newWeight = Math.round((lastWeight - decrease) / 2.5) * 2.5;
    return {
      suggestedWeight: newWeight,
      message: `Deload to ${newWeight} lbs and focus on form`,
    };
  }
  
  // Otherwise, keep same weight
  return {
    suggestedWeight: lastWeight,
    message: `Stick with ${lastWeight} lbs until you hit all reps`,
  };
}

// Run History
export async function getRunHistory(): Promise<RunEntry[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.RUN_HISTORY);
    const runs: RunEntry[] = data ? JSON.parse(data) : [];
    return runs.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveRunEntry(run: RunEntry): Promise<void> {
  const runs = await getRunHistory();
  runs.push(run);
  await AsyncStorage.setItem(STORAGE_KEYS.RUN_HISTORY, JSON.stringify(runs));
}

// Clear all data (for logout)
export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
}
