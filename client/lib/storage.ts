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
import {
  syncToServer,
  syncWithRetry,
  isAuthenticated,
  initSyncService,
  getPendingSyncItems,
  clearSyncQueue,
  addToSyncQueue,
} from "@/lib/syncService";
import { AUTH_TOKEN_KEY } from "@/lib/authStorage";
import { activityDay, getLocalDateString } from "@/lib/dateUtils";
import { getZoneForHeartRate } from "@/lib/heartRateZones";
import { clearScheduledNotifications } from "@/lib/notifications";

export { initSyncService };

const STORAGE_KEYS = {
  USER_PROFILE: "@merge_user_profile",
  MACRO_TARGETS: "@merge_macro_targets",
  EXERCISES: "@merge_exercises",
  ROUTINES: "@merge_routines",
  WORKOUTS: "@merge_workouts",
  BODY_WEIGHTS: "@merge_body_weights",
  SAVED_FOODS: "@merge_saved_foods",
  FOOD_LOG: "@merge_food_log",
  RUN_HISTORY: "@merge_run_history",
  POST_DRAFT: "@merge_post_draft",
};

// Local-only draft so a user who navigates away mid-compose doesn't lose
// what they typed. Cleared on successful post. Photos + reference links
// aren't persisted — base64 images would bloat AsyncStorage and references
// can re-pick on return.
export interface PostDraft {
  content: string;
  postType: import("@/types").PostType;
  visibility: import("@/types").PostVisibility;
}

export async function getPostDraft(): Promise<PostDraft | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.POST_DRAFT);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function savePostDraft(draft: PostDraft): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.POST_DRAFT, JSON.stringify(draft));
}

export async function clearPostDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.POST_DRAFT);
}

// Default exercises — names match ExerciseDB for guaranteed GIF lookup
const DEFAULT_EXERCISES: Exercise[] = [
  { id: "1", name: "barbell full squat", muscleGroup: "Legs", isCustom: false },
  {
    id: "2",
    name: "barbell bench press",
    muscleGroup: "Chest",
    isCustom: false,
  },
  { id: "3", name: "barbell deadlift", muscleGroup: "Back", isCustom: false },
  {
    id: "4",
    name: "barbell bent over row",
    muscleGroup: "Back",
    isCustom: false,
  },
  {
    id: "5",
    name: "cable lat pulldown full range of motion",
    muscleGroup: "Back",
    isCustom: false,
  },
  {
    id: "6",
    name: "barbell seated overhead press",
    muscleGroup: "Shoulders",
    isCustom: false,
  },
  { id: "7", name: "barbell curl", muscleGroup: "Arms", isCustom: false },
  { id: "8", name: "cable pushdown", muscleGroup: "Arms", isCustom: false },
  {
    id: "9",
    name: "sled 45 degrees leg press",
    muscleGroup: "Legs",
    isCustom: false,
  },
  {
    id: "10",
    name: "barbell romanian deadlift",
    muscleGroup: "Legs",
    isCustom: false,
  },
  {
    id: "11",
    name: "dumbbell incline bench press",
    muscleGroup: "Chest",
    isCustom: false,
  },
  { id: "12", name: "dumbbell fly", muscleGroup: "Chest", isCustom: false },
  {
    id: "13",
    name: "dumbbell lateral raise",
    muscleGroup: "Shoulders",
    isCustom: false,
  },
  {
    id: "14",
    name: "cable rear delt row (with rope)",
    muscleGroup: "Shoulders",
    isCustom: false,
  },
  {
    id: "15",
    name: "lever lying leg curl",
    muscleGroup: "Legs",
    isCustom: false,
  },
  {
    id: "16",
    name: "lever leg extension",
    muscleGroup: "Legs",
    isCustom: false,
  },
  {
    id: "17",
    name: "barbell standing calf raise",
    muscleGroup: "Legs",
    isCustom: false,
  },
  { id: "18", name: "cable seated row", muscleGroup: "Back", isCustom: false },
];

