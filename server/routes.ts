import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { exerciseDatabase, getExercisesByMuscle, getExercisesByDifficulty, type LocalExercise } from "./exerciseDatabase";
import { 
  getBodyWeights, addBodyWeight, deleteBodyWeight,
  getMacroTargets, saveMacroTargets,
  getRoutines, saveRoutine, deleteRoutine,
  getWorkouts, saveWorkout,
  getRuns, saveRun,
  getFoodLogs, saveFoodLog, deleteFoodLog,
  getUserStreak, updateUserStreak,
  getCustomExercises, saveCustomExercise, deleteCustomExercise,
  getSavedFoods, saveSavedFood, deleteSavedFood,
  getNotificationPrefs, saveNotificationPrefs
} from "./db";
import { requireAuth } from "./auth";

interface CalorieNinjaFood {
  name: string;
  calories: number;
  serving_size_g: number;
  fat_total_g: number;
  fat_saturated_g: number;
  protein_g: number;
  sodium_mg: number;
  potassium_mg: number;
  cholesterol_mg: number;
  carbohydrates_total_g: number;
  fiber_g: number;
  sugar_g: number;
}

interface WorkoutAPIExercise {
  id: string;
  code: string;
  name: string;
  description: string;
  primaryMuscles: { id: string; code: string; name: string }[];
  secondaryMuscles: { id: string; code: string; name: string }[];
  types: { id: string; code: string; name: string }[];
  categories: { id: string; code: string; name: string }[];
}

// Map frontend muscle group names to WorkoutAPI muscle codes
const MUSCLE_MAP: Record<string, string> = {
  biceps: "BICEPS",
  triceps: "TRICEPS",
  forearms: "FOREARMS",
  chest: "CHEST",
  shoulders: "SHOULDERS",
  traps: "TRAPEZIUS",
  lats: "LATS",
  middle_back: "BACK",
  lower_back: "LOWER_BACK",
  abs: "ABS",
  quadriceps: "QUADRICEPS",
  hamstrings: "HAMSTRINGS",
  glutes: "GLUTES",
  calves: "CALVES",
};

let cachedExercises: WorkoutAPIExercise[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

async function fetchAllExercises(apiKey: string): Promise<WorkoutAPIExercise[]> {
  const now = Date.now();
  if (cachedExercises && now - cacheTimestamp < CACHE_DURATION) {
    return cachedExercises;
  }

  const response = await fetch("https://api.workoutapi.com/exercises", {
    headers: {
      "Accept": "application/json",
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("WorkoutAPI error:", errorText);
    throw new Error(`Failed to fetch exercises: ${response.status}`);
  }

  cachedExercises = await response.json();
  cacheTimestamp = now;
  console.log(`Cached ${cachedExercises?.length || 0} exercises from WorkoutAPI`);
  return cachedExercises || [];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // CalorieNinjas Food Search API
  app.get("/api/foods/search", requireAuth, async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== "string" || query.trim().length < 2) {
        return res.status(400).json({ error: "Search query must be at least 2 characters" });
      }

      const apiKey = process.env.CALORIENINJA_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ 
          error: "Food API not configured", 
          useLocalDatabase: true 
        });
      }

      const response = await fetch(
        `https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(query.trim())}`,
        {
          headers: {
            "X-Api-Key": apiKey,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("CalorieNinjas search error:", errorText);
        return res.status(503).json({ 
          error: "Food API temporarily unavailable", 
          useLocalDatabase: true 
        });
      }

      const data = await response.json();
      const items: CalorieNinjaFood[] = data.items || [];
      
      // Transform to our format
      const results = items.map((food, index) => ({
        id: `cn-${Date.now()}-${index}`,
        name: food.name.charAt(0).toUpperCase() + food.name.slice(1),
        brand: null,
        type: "api",
        servingSize: `${food.serving_size_g}g`,
        calories: Math.round(food.calories),
        fat: Math.round(food.fat_total_g),
        carbs: Math.round(food.carbohydrates_total_g),
        protein: Math.round(food.protein_g),
      }));

      res.json({
        foods: results,
        page: 0,
        totalResults: results.length,
      });
    } catch (error) {
      console.error("Error searching foods:", error);
      res.status(503).json({ 
        error: "Food API temporarily unavailable", 
        useLocalDatabase: true 
      });
    }
  });

  // Photo-based food analysis endpoint
  // Uses OpenAI Vision to identify food, then CalorieNinjas for nutrition lookup
  app.post("/api/foods/analyze-photo", requireAuth, async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ 
          success: false, 
          message: "No image provided" 
        });
      }

      const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      
      if (!openaiApiKey || !openaiBaseUrl) {
        return res.json({
          success: false,
          message: "AI vision service not configured. Please enter food details manually.",
          requiresManualEntry: true,
        });
      }

      // Use OpenAI Vision to identify the food
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: openaiApiKey,
        baseURL: openaiBaseUrl,
      });

      const visionResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a professional sports nutritionist and food portion estimation specialist.