// ── Request de-duplication / micro-cache ─────────────────────────────
// Screens re-fetch on every focus, so a single tab switch used to fire
// the same collection GETs several times in a burst (Dashboard alone:
// ~10). A 15s in-memory TTL + in-flight promise sharing absorbs those
// bursts without changing any screen code. Writes invalidate their
// collection, so saves still read fresh.
const memCache = new Map<string, { at: number; promise: Promise<any> }>();
const MEM_TTL_MS = 15_000;

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = memCache.get(key);
  if (hit && Date.now() - hit.at < MEM_TTL_MS) {
    return hit.promise as Promise<T>;
  }
  const promise = fn().catch((e) => {
    memCache.delete(key);
    throw e;
  });
  memCache.set(key, { at: Date.now(), promise });
  return promise;
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    memCache.clear();
    return;
  }
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key);
  }
}

// Serializes read-modify-write cycles on the FOOD_LOG key. Parallel
// getFoodLog calls for different dates (ProgressCharts fires 7 at once)
// each read-merge-write the same key; unserialized, later writers
// clobber earlier ones (lost updates).
let foodLogWriteChain: Promise<unknown> = Promise.resolve();
function serializeFoodLogWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = foodLogWriteChain.then(fn, fn);
  foodLogWriteChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

// Reconcile a server list response with the local cache instead of
// blindly replacing it. Three rules:
//   1. A local item with a write still waiting in the sync queue beats
//      the server copy (the server hasn't seen that write yet — without
//      this, anything saved offline visually vanished on the next fetch
//      until the queue flushed).
//   2. With `unionLocal`, local items missing from the server response
//      are kept. Used for append-mostly history (workouts, runs) where
//      the server caps list responses at 100 rows — the old overwrite
//      actively deleted local history past that cap.
//   3. A local item with a pending DELETE is dropped even if the server
//      still returns it.
async function mergeServerList<T extends { id: string }>(
  serverItems: T[],
  localItems: T[],
  endpoint: string,
  opts?: {
    unionLocal?: boolean;
    getUpsertId?: (data: any) => string | undefined;
  },
): Promise<T[]> {
  const pending = await getPendingSyncItems();
  const getId = opts?.getUpsertId ?? ((d: any) => d?.clientId);

  const pendingUpsertIds = new Set<string>();
  const pendingDeleteIds = new Set<string>();
  for (const item of pending) {
    if (
      item.endpoint === endpoint &&
      (item.method === "POST" || item.method === "PUT")
    ) {
      const id = getId(item.data);
      if (id) pendingUpsertIds.add(id);
    } else if (
      item.method === "DELETE" &&
      item.endpoint.startsWith(endpoint + "/")
    ) {
      pendingDeleteIds.add(item.endpoint.slice(endpoint.length + 1));
    }
  }

  const byId = new Map<string, T>(serverItems.map((i) => [i.id, i]));
  for (const local of localItems) {
    if (
      pendingUpsertIds.has(local.id) ||
      (opts?.unionLocal && !byId.has(local.id))
    ) {
      byId.set(local.id, local);
    }
  }
  for (const id of pendingDeleteIds) {
    byId.delete(id);
  }
  return [...byId.values()];
}

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
  await AsyncStorage.setItem(
    STORAGE_KEYS.USER_PROFILE,
    JSON.stringify(profile),
  );
}

// Macro Targets
export function getMacroTargets(): Promise<MacroTargets | null> {
  return cached("macro-targets", getMacroTargetsImpl);
}