Your task is to estimate nutrition from a food photo as realistically as possible using evidence-based reasoning.

Do NOT assume perfect precision.
Use realistic cooking assumptions.
Prioritize macro realism over optimistic calorie estimates.

STEP 1 — FOOD IDENTIFICATION
Identify each visible food item separately.
Classify protein type accurately (lean beef, moderate-fat beef, fatty beef, chicken breast, chicken thigh, etc.).

If the exact cut is unclear:
Default beef to "moderate-fat cooked beef" (approx 22–26g protein, 12–18g fat per 100g).
Do NOT default to extremely lean unless visually confirmed.

STEP 2 — PORTION ESTIMATION
Estimate portion size in grams using plate size, food density, thickness, and volume.

Use realistic adult meal sizing:
Cooked beef strips on a full plate usually 220–320g.
1 cup cooked white rice ≈ 200–220g.
If food occupies half a standard dinner plate, assume 200–300g.

STEP 3 — COOKING FAT LOGIC (CRITICAL)
If meat appears pan-seared or glossy:
Assume minimum 0.5 tbsp oil absorbed.
Most likely 1 tbsp absorbed.
Maximum 1.5 tbsp absorbed.

Additionally:
Account for intrinsic beef fat separately from cooking oil.
Do NOT ignore rendered fat from the meat.
Calculate oil separately and add to total fat.

STEP 4 — SAUCE LOGIC
If sauce is visibly drizzled:
Estimate tablespoons visually.
1 tbsp BBQ sauce ≈ 35–45 calories, mostly carbs.
Do not inflate sauce calories beyond visual coverage.

STEP 5 — MACRO CALCULATION
Use USDA average values per 100g:
Lean cooked beef: 26g protein, 12g fat
Moderate-fat cooked beef: 25g protein, 15g fat
Fatty beef: 23g protein, 20g fat
Cooked white rice: 206 kcal per 200g (44–45g carbs per cup)
Scale macros by estimated weight.

STEP 6 — REALISM CHECK
Before final output:
Verify fat grams are plausible relative to meat size.
A 250g moderate-fat beef serving should not be under 30g total fat after cooking.
Recalculate if macros appear unrealistically lean.

Return a JSON object with:
- "foods": array of food items, each with:
  - "name": specific food name with preparation method
  - "estimatedWeightGrams": weight in grams (integer)
  - "estimatedServingSize": human-readable (e.g., "250g / about 8.8 oz")
  - "confidence": "high", "medium", or "low"
  - "calories": calories for this exact portion (integer)
  - "protein": protein in grams (number, 1 decimal)
  - "carbs": net carbohydrates in grams (number, 1 decimal)
  - "fat": total fat in grams (number, 1 decimal)
  - "fiber": dietary fiber in grams (number, 1 decimal)
- "description": brief meal description
- "totalCalories": sum of all calories (integer)
- "totalProtein": sum of all protein (1 decimal)
- "totalCarbs": sum of all carbs (1 decimal)
- "totalFat": sum of all fat (1 decimal)

If you cannot identify any food, return: {"foods": [], "description": "Could not identify food items"}

Respond ONLY with valid JSON, no markdown or additional text.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_completion_tokens: 1500,
      });

      const visionContent = visionResponse.choices[0]?.message?.content || "";
      
      let identifiedFoods;
      try {
        identifiedFoods = JSON.parse(visionContent);
      } catch (parseError) {
        console.error("Failed to parse vision response:", visionContent);
        return res.json({
          success: false,
          message: "Could not identify food items. Please enter details manually.",
          requiresManualEntry: true,
        });
      }

      if (!identifiedFoods.foods || identifiedFoods.foods.length === 0) {
        return res.json({
          success: false,
          message: identifiedFoods.description || "No food items identified. Please enter details manually.",
          requiresManualEntry: true,
        });
      }

      const calorieNinjasKey = process.env.CALORIENINJA_API_KEY;
      const foodsWithNutrition = [];

      for (const food of identifiedFoods.foods) {
        let calories = Math.round(food.calories || 0);
        let protein = Math.round(food.protein || 0);
        let carbs = Math.round(food.carbs || 0);
        let fat = Math.round(food.fat || 0);
        let fiber = Math.round(food.fiber || 0);
        let source = "ai_estimate";

        if (calorieNinjasKey && food.estimatedWeightGrams) {
          try {
            const searchQuery = `${food.estimatedWeightGrams}g ${food.name}`.trim();
            const nutritionResponse = await fetch(
              `https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(searchQuery)}`,
              {
                headers: { "X-Api-Key": calorieNinjasKey },
              }
            );

            if (nutritionResponse.ok) {
              const nutritionData = await nutritionResponse.json();
              if (nutritionData.items && nutritionData.items.length > 0) {
                let apiCals = 0, apiProtein = 0, apiCarbs = 0, apiFat = 0, apiFiber = 0;
                for (const item of nutritionData.items) {
                  apiCals += item.calories || 0;
                  apiProtein += item.protein_g || 0;
                  apiCarbs += item.carbohydrates_total_g || 0;
                  apiFat += item.fat_total_g || 0;
                  apiFiber += item.fiber_g || 0;
                }
                if (apiCals > 0) {
                  calories = Math.round(apiCals);
                  protein = Math.round(apiProtein);
                  carbs = Math.round(apiCarbs);
                  fat = Math.round(apiFat);
                  fiber = Math.round(apiFiber);
                  source = "calorieninjas";
                }
              }
            }
          } catch (nutritionError) {
            console.error("CalorieNinjas lookup failed, using AI estimates:", nutritionError);
          }
        }

        foodsWithNutrition.push({
          name: food.name,
          servingSize: food.estimatedServingSize,
          estimatedWeightGrams: food.estimatedWeightGrams,
          confidence: food.confidence,
          calories,
          protein,
          carbs,
          fat,
          fiber,
          source,
        });
      }

      return res.json({
        success: true,
        foods: foodsWithNutrition,
        description: identifiedFoods.description,
        totalCalories: identifiedFoods.totalCalories || foodsWithNutrition.reduce((s, f) => s + (f.calories || 0), 0),
        totalProtein: identifiedFoods.totalProtein || foodsWithNutrition.reduce((s, f) => s + (f.protein || 0), 0),
        totalCarbs: identifiedFoods.totalCarbs || foodsWithNutrition.reduce((s, f) => s + (f.carbs || 0), 0),
        totalFat: identifiedFoods.totalFat || foodsWithNutrition.reduce((s, f) => s + (f.fat || 0), 0),
        message: `Identified ${foodsWithNutrition.length} food item(s)`,
      });
      
    } catch (error) {
      console.error("Error analyzing food photo:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error analyzing photo. Please try again or enter details manually.",
        requiresManualEntry: true,
      });
    }
  });

  // Exercises API - fetches from WorkoutAPI
  app.get("/api/exercises", async (req, res) => {
    try {
      const { muscle } = req.query;
      
      const apiKey = process.env.WORKOUT_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Workout API key not configured" });
      }

      const allExercises = await fetchAllExercises(apiKey);
      
      let filtered = allExercises;
      if (muscle) {
        const muscleCode = MUSCLE_MAP[String(muscle).toLowerCase()] || String(muscle).toUpperCase();
        filtered = allExercises.filter(ex => 
          ex.primaryMuscles.some(m => m.code === muscleCode) ||
          ex.secondaryMuscles.some(m => m.code === muscleCode)
        );
      }

      // Transform to simpler format
      const exercises = filtered.map(ex => ({
        id: ex.id,
        name: ex.name,
        muscle: ex.primaryMuscles[0]?.name || "Full Body",
        equipment: ex.categories[0]?.name || "Bodyweight",
        type: ex.types[0]?.name || "Compound",
        instructions: ex.description,
      }));

      res.json(exercises);
    } catch (error) {
      console.error("Error fetching exercises:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Generate routine - creates a balanced workout from exercises
  // Uses WorkoutAPI as primary source, falls back to local database for variety
  app.post("/api/generate-routine", requireAuth, async (req, res) => {
    try {
      const { muscleGroups, difficulty, name, equipment, goal, notes } = req.body;

      if (!muscleGroups || !Array.isArray(muscleGroups) || muscleGroups.length === 0) {
        return res.status(400).json({ error: "At least one muscle group is required" });
      }

      const difficultyLevel = difficulty === "beginner" ? "beginner" : difficulty === "advanced" || difficulty === "expert" ? "advanced" : "intermediate";

      const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

      if (openaiApiKey && openaiBaseUrl) {
        try {
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseUrl });

          const equipmentList = equipment && equipment.length > 0
            ? equipment.join(", ")
            : "full gym (barbell, dumbbells, cables, machines)";

          const goalText = goal || "general fitness";

          const prompt = `You are an expert personal trainer. Create a workout routine with the following parameters:
- Target muscle groups: ${muscleGroups.join(", ")}
- Experience level: ${difficultyLevel}
- Available equipment: ${equipmentList}
- Training goal: ${goalText}
${notes ? `- Additional notes: ${notes}` : ""}

Generate a complete workout routine. For each exercise include:
- name: the exercise name
- muscleGroup: primary muscle targeted
- equipment: equipment needed
- sets: number of sets (${difficultyLevel === "beginner" ? "2-3" : difficultyLevel === "intermediate" ? "3-4" : "4-5"})
- reps: rep range as a string (e.g. "8-12", "12-15", "5")
- restSeconds: rest between sets in seconds
- instructions: brief form cues (1-2 sentences)
- order: exercise order (start compound movements first, then isolation)

Order exercises properly: compound lifts first, then isolation work. Include ${muscleGroups.length <= 2 ? "4-5" : "3-4"} exercises per muscle group. Total should be ${muscleGroups.length <= 2 ? "8-10" : Math.min(muscleGroups.length * 3, 15)} exercises.

Respond ONLY with valid JSON in this exact format:
{
  "name": "routine name",
  "exercises": [
    {
      "name": "Exercise Name",
      "muscleGroup": "Chest",
      "equipment": "Barbell",
      "sets": 4,
      "reps": "8-12",
      "restSeconds": 90,
      "instructions": "Brief form cues here.",
      "order": 0
    }
  ]
}`;

          const response = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content;
          if (!content) throw new Error("Empty AI response");

          const parsed = JSON.parse(content);
          const exercises = parsed.exercises.map((ex: any, idx: number) => ({
            id: `ai-${Date.now()}-${idx}`,
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            equipment: ex.equipment || "Bodyweight",
            sets: ex.sets || 3,
            reps: String(ex.reps || "10"),
            restSeconds: ex.restSeconds || 60,
            instructions: ex.instructions || "",
            order: ex.order ?? idx,
          }));

          exercises.sort((a: any, b: any) => a.order - b.order);

          return res.json({
            id: `routine-${Date.now()}`,
            name: name || parsed.name || `${muscleGroups.map((m: string) => m.charAt(0).toUpperCase() + m.slice(1).replace("_", " ")).join(" & ")} Workout`,
            exercises,
            difficulty: difficultyLevel,
            muscleGroups,
            generatedBy: "ai",
          });
        } catch (aiError) {
          console.error("OpenAI routine generation failed, falling back to database:", aiError);
        }
      }

      const routineExercises: any[] = [];
      const usedExerciseNames = new Set<string>();
      const exercisesPerMuscle = muscleGroups.length <= 2 ? 3 : 2;

      let apiExercises: WorkoutAPIExercise[] = [];
      const apiKey = process.env.WORKOUT_API_KEY;
      if (apiKey) {
        try { apiExercises = await fetchAllExercises(apiKey); } catch {}
      }

      for (const muscle of muscleGroups) {
        const muscleCode = MUSCLE_MAP[String(muscle).toLowerCase()] || String(muscle).toUpperCase();
        let muscleExercisesCount = 0;

        if (apiExercises.length > 0) {
          const apiMuscleExercises = apiExercises.filter(ex =>
            ex.primaryMuscles.some(m => m.code === muscleCode || m.code.includes(muscleCode) || muscleCode.includes(m.code))
          );
          for (const ex of apiMuscleExercises) {
            if (muscleExercisesCount >= exercisesPerMuscle) break;
            if (usedExerciseNames.has(ex.name.toLowerCase())) continue;
            usedExerciseNames.add(ex.name.toLowerCase());
            routineExercises.push({
              id: ex.id, name: ex.name,
              muscleGroup: ex.primaryMuscles[0]?.name || muscle,
              equipment: ex.categories[0]?.name || "Bodyweight",
              sets: difficultyLevel === "beginner" ? 3 : difficultyLevel === "intermediate" ? 4 : 5,
              reps: "10", restSeconds: difficultyLevel === "beginner" ? 90 : difficultyLevel === "intermediate" ? 60 : 45,
              instructions: ex.description,
            });
            muscleExercisesCount++;
          }
        }

        if (muscleExercisesCount < exercisesPerMuscle) {
          const localExercises = getExercisesByMuscle(muscle);
          const filteredLocal = getExercisesByDifficulty(localExercises, difficultyLevel === "advanced" ? "expert" : difficultyLevel);
          const shuffled = filteredLocal.sort(() => Math.random() - 0.5);
          for (const ex of shuffled) {
            if (muscleExercisesCount >= exercisesPerMuscle) break;
            if (usedExerciseNames.has(ex.name.toLowerCase())) continue;
            usedExerciseNames.add(ex.name.toLowerCase());
            routineExercises.push({
              id: ex.id, name: ex.name,
              muscleGroup: muscle.charAt(0).toUpperCase() + muscle.slice(1).replace("_", " "),
              equipment: ex.equipment,
              sets: difficultyLevel === "beginner" ? 3 : difficultyLevel === "intermediate" ? 4 : 5,
              reps: "10", restSeconds: difficultyLevel === "beginner" ? 90 : difficultyLevel === "intermediate" ? 60 : 45,
              instructions: ex.instructions,
            });
            muscleExercisesCount++;
          }
        }
      }

      res.json({
        id: `routine-${Date.now()}`,
        name: name || `${muscleGroups.map((m: string) => m.charAt(0).toUpperCase() + m.slice(1).replace("_", " ")).join(" & ")} Workout`,
        exercises: routineExercises,
        difficulty: difficultyLevel,
        muscleGroups,
        generatedBy: "database",
      });
    } catch (error) {
      console.error("Error generating routine:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/body-weights", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const weights = await getBodyWeights(userId);
      res.json(weights);
    } catch (error) {
      console.error("Error fetching body weights:", error);
      res.status(500).json({ error: "Failed to fetch body weights" });
    }
  });

  app.post("/api/body-weights", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { weightKg, date } = req.body;
      
      if (typeof weightKg !== "number" || weightKg <= 0) {
        return res.status(400).json({ error: "Invalid weight value" });
      }
      
      const entryDate = date ? new Date(date) : new Date();
      if (isNaN(entryDate.getTime())) {
        return res.status(400).json({ error: "Invalid date" });
      }
      
      const entry = await addBodyWeight(userId, weightKg, entryDate);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error adding body weight:", error);
      res.status(500).json({ error: "Failed to add body weight" });
    }
  });

  app.delete("/api/body-weights/:id", requireAuth, async (req: Request<{ id: string }>, res: Response) => {
    try {
      const userId = (req as any).userId;
      const id = parseInt(req.params.id, 10);
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid weight entry ID" });
      }
      
      const deleted = await deleteBodyWeight(userId, id);
      if (!deleted) {
        return res.status(404).json({ error: "Weight entry not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting body weight:", error);
      res.status(500).json({ error: "Failed to delete body weight" });
    }
  });

  // Macro Targets
  app.get("/api/macro-targets", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const targets = await getMacroTargets(userId);
      res.json(targets);
    } catch (error) {
      console.error("Error getting macro targets:", error);
      res.status(500).json({ error: "Failed to get macro targets" });
    }
  });

  app.post("/api/macro-targets", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { calories, protein, carbs, fat } = req.body;
      
      if (!calories || !protein || !carbs || !fat) {
        return res.status(400).json({ error: "All macro values are required" });
      }
      
      const targets = await saveMacroTargets(userId, { calories, protein, carbs, fat });
      res.json(targets);
    } catch (error) {
      console.error("Error saving macro targets:", error);
      res.status(500).json({ error: "Failed to save macro targets" });
    }
  });

  // Routines
  app.get("/api/routines", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const routines = await getRoutines(userId);
      res.json(routines);
    } catch (error) {
      console.error("Error getting routines:", error);
      res.status(500).json({ error: "Failed to get routines" });
    }
  });

  app.post("/api/routines", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { clientId, name, exercises, createdAt, lastCompletedAt } = req.body;
      
      if (!clientId || !name) {
        return res.status(400).json({ error: "clientId and name are required" });
      }
      
      await saveRoutine(userId, { clientId, name, exercises: exercises || [], createdAt, lastCompletedAt });
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving routine:", error);
      res.status(500).json({ error: "Failed to save routine" });
    }
  });

  app.delete("/api/routines/:clientId", requireAuth, async (req: Request<{ clientId: string }>, res: Response) => {
    try {
      const userId = (req as any).userId;
      const deleted = await deleteRoutine(userId, req.params.clientId);
      if (!deleted) {
        return res.status(404).json({ error: "Routine not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting routine:", error);
      res.status(500).json({ error: "Failed to delete routine" });
    }
  });

  // Workouts
  app.get("/api/workouts", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const workouts = await getWorkouts(userId);
      res.json(workouts);
    } catch (error) {
      console.error("Error getting workouts:", error);
      res.status(500).json({ error: "Failed to get workouts" });
    }
  });

  app.post("/api/workouts", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { clientId, routineId, routineName, exercises, startedAt, completedAt, durationMinutes } = req.body;
      
      if (!clientId || !startedAt) {
        return res.status(400).json({ error: "clientId and startedAt are required" });
      }
      
      await saveWorkout(userId, { clientId, routineId, routineName, exercises: exercises || [], startedAt, completedAt, durationMinutes });
      
      // Update user's streak when completing a workout
      const streak = await updateUserStreak(userId);
      res.json({ success: true, streak });
    } catch (error) {
      console.error("Error saving workout:", error);
      res.status(500).json({ error: "Failed to save workout" });
    }
  });

  // Runs
  app.get("/api/runs", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const runs = await getRuns(userId);
      res.json(runs);
    } catch (error) {
      console.error("Error getting runs:", error);
      res.status(500).json({ error: "Failed to get runs" });
    }
  });

  app.post("/api/runs", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { clientId, distanceKm, durationSeconds, paceMinPerKm, calories, startedAt, completedAt, route } = req.body;
      
      if (!clientId || !startedAt || !completedAt) {
        return res.status(400).json({ error: "clientId, startedAt, and completedAt are required" });
      }
      
      await saveRun(userId, { clientId, distanceKm, durationSeconds, paceMinPerKm, calories, startedAt, completedAt, route });
      
      // Update user's streak when completing a run
      const streak = await updateUserStreak(userId);
      res.json({ success: true, streak });
    } catch (error) {
      console.error("Error saving run:", error);
      res.status(500).json({ error: "Failed to save run" });
    }
  });

  // Food Logs
  app.get("/api/food-logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const date = req.query.date as string | undefined;
      const logs = await getFoodLogs(userId, date);
      res.json(logs);
    } catch (error) {
      console.error("Error getting food logs:", error);
      res.status(500).json({ error: "Failed to get food logs" });
    }
  });

  app.post("/api/food-logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { clientId, foodData, date, createdAt } = req.body;
      
      if (!clientId || !foodData || !date) {
        return res.status(400).json({ error: "clientId, foodData, and date are required" });
      }
      
      await saveFoodLog(userId, { clientId, foodData, date, createdAt: createdAt || new Date().toISOString() });
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving food log:", error);
      res.status(500).json({ error: "Failed to save food log" });
    }
  });

  app.delete("/api/food-logs/:clientId", requireAuth, async (req: Request<{ clientId: string }>, res: Response) => {
    try {
      const userId = (req as any).userId;
      const deleted = await deleteFoodLog(userId, req.params.clientId);
      if (!deleted) {
        return res.status(404).json({ error: "Food log not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting food log:", error);
      res.status(500).json({ error: "Failed to delete food log" });
    }
  });

  // Custom Exercises
  app.get("/api/custom-exercises", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const exercises = await getCustomExercises(userId);
      res.json(exercises);
    } catch (error) {
      console.error("Error getting custom exercises:", error);
      res.status(500).json({ error: "Failed to get custom exercises" });
    }
  });

  app.post("/api/custom-exercises", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { clientId, name, muscleGroup, isCustom } = req.body;
      if (!clientId || !name || !muscleGroup) {
        return res.status(400).json({ error: "clientId, name, and muscleGroup are required" });
      }
      await saveCustomExercise(userId, { clientId, name, muscleGroup, isCustom: isCustom ?? true });
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving custom exercise:", error);
      res.status(500).json({ error: "Failed to save custom exercise" });
    }
  });

  app.post("/api/custom-exercises/bulk", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { exercises } = req.body;
      if (!Array.isArray(exercises)) {
        return res.status(400).json({ error: "exercises array is required" });
      }
      for (const exercise of exercises) {
        if (exercise.isCustom) {
          await saveCustomExercise(userId, {
            clientId: exercise.clientId || exercise.id,
            name: exercise.name,
            muscleGroup: exercise.muscleGroup,
            isCustom: true,
          });
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error bulk saving exercises:", error);
      res.status(500).json({ error: "Failed to save exercises" });
    }
  });

  app.delete("/api/custom-exercises/:clientId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      await deleteCustomExercise(userId, req.params.clientId as string);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting custom exercise:", error);
      res.status(500).json({ error: "Failed to delete custom exercise" });
    }
  });

  // Saved Foods
  app.get("/api/saved-foods", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const foods = await getSavedFoods(userId);
      res.json(foods);
    } catch (error) {
      console.error("Error getting saved foods:", error);
      res.status(500).json({ error: "Failed to get saved foods" });
    }
  });

  app.post("/api/saved-foods", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { food } = req.body;
      if (!food || !food.id) {
        return res.status(400).json({ error: "food object with id is required" });
      }
      await saveSavedFood(userId, food);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving food:", error);
      res.status(500).json({ error: "Failed to save food" });
    }
  });

  app.post("/api/saved-foods/bulk", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { foods } = req.body;
      if (!Array.isArray(foods)) {
        return res.status(400).json({ error: "foods array is required" });
      }
      for (const food of foods) {
        if (food && food.id) {
          await saveSavedFood(userId, food);
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error bulk saving foods:", error);
      res.status(500).json({ error: "Failed to save foods" });
    }
  });

  app.delete("/api/saved-foods/:foodId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      await deleteSavedFood(userId, req.params.foodId as string);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved food:", error);
      res.status(500).json({ error: "Failed to delete saved food" });
    }
  });

  // Notification Preferences
  app.get("/api/notification-prefs", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const prefs = await getNotificationPrefs(userId);
      res.json(prefs);
    } catch (error) {
      console.error("Error getting notification prefs:", error);
      res.status(500).json({ error: "Failed to get notification preferences" });
    }
  });

  app.post("/api/notification-prefs", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { workoutReminders, streakAlerts, reminderHour, reminderMinute } = req.body;
      await saveNotificationPrefs(userId, {
        workoutReminders: workoutReminders ?? false,
        streakAlerts: streakAlerts ?? false,
        reminderHour: reminderHour ?? 18,
        reminderMinute: reminderMinute ?? 0,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving notification prefs:", error);
      res.status(500).json({ error: "Failed to save notification preferences" });
    }
  });

  // Streak tracking
  app.get("/api/streak", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const streak = await getUserStreak(userId);
      res.json(streak);
    } catch (error) {
      console.error("Error getting streak:", error);
      res.status(500).json({ error: "Failed to get streak" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