async function getMacroTargetsImpl(): Promise<MacroTargets | null> {
  try {
    if (await isAuthenticated()) {
      const result = await syncToServer<MacroTargets>(
        "/api/macro-targets",
        "GET",
      );
      if (result.success && result.data) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.MACRO_TARGETS,
          JSON.stringify(result.data),
        );
        return result.data;
      }
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.MACRO_TARGETS);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function saveMacroTargets(targets: MacroTargets): Promise<void> {
  invalidateCache("macro-targets");
  await AsyncStorage.setItem(
    STORAGE_KEYS.MACRO_TARGETS,
    JSON.stringify(targets),
  );

  if (await isAuthenticated()) {
    await syncWithRetry("/api/macro-targets", "POST", targets);
  }
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
export function getExercises(): Promise<Exercise[]> {
  return cached("exercises", getExercisesImpl);
}

async function getExercisesImpl(): Promise<Exercise[]> {
  try {
    if (await isAuthenticated()) {
      const result = await syncToServer<any[]>("/api/custom-exercises", "GET");
      if (result.success && result.data) {
        const serverCustom: Exercise[] = result.data.map((e) => ({
          id: e.clientId,
          name: e.name,
          muscleGroup: e.muscleGroup,
          isCustom: true,
        }));
        const localData = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
        const localCustom: Exercise[] = (
          localData ? JSON.parse(localData) : []
        ).filter((e: Exercise) => e.isCustom);
        const customExercises = await mergeServerList(
          serverCustom,
          localCustom,
          "/api/custom-exercises",
        );
        const allExercises = [...DEFAULT_EXERCISES, ...customExercises];
        await AsyncStorage.setItem(
          STORAGE_KEYS.EXERCISES,
          JSON.stringify(allExercises),
        );
        return allExercises;
      }
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISES);
    if (data) {
      return JSON.parse(data);
    }
    await AsyncStorage.setItem(
      STORAGE_KEYS.EXERCISES,
      JSON.stringify(DEFAULT_EXERCISES),
    );
    return DEFAULT_EXERCISES;
  } catch {
    return DEFAULT_EXERCISES;
  }
}

export async function addExercise(
  name: string,
  muscleGroup: string,
): Promise<Exercise> {
  invalidateCache("exercises");
  const exercises = await getExercises();
  const newExercise: Exercise = {
    id: uuidv4(),
    name,
    muscleGroup,
    isCustom: true,
  };
  exercises.push(newExercise);
  await AsyncStorage.setItem(STORAGE_KEYS.EXERCISES, JSON.stringify(exercises));

  if (await isAuthenticated()) {
    await syncWithRetry("/api/custom-exercises", "POST", {
      clientId: newExercise.id,
      name: newExercise.name,
      muscleGroup: newExercise.muscleGroup,
      isCustom: true,
    });
  }
  return newExercise;
}

// Routines
export function getRoutines(): Promise<Routine[]> {
  return cached("routines", getRoutinesImpl);
}

async function getRoutinesImpl(): Promise<Routine[]> {
  try {
    if (await isAuthenticated()) {
      const result = await syncToServer<any[]>("/api/routines", "GET");
      if (result.success && result.data) {
        const serverRoutines: Routine[] = result.data.map((r) => ({
          id: r.clientId,
          name: r.name,
          exercises: r.exercises,
          createdAt: r.createdAt,
          lastCompletedAt: r.lastCompletedAt,
          isFavorite: r.isFavorite,
          category: r.category,
        }));
        const routines = await mergeServerList(
          serverRoutines,
          await getRoutinesLocal(),
          "/api/routines",
        );
        await AsyncStorage.setItem(
          STORAGE_KEYS.ROUTINES,
          JSON.stringify(routines),
        );
        return routines;
      }
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function getRoutinesLocal(): Promise<Routine[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveRoutine(routine: Routine): Promise<void> {
  invalidateCache("routines");
  const routines = await getRoutinesLocal();
  const existingIndex = routines.findIndex((r) => r.id === routine.id);
  if (existingIndex >= 0) {
    routines[existingIndex] = routine;
  } else {
    routines.push(routine);
  }
  await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));

  if (await isAuthenticated()) {
    await syncWithRetry("/api/routines", "POST", {
      clientId: routine.id,
      name: routine.name,
      exercises: routine.exercises,
      createdAt: routine.createdAt,
      lastCompletedAt: routine.lastCompletedAt,
      isFavorite: routine.isFavorite,
      category: routine.category,
    });
  }
}

export async function deleteRoutine(routineId: string): Promise<void> {
  invalidateCache("routines");
  const routines = await getRoutinesLocal();
  const filtered = routines.filter((r) => r.id !== routineId);
  await AsyncStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(filtered));

  if (await isAuthenticated()) {
    await syncWithRetry(`/api/routines/${routineId}`, "DELETE", {});
  }
}

// Workouts
export function getWorkouts(): Promise<Workout[]> {
  return cached("workouts", getWorkoutsImpl);
}

async function getWorkoutsImpl(): Promise<Workout[]> {
  try {
    if (await isAuthenticated()) {
      const result = await syncToServer<any[]>("/api/workouts", "GET");
      if (result.success && result.data) {
        const serverWorkouts: Workout[] = result.data.map((w) => ({
          id: w.clientId,
          routineId: w.routineId,
          routineName: w.routineName,
          exercises: w.exercises,
          startedAt: w.startedAt,
          completedAt: w.completedAt,
          durationMinutes: w.durationMinutes,
          notes: w.notes,
          totalVolumeKg: w.totalVolumeKg,
        }));
        // unionLocal: the server returns at most 100 workouts, so local
        // history older than that must survive the merge.
        const workouts = await mergeServerList(
          serverWorkouts,
          await getWorkoutsLocal(),
          "/api/workouts",
          { unionLocal: true },
        );
        await AsyncStorage.setItem(
          STORAGE_KEYS.WORKOUTS,
          JSON.stringify(workouts),
        );
        return workouts;
      }
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function getWorkoutsLocal(): Promise<Workout[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveWorkout(workout: Workout): Promise<void> {
  invalidateCache("workouts");
  const workouts = await getWorkoutsLocal();
  const existingIndex = workouts.findIndex((w) => w.id === workout.id);
  if (existingIndex >= 0) {
    workouts[existingIndex] = workout;
  } else {
    workouts.push(workout);
  }
  await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));

  if (await isAuthenticated()) {
    await syncWithRetry("/api/workouts", "POST", {
      clientId: workout.id,
      routineId: workout.routineId,
      routineName: workout.routineName,
      exercises: workout.exercises,
      startedAt: workout.startedAt,
      completedAt: workout.completedAt,
      activityDate: activityDay(workout),
      durationMinutes: workout.durationMinutes,
      notes: workout.notes,
      totalVolumeKg: workout.totalVolumeKg,
    });
  }
}

export async function getLastWorkoutForExercise(
  exerciseId: string,
): Promise<{ weight: number; reps: number }[] | null> {
  const workouts = await getWorkouts();
  // Sort by date descending
  const sorted = workouts
    .filter((w) => w.completedAt)
    .sort(
      (a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
    );

  for (const workout of sorted) {
    const exercise = workout.exercises.find((e) => e.exerciseId === exerciseId);
    if (exercise && exercise.sets.length > 0) {
      return exercise.sets.map((s) => ({ weight: s.weight, reps: s.reps }));
    }
  }
  return null;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

// Body Weight
export function getBodyWeights(): Promise<BodyWeightEntry[]> {
  return cached("body-weights", getBodyWeightsImpl);
}

async function getBodyWeightsImpl(): Promise<BodyWeightEntry[]> {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

    if (token) {
      try {
        const response = await fetch(
          new URL("/api/body-weights", getApiUrl()).toString(),
          {
            headers: await getAuthHeaders(),
          },
        );

        if (response.ok) {
          const serverData = await response.json();
          const serverEntries: BodyWeightEntry[] = serverData.map(
            (item: any) => ({
              id: String(item.id),
              weightKg: item.weightKg,
              date: item.date.split("T")[0],
            }),
          );
          // Keep local entries whose POST is still queued (matched by
          // date — body weights are one-per-day and offline entries have
          // client-generated ids the server doesn't know).
          const pendingDates = new Set(
            (await getPendingSyncItems())
              .filter(
                (i) =>
                  i.endpoint === "/api/body-weights" && i.method === "POST",
              )
              .map((i) => i.data?.date)
              .filter(Boolean),
          );
          const local = await getBodyWeightsLocal();
          const byDate = new Map(serverEntries.map((e) => [e.date, e]));
          for (const le of local) {
            if (pendingDates.has(le.date)) byDate.set(le.date, le);
          }
          const entries = [...byDate.values()];
          await AsyncStorage.setItem(
            STORAGE_KEYS.BODY_WEIGHTS,
            JSON.stringify(entries),
          );
          return entries;
        }
      } catch (e) {
        console.log(
          "Failed to fetch body weights from server, using local data",
        );
      }
    }

    const data = await AsyncStorage.getItem(STORAGE_KEYS.BODY_WEIGHTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addBodyWeight(
  weightKg: number,
): Promise<BodyWeightEntry> {
  invalidateCache("body-weights");
  const entries = await getBodyWeightsLocal();
  const today = getLocalDateString();

  const existingIndex = entries.findIndex((e) => e.date === today);
  let entry: BodyWeightEntry = {
    id: existingIndex >= 0 ? entries[existingIndex].id : uuidv4(),
    weightKg,
    date: today,
  };

  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

  if (token) {
    try {
      const response = await fetch(
        new URL("/api/body-weights", getApiUrl()).toString(),
        {
          method: "POST",
          headers: await getAuthHeaders(),
          // Local YYYY-MM-DD, not UTC instant — without this a user in
          // UTC-7 logging at 9pm would shift to the next day on the
          // server, "disappearing" today's entry and creating a phantom
          // tomorrow entry on the next fetch.
          body: JSON.stringify({ weightKg, date: today }),
        },
      );

      if (response.ok) {
        const serverEntry = await response.json();
        entry = {
          id: String(serverEntry.id),
          weightKg: serverEntry.weightKg,
          date: serverEntry.date.split("T")[0],
        };
      } else if (response.status >= 500 || response.status === 429) {
        await addToSyncQueue("/api/body-weights", "POST", {
          weightKg,
          date: today,
        });
      }
    } catch (e) {
      // Network failure — queue it instead of silently never syncing.
      await addToSyncQueue("/api/body-weights", "POST", {
        weightKg,
        date: today,
      });
    }
  }

  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  await AsyncStorage.setItem(
    STORAGE_KEYS.BODY_WEIGHTS,
    JSON.stringify(entries),
  );
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

export async function deleteBodyWeight(id: string): Promise<void> {
  invalidateCache("body-weights");
  const entries = await getBodyWeightsLocal();
  const filtered = entries.filter((e) => e.id !== id);
  await AsyncStorage.setItem(
    STORAGE_KEYS.BODY_WEIGHTS,
    JSON.stringify(filtered),
  );

  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    try {
      await fetch(new URL(`/api/body-weights/${id}`, getApiUrl()).toString(), {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });
    } catch (e) {
      // Network failure — queue the delete so it isn't resurrected by
      // the next server fetch.
      await addToSyncQueue(`/api/body-weights/${id}`, "DELETE", {});
    }
  }
}

// Saved Foods
export function getSavedFoods(): Promise<Food[]> {
  return cached("saved-foods", getSavedFoodsImpl);
}

async function getSavedFoodsImpl(): Promise<Food[]> {
  try {
    if (await isAuthenticated()) {
      const result = await syncToServer<any[]>("/api/saved-foods", "GET");
      if (result.success && result.data) {
        const serverFoods: Food[] = result.data.map((f) => ({
          id: f.id,
          name: f.name,
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
          isSaved: true,
        }));
        const localData = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_FOODS);
        const foods = await mergeServerList(
          serverFoods,
          (localData ? JSON.parse(localData) : []) as Food[],
          "/api/saved-foods",
          // saveFood posts { food: {...} }, not { clientId }.
          { getUpsertId: (d) => d?.food?.id },
        );
        await AsyncStorage.setItem(
          STORAGE_KEYS.SAVED_FOODS,
          JSON.stringify(foods),
        );
        return foods;
      }
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_FOODS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveFood(
  food: Omit<Food, "id" | "isSaved">,
): Promise<Food> {
  invalidateCache("saved-foods");
  const foods = await getSavedFoods();
  const newFood: Food = {
    ...food,
    id: uuidv4(),
    isSaved: true,
  };
  foods.push(newFood);
  await AsyncStorage.setItem(STORAGE_KEYS.SAVED_FOODS, JSON.stringify(foods));

  if (await isAuthenticated()) {
    await syncWithRetry("/api/saved-foods", "POST", { food: newFood });
  }
  return newFood;
}

export async function deleteSavedFood(foodId: string): Promise<void> {
  invalidateCache("saved-foods");
  const foods = await getSavedFoods();
  const filtered = foods.filter((f) => f.id !== foodId);
  await AsyncStorage.setItem(
    STORAGE_KEYS.SAVED_FOODS,
    JSON.stringify(filtered),
  );

  if (await isAuthenticated()) {
    await syncWithRetry("/api/saved-foods/" + foodId, "DELETE", {});
  }
}

// Food Log.
// `filter` accepts either a single YYYY-MM-DD string (legacy single-day
// callers) or a { start, end } range (NutritionScreen week/month views).
// The range form lets the server filter by date instead of streaming the
// whole history for client-side filtering.
export function getFoodLog(
  filter?: string | { start: string; end: string },
): Promise<FoodLogEntry[]> {
  const key =
    "food-log:" +
    (typeof filter === "string"
      ? filter
      : filter
        ? `${filter.start}_${filter.end}`
        : "all");
  return cached(key, () => getFoodLogImpl(filter));
}

async function getFoodLogImpl(
  filter?: string | { start: string; end: string },
): Promise<FoodLogEntry[]> {
  try {
    if (await isAuthenticated()) {
      let endpoint = "/api/food-logs";
      if (typeof filter === "string") {
        endpoint = `/api/food-logs?date=${filter}`;
      } else if (filter && filter.start && filter.end) {
        endpoint = `/api/food-logs?start=${filter.start}&end=${filter.end}`;
      }
      const result = await syncToServer<any[]>(endpoint, "GET");
      if (result.success && result.data) {
        const serverRows = result.data;
        // The whole read-merge-write below runs under the food-log write
        // lock — see serializeFoodLogWrite.
        return await serializeFoodLogWrite(async () => {
          const localEntries = await getFoodLogLocal();
          // Entries with a DELETE still queued must not be resurrected by
          // the server copy.
          const pendingDeletes = new Set(
            (await getPendingSyncItems())
              .filter(
                (i) =>
                  i.method === "DELETE" &&
                  i.endpoint.startsWith("/api/food-logs/"),
              )
              .map((i) => i.endpoint.slice("/api/food-logs/".length)),
          );
          const localImageMap = new Map<string, string>();
          for (const le of localEntries) {
            if (le.imageUri) {
              localImageMap.set(le.id, le.imageUri);
            }
          }
          const entries: FoodLogEntry[] = serverRows.map((log) => {
            const serverImage = log.imageUri;
            const localImage = localImageMap.get(log.clientId);
            return {
              id: log.clientId,
              foodId: log.foodData.id,
              food: log.foodData,
              date: log.date,
              createdAt: log.createdAt,
              ...(serverImage
                ? { imageUri: serverImage }
                : localImage
                  ? { imageUri: localImage }
                  : {}),
            };
          });
          const visibleEntries = entries.filter(
            (e) => !pendingDeletes.has(e.id),
          );
          const allLocal = [...localEntries];
          for (const entry of visibleEntries) {
            const idx = allLocal.findIndex((le) => le.id === entry.id);
            if (idx !== -1) {
              allLocal[idx] = entry;
            } else {
              allLocal.push(entry);
            }
          }
          const allLocalKept = allLocal.filter(
            (e) => !pendingDeletes.has(e.id),
          );
          await AsyncStorage.setItem(
            STORAGE_KEYS.FOOD_LOG,
            JSON.stringify(allLocalKept),
          );
          return visibleEntries;
        });
      }
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FOOD_LOG);
    const entries: FoodLogEntry[] = data ? JSON.parse(data) : [];
    if (typeof filter === "string") {
      return entries.filter((e) => e.date === filter);
    }
    if (filter && filter.start && filter.end) {
      return entries.filter(
        (e) => e.date >= filter.start && e.date <= filter.end,
      );
    }
    return entries;
  } catch {
    return [];
  }
}

async function getFoodLogLocal(): Promise<FoodLogEntry[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FOOD_LOG);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function addFoodLogEntry(
  food: Food,
  date: string,
  imageUri?: string,
): Promise<FoodLogEntry> {
  invalidateCache("food-log");
  const entries = await getFoodLogLocal();
  const entry: FoodLogEntry = {
    id: uuidv4(),
    foodId: food.id,
    food,
    date,
    createdAt: new Date().toISOString(),
    ...(imageUri ? { imageUri } : {}),
  };
  entries.push(entry);
  await AsyncStorage.setItem(STORAGE_KEYS.FOOD_LOG, JSON.stringify(entries));

  if (await isAuthenticated()) {
    await syncWithRetry("/api/food-logs", "POST", {
      clientId: entry.id,
      foodData: food,
      date,
      createdAt: entry.createdAt,
      ...(imageUri ? { imageUri } : {}),
    });
  }

  return entry;
}

export async function updateFoodLogEntry(
  entryId: string,
  updatedFood: Food,
): Promise<void> {
  invalidateCache("food-log");
  const entries = await getFoodLogLocal();
  const idx = entries.findIndex((e) => e.id === entryId);
  if (idx !== -1) {
    entries[idx].food = updatedFood;
    entries[idx].foodId = updatedFood.id;
    await AsyncStorage.setItem(STORAGE_KEYS.FOOD_LOG, JSON.stringify(entries));
  }

  if (await isAuthenticated()) {
    await syncWithRetry(`/api/food-logs/${entryId}`, "PUT", {
      foodData: updatedFood,
    });
  }
}

export async function deleteFoodLogEntry(entryId: string): Promise<void> {
  invalidateCache("food-log");
  const entries = await getFoodLogLocal();
  const filtered = entries.filter((e) => e.id !== entryId);
  await AsyncStorage.setItem(STORAGE_KEYS.FOOD_LOG, JSON.stringify(filtered));

  if (await isAuthenticated()) {
    await syncWithRetry(`/api/food-logs/${entryId}`, "DELETE", {});
  }
}

export async function getRecentMeals(
  limit: number = 5,
): Promise<FoodLogEntry[]> {
  try {
    const entries = await getFoodLogLocal();
    return entries
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);
  } catch {
    return [];
  }
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
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// Calculate progression suggestion
export function calculateProgression(
  exerciseId: string,
  exerciseName: string,
  lastSets: { weight: number; reps: number; completed: boolean }[],
  unitSystem: "imperial" | "metric" = "imperial",
): { suggestedWeight: number; message: string } {
  if (lastSets.length === 0) {
    return { suggestedWeight: 0, message: "Start with a comfortable weight" };
  }

  // Weights are stored in the user's own unit, so increments and labels
  // must match it: +5/+2.5 lb plates vs +2.5/+1.25 kg plates. The old
  // version told metric users to "Try 52.5 lbs".
  const unit = unitSystem === "metric" ? "kg" : "lbs";
  const bigStep = unitSystem === "metric" ? 2.5 : 5;
  const smallStep = unitSystem === "metric" ? 1.25 : 2.5;
  const threshold = unitSystem === "metric" ? 25 : 50;

  const completedSets = lastSets.filter((s) => s.completed);
  const failedSets = lastSets.filter((s) => !s.completed);
  const lastWeight = lastSets[0].weight;

  // Bodyweight / unweighted movements: a numeric suggestion is nonsense
  // ("Try 2.5 lbs" after unweighted pull-ups).
  if (lastWeight <= 0) {
    return {
      suggestedWeight: 0,
      message:
        failedSets.length === 0
          ? "All sets done — add reps or weight next time"
          : "Keep working at this level",
    };
  }

  // If all sets completed, suggest increase
  if (failedSets.length === 0) {
    const increase = lastWeight >= threshold ? bigStep : smallStep;
    return {
      suggestedWeight: lastWeight + increase,
      message: `Great work! Try ${lastWeight + increase} ${unit} next time`,
    };
  }

  // If multiple sets failed, suggest decrease
  if (failedSets.length >= 2) {
    const decrease = lastWeight * 0.05;
    const newWeight =
      Math.round((lastWeight - decrease) / smallStep) * smallStep;
    return {
      suggestedWeight: newWeight,
      message: `Deload to ${newWeight} ${unit} and focus on form`,
    };
  }

  // Otherwise, keep same weight
  return {
    suggestedWeight: lastWeight,
    message: `Stick with ${lastWeight} ${unit} until you hit all reps`,
  };
}

// Run History
export function getRunHistory(): Promise<RunEntry[]> {
  return cached("runs", getRunHistoryImpl);
}

async function getRunHistoryImpl(): Promise<RunEntry[]> {
  try {
    if (await isAuthenticated()) {
      const result = await syncToServer<any[]>("/api/runs", "GET");
      if (result.success && result.data) {
        // Splits aren't carried in the server schema yet — merge them
        // back from the local copy keyed by clientId so cross-device
        // load doesn't wipe them out. heartRateZone is derived from
        // avgHeartRate + user age (server doesn't store the zone).
        const localBefore = await getRunHistoryLocal();
        const localById = new Map(localBefore.map((r) => [r.id, r]));
        const profile = await getUserProfile();
        const age = profile?.age ?? 30;

        const serverRuns: RunEntry[] = result.data.map((r) => {
          const local = localById.get(r.clientId);
          const zoneInfo = r.avgHeartRate
            ? getZoneForHeartRate(r.avgHeartRate, age)
            : null;
          return {
            id: r.clientId,
            distanceKm: r.distanceKm,
            durationSeconds: r.durationSeconds,
            paceMinPerKm: r.paceMinPerKm,
            calories: r.calories,
            startedAt: r.startedAt,
            completedAt: r.completedAt,
            route: r.route,
            avgHeartRate: r.avgHeartRate,
            maxHeartRate: r.maxHeartRate,
            heartRateZone: zoneInfo?.zone,
            elevationGainM: r.elevationGainM,
            splits: local?.splits,
            splitsUnit: local?.splitsUnit,
          };
        });
        // unionLocal: /api/runs is capped at 100 rows — keep older local
        // history and any run whose POST is still queued.
        const runs = (
          await mergeServerList(serverRuns, localBefore, "/api/runs", {
            unionLocal: true,
          })
        ).sort(
          (a, b) =>
            new Date(b.completedAt).getTime() -
            new Date(a.completedAt).getTime(),
        );
        await AsyncStorage.setItem(
          STORAGE_KEYS.RUN_HISTORY,
          JSON.stringify(runs),
        );
        return runs;
      }
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.RUN_HISTORY);
    const runs: RunEntry[] = data ? JSON.parse(data) : [];
    return runs.sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    );
  } catch {
    return [];
  }
}

async function getRunHistoryLocal(): Promise<RunEntry[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.RUN_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Upsert by run id. Server-side saveRun is also ON CONFLICT DO UPDATE on
// (user_id, client_id) so calling this again with the same id (e.g. when
// the user adds heart rate on the completion screen) updates both local
// and remote in lockstep instead of duplicating.
export async function saveRunEntry(run: RunEntry): Promise<void> {
  invalidateCache("runs");
  const runs = await getRunHistoryLocal();
  const existingIndex = runs.findIndex((r) => r.id === run.id);
  if (existingIndex >= 0) {
    runs[existingIndex] = run;
  } else {
    runs.push(run);
  }
  await AsyncStorage.setItem(STORAGE_KEYS.RUN_HISTORY, JSON.stringify(runs));

  if (await isAuthenticated()) {
    await syncWithRetry("/api/runs", "POST", {
      clientId: run.id,
      distanceKm: run.distanceKm,
      durationSeconds: run.durationSeconds,
      paceMinPerKm: run.paceMinPerKm,
      calories: run.calories,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      activityDate: activityDay(run),
      route: run.route,
      avgHeartRate: run.avgHeartRate,
      maxHeartRate: run.maxHeartRate,
      elevationGainM: run.elevationGainM,
    });
  }
}

export async function saveRunHistory(runs: RunEntry[]): Promise<void> {
  invalidateCache("runs");
  await AsyncStorage.setItem(STORAGE_KEYS.RUN_HISTORY, JSON.stringify(runs));
}

export async function deleteRunEntry(id: string): Promise<void> {
  invalidateCache("runs");
  const runs = await getRunHistoryLocal();
  const filtered = runs.filter((r) => r.id !== id);
  await AsyncStorage.setItem(
    STORAGE_KEYS.RUN_HISTORY,
    JSON.stringify(filtered),
  );

  if (await isAuthenticated()) {
    await syncWithRetry(`/api/runs/${id}`, "DELETE", {});
  }
}

// Clear all data (for logout)
export async function clearAllData(): Promise<void> {
  invalidateCache();
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  // The pending-write queue lives under its own key in syncService. It
  // MUST go too: left behind, the next account to sign in on this device
  // replays the previous account's queued workouts/food logs under the
  // new token.
  await clearSyncQueue();
  // Cancels OS-scheduled reminders + wipes the notification AsyncStorage
  // keys, which live outside STORAGE_KEYS in notifications.ts.
  await clearScheduledNotifications();
}
