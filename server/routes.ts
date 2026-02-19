import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import sharp from "sharp";
import { exerciseDatabase, getExercisesByMuscle, getExercisesByDifficulty, type LocalExercise } from "./exerciseDatabase";
import {
  getBodyWeights, addBodyWeight, deleteBodyWeight,
  getMacroTargets, saveMacroTargets,
  getRoutines, saveRoutine, deleteRoutine,
  getWorkouts, saveWorkout,
  getRuns, saveRun, deleteRun,
  getFoodLogs, saveFoodLog, updateFoodLog, deleteFoodLog,
  getUserStreak, updateUserStreak,
  getCustomExercises, saveCustomExercise, deleteCustomExercise,
  getSavedFoods, saveSavedFood, deleteSavedFood,
  getNotificationPrefs, saveNotificationPrefs,
  getUserById,
  pool,
  followUser, unfollowUser, isFollowing, getFollowers, getFollowing,
  createPost, getPost, deletePost, getFeedPosts, getUserPosts,
  likePost, unlikePost,
  getPostComments, addComment, deleteComment,
  searchUsers, getSocialProfile, updateSocialProfile,
} from "./db";
import { requireAuth } from "./auth";


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
  app.get("/api/foods/search", requireAuth, async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== "string" || query.trim().length < 2) {
        return res.status(400).json({ error: "Search query must be at least 2 characters" });
      }

      const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

      if (!openaiApiKey || !openaiBaseUrl) {
        return res.status(503).json({ 
          error: "AI service not configured", 
          useLocalDatabase: true 
        });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: openaiApiKey,
        baseURL: openaiBaseUrl,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "user",
            content: `Return nutrition for query: "${query.trim()}". Provide up to 3 best matches (common variations), using USDA-style averages.

Rules:
- Output per 100g unless the food is typically counted per piece (then also give per 1 item in name, but keep servingSize as 100g).
- Use realistic macros (no brand claims).
- Prefer: generic category > niche variant.
- If ambiguous, include lean and regular options.

Return JSON array only:
[{"name":"","servingSize":"100g","calories":0,"protein":0.0,"carbs":0.0,"fat":0.0}]`
          }
        ],
        max_completion_tokens: 500,
      });

      let content = completion.choices[0]?.message?.content || "[]";
      content = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      let foods;
      try {
        const parsed = JSON.parse(content);
        foods = (Array.isArray(parsed) ? parsed : parsed.foods || []).map((food: any, index: number) => ({
          id: `ai-${Date.now()}-${index}`,
          name: food.name || query.trim(),
          brand: null,
          type: "ai",
          servingSize: food.servingSize || "100g",
          calories: Math.round(food.calories || 0),
          fat: Math.round(food.fat || 0),
          carbs: Math.round(food.carbs || 0),
          protein: Math.round(food.protein || 0),
        }));
      } catch {
        foods = [];
      }

      res.json({
        foods,
        page: 0,
        totalResults: foods.length,
      });
    } catch (error) {
      console.error("Error searching foods:", error);
      res.status(503).json({ 
        error: "Food search temporarily unavailable", 
        useLocalDatabase: true 
      });
    }
  });

  // Photo-based food analysis endpoint
  // Uses OpenAI Vision to identify and estimate nutrition from food photos
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

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: openaiApiKey,
        baseURL: openaiBaseUrl,
      });

      // Enhance image brightness and sharpness for better AI recognition
      let enhancedBase64 = imageBase64;
      try {
        const imgBuffer = Buffer.from(imageBase64, "base64");
        const enhanced = await sharp(imgBuffer)
          .modulate({ brightness: 1.3 })
          .sharpen()
          .jpeg({ quality: 90 })
          .toBuffer();
        enhancedBase64 = enhanced.toString("base64");
        console.log("[Photo] Enhanced image: brightness +30%, sharpened");
      } catch (enhanceErr) {
        console.log("[Photo] Enhancement skipped, using original:", enhanceErr);
      }

      // CALL A: Vision - identify food items, categorize, and estimate grams
      const promptA = `Analyze this food photo for a bodybuilding-focused macro tracker.

STRICT RULES:
- Identify visible items only. Do NOT double-count (e.g. meatballs are ground_beef, don't add separate "meat" entry).
- Output COOKED edible grams (exclude bones, shells, packaging). If bone-in, set bone_in=true.
- Choose category ONLY from APPROVED_LIST. If uncertain, choose the closest match. Do NOT invent categories.
- If fried/breaded, set fried_breaded=true.
- If pan-seared meat and visible oil sheen/pooling, set pan_seared=true and oil_present=true.
- ALWAYS check for sauces, dressings, condiments, glazes, and toppings. Even thin coatings, drizzles, or mixed-in sauces count. List each sauce as its own separate item from FATS/SAUCES with estimated grams. Do NOT set sauce_type or sauce_tbsp on other items — sauces are always their own line items.
- Sauce visual cues: glossy/shiny surface = oil or butter-based sauce; red/orange coating = tomato/hot sauce; white/cream coating = alfredo/ranch/mayo; brown glaze = teriyaki/soy/gravy; yellow = mustard/cheese sauce.

PORTION SIZE REFERENCE (use these to calibrate your gram estimates):
- A standard dinner plate is ~25-27cm (10-11 inches) diameter. Use the plate as a ruler.
- 1 fist-sized portion of meat/protein ≈ 100-120g cooked
- 1 palm-sized chicken breast ≈ 120-150g cooked
- 1 cup of cooked rice/pasta ≈ 150-200g
- 1 medium meatball ≈ 25-35g
- 1 cup of vegetables ≈ 80-120g
- A typical single-serving restaurant plate of pasta = 200-280g cooked pasta
- A typical home-cooked plate of pasta = 150-220g cooked pasta
- 1 tablespoon of sauce ≈ 15g
- Total weight of a SINGLE MEAL on one plate is typically 300-600g. Over 800g total is very unusual for one plate.

APPROVED_LIST:

PROTEINS (50):
chicken_breast_grilled, chicken_breast_pan_seared, chicken_thigh, chicken_fried_breaded, ground_beef_lean, ground_beef_regular, steak_lean, steak_moderate, steak_fatty, pork_chop_lean, pork_chop_moderate, pork_chop_fatty, salmon, white_fish, tilapia, tuna, turkey_breast, ground_turkey_lean, ground_turkey_regular, shrimp, egg_whole, egg_whites, tofu, tempeh, protein_bar, protein_powder, greek_yogurt_plain, greek_yogurt_flavored, cottage_cheese, beef_jerky, ham, bacon, sausage, lamb, venison, crab, lobster, sardines, mackerel, whey_shake_ready_to_drink, casein_shake, edamame, beans_chili, chicken_sausage, turkey_bacon, deli_chicken, deli_turkey, ground_bison, bison_steak, pork_tenderloin

CARBS (50):
white_rice, brown_rice, jasmine_rice, basmati_rice, rice_mix, sweet_potato, white_potato, mashed_potatoes, baked_potato, fries_fried, oats_cooked, oats_overnight, pasta_cooked, quinoa, couscous, black_beans, kidney_beans, lentils, chickpeas, tortilla_flour, tortilla_corn, bagel_plain, bread_white, bread_wheat, wrap_flatbread, burger_bun, english_muffin, pancakes, waffles, cereal, granola, rice_cakes, banana, apple, berries, grapes, orange, mango, pineapple, mixed_fruit, yogurt_parfait, protein_cookie, pretzels, popcorn, crackers, ramen_noodles, udon_noodles, sushi_rice, honey, jam_jelly, dates

FATS/SAUCES (54):
olive_oil, avocado_oil, butter, ghee, cheese_generic, cheddar_cheese, mozzarella, parmesan, cream_cheese, sour_cream, tomato_sauce, marinara, alfredo_sauce, bolognese, bbq_sauce, ketchup, mayo, ranch, aioli, hot_sauce, mustard, soy_sauce, teriyaki_sauce, sriracha, peanut_butter, almond_butter, nuts_mixed, walnuts, almonds, cashews, trail_mix, avocado, guacamole, pesto, hummus, tahini, olive_tapenade, coconut_oil, sesame_oil, vinaigrette, italian_dressing, caesar_dressing, blue_cheese_dressing, honey_mustard, buffalo_sauce, gravy, cheese_sauce, chili_oil, maple_syrup, chocolate_sauce, ice_cream, whipped_cream, bacon_bits, croutons, butter_sauce, garlic_butter

VEGETABLES (50):
broccoli, green_beans, asparagus, spinach, kale, mixed_vegetables, salad_plain, carrots, zucchini, brussels_sprouts, cauliflower, cabbage, bell_peppers, onions, mushrooms, tomatoes, cucumber, lettuce, arugula, bok_choy, broccolini, snap_peas, peas, corn, sweet_corn, eggplant, okra, beets, celery, radish, sauerkraut, pickles, jalapenos, garlic, ginger, spring_mix, coleslaw_plain, coleslaw_creamy, salsa, pico_de_gallo, kimchi, seaweed_salad, edamame_side, butternut_squash, pumpkin, parsnips, turnips, artichoke, leeks, fajita_veggies, stir_fry_veggies

Return JSON only:
{"items":[{"name":"","category":"","grams":{"min":0,"median":0,"max":0},"bone_in":false,"fried_breaded":false,"pan_seared":false,"oil_present":false}],"confidence":0}`;

      const callAResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: promptA,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${enhancedBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_completion_tokens: 900,
      });

      const callAFinish = callAResponse.choices[0]?.finish_reason;
      let callAContent = callAResponse.choices[0]?.message?.content || "";
      console.log("[Photo] Call A finish_reason:", callAFinish, "length:", callAContent.length);
      
      if (!callAContent || callAContent.trim().length === 0) {
        return res.json({
          success: false,
          message: "AI could not process the image. Please try a clearer photo or enter details manually.",
          requiresManualEntry: true,
        });
      }
      
      callAContent = callAContent.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      
      let identifiedItems;
      try {
        identifiedItems = JSON.parse(callAContent);
      } catch (parseError) {
        console.error("[Photo] Call A parse failed:", callAContent.substring(0, 500));
        return res.json({
          success: false,
          message: "Could not identify food items. Please enter details manually.",
          requiresManualEntry: true,
        });
      }

      console.log("[Photo] Call A identified", identifiedItems.items?.length, "items");
      for (const item of (identifiedItems.items || [])) {
        console.log(`[Photo] Item: "${item.name}" category=${item.category} grams=${JSON.stringify(item.grams)} bone_in=${item.bone_in} pan_seared=${item.pan_seared} sauce=${item.sauce_type} sauce_tbsp=${JSON.stringify(item.sauce_tbsp)}`);
      }

      if (!identifiedItems.items || identifiedItems.items.length === 0) {
        return res.json({
          success: false,
          message: "No food items identified. Please enter details manually.",
          requiresManualEntry: true,
        });
      }

      // Derive mode from user's fitness goal
      const userId = (req as any).userId;
      let mode = "maintenance";
      try {
        const user = await getUserById(userId);
        if (user?.goal) {
          const g = user.goal.toLowerCase();
          if (g.includes("lose") || g.includes("cut") || g.includes("lean")) {
            mode = "lean";
          } else if (g.includes("bulk") || g.includes("muscle") || g.includes("strength") || g.includes("gain")) {
            mode = "bulk";
          }
        }
      } catch (e) {
        console.log("[Photo] Could not fetch user goal, defaulting to maintenance");
      }
      console.log("[Photo] Mode:", mode);

      // SERVER-SIDE MACRO CALCULATION (replaces Call B)
      // Deterministic math using USDA table - no LLM guessing
      const { calculateMacros } = await import("./macroCalculator");
      const macroData = calculateMacros(identifiedItems.items, mode as "lean" | "maintenance" | "bulk");
      console.log("[Photo] Server-side calc result:", JSON.stringify(macroData.totals));

      // Map Call B results back to the response format the frontend expects
      const foodsWithNutrition = (macroData.items || []).map((item: any, idx: number) => {
        const sourceItem = identifiedItems.items[idx] || {};
        const grams = sourceItem.grams || {};
        const medianGrams = grams.median || 0;
        
        const noteParts: string[] = [];
        if (sourceItem.fried_breaded) noteParts.push("Fried/breaded");
        if (sourceItem.pan_seared) noteParts.push("Pan-seared");
        if (sourceItem.bone_in) noteParts.push("Bone-in (70% edible)");
        if (sourceItem.sauce_type && sourceItem.sauce_type !== "none") noteParts.push(`Sauce: ${sourceItem.sauce_type}`);

        return {
          name: item.name || sourceItem.name,
          category: item.category_used || sourceItem.category || "",
          servingSize: `~${medianGrams} g (~${Math.round(medianGrams / 28.35)} oz)`,
          estimatedWeightGrams: medianGrams,
          confidence: identifiedItems.confidence >= 0.7 ? "high" : identifiedItems.confidence >= 0.4 ? "medium" : "low",
          calories: Math.round(item.kcal?.median || 0),
          protein: Math.round(item.p?.median || 0),
          carbs: Math.round(item.c?.median || 0),
          fat: Math.round(item.f?.median || 0),
          fiber: 0,
          source: "ai_estimate",
          notes: noteParts.join(", "),
          min: {
            calories: Math.round(item.kcal?.min || 0),
            protein: Math.round(item.p?.min || 0),
            carbs: Math.round(item.c?.min || 0),
            fat: Math.round(item.f?.min || 0),
          },
          max: {
            calories: Math.round(item.kcal?.max || 0),
            protein: Math.round(item.p?.max || 0),
            carbs: Math.round(item.c?.max || 0),
            fat: Math.round(item.f?.max || 0),
          },
        };
      });

      const totals = macroData.totals || {};

      return res.json({
        success: true,
        foods: foodsWithNutrition,
        mode: macroData.mode || mode,
        description: `Identified ${foodsWithNutrition.length} food item(s)`,
        totalCalories: Math.round(totals.kcal?.median || foodsWithNutrition.reduce((s: number, f: any) => s + (f.calories || 0), 0)),
        totalProtein: Math.round(totals.p?.median || foodsWithNutrition.reduce((s: number, f: any) => s + (f.protein || 0), 0)),
        totalCarbs: Math.round(totals.c?.median || foodsWithNutrition.reduce((s: number, f: any) => s + (f.carbs || 0), 0)),
        totalFat: Math.round(totals.f?.median || foodsWithNutrition.reduce((s: number, f: any) => s + (f.fat || 0), 0)),
        totalMin: {
          calories: Math.round(totals.kcal?.min || foodsWithNutrition.reduce((s: number, f: any) => s + (f.min?.calories || 0), 0)),
          protein: Math.round(totals.p?.min || foodsWithNutrition.reduce((s: number, f: any) => s + (f.min?.protein || 0), 0)),
          carbs: Math.round(totals.c?.min || foodsWithNutrition.reduce((s: number, f: any) => s + (f.min?.carbs || 0), 0)),
          fat: Math.round(totals.f?.min || foodsWithNutrition.reduce((s: number, f: any) => s + (f.min?.fat || 0), 0)),
        },
        totalMax: {
          calories: Math.round(totals.kcal?.max || foodsWithNutrition.reduce((s: number, f: any) => s + (f.max?.calories || 0), 0)),
          protein: Math.round(totals.p?.max || foodsWithNutrition.reduce((s: number, f: any) => s + (f.max?.protein || 0), 0)),
          carbs: Math.round(totals.c?.max || foodsWithNutrition.reduce((s: number, f: any) => s + (f.max?.carbs || 0), 0)),
          fat: Math.round(totals.f?.max || foodsWithNutrition.reduce((s: number, f: any) => s + (f.max?.fat || 0), 0)),
        },
        warnings: macroData.warnings || [],
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
      
      if (typeof calories !== "number" || typeof protein !== "number" || typeof carbs !== "number" || typeof fat !== "number") {
        return res.status(400).json({ error: "All macro values must be numbers" });
      }
      if (calories <= 0 || protein < 0 || carbs < 0 || fat < 0) {
        return res.status(400).json({ error: "Calories must be positive, macros cannot be negative" });
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
      const { clientId, name, exercises, createdAt, lastCompletedAt, isFavorite, category } = req.body;

      if (!clientId || !name) {
        return res.status(400).json({ error: "clientId and name are required" });
      }
      if (name.length > 100) {
        return res.status(400).json({ error: "Routine name cannot exceed 100 characters" });
      }
      const exerciseList = exercises || [];
      if (exerciseList.length > 30) {
        return res.status(400).json({ error: "Routine cannot have more than 30 exercises" });
      }

      await saveRoutine(userId, { clientId, name, exercises: exerciseList, createdAt, lastCompletedAt, isFavorite, category });
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
      const { clientId, routineId, routineName, exercises, startedAt, completedAt, durationMinutes, notes, totalVolumeKg } = req.body;

      if (!clientId || !startedAt) {
        return res.status(400).json({ error: "clientId and startedAt are required" });
      }

      await saveWorkout(userId, { clientId, routineId, routineName, exercises: exercises || [], startedAt, completedAt, durationMinutes, notes, totalVolumeKg });
      
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
      const { clientId, distanceKm, durationSeconds, paceMinPerKm, calories, startedAt, completedAt, route, elevationGainM, avgHeartRate, maxHeartRate } = req.body;

      if (!clientId || !startedAt || !completedAt) {
        return res.status(400).json({ error: "clientId, startedAt, and completedAt are required" });
      }
      if (typeof distanceKm !== "number" || distanceKm <= 0) {
        return res.status(400).json({ error: "distanceKm must be a positive number" });
      }
      if (typeof durationSeconds !== "number" || durationSeconds <= 0) {
        return res.status(400).json({ error: "durationSeconds must be a positive number" });
      }

      await saveRun(userId, { clientId, distanceKm, durationSeconds, paceMinPerKm, calories, startedAt, completedAt, route, elevationGainM, avgHeartRate, maxHeartRate });
      
      // Update user's streak when completing a run
      const streak = await updateUserStreak(userId);
      res.json({ success: true, streak });
    } catch (error) {
      console.error("Error saving run:", error);
      res.status(500).json({ error: "Failed to save run" });
    }
  });

  app.delete("/api/runs/:clientId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { clientId } = req.params;
      const deleted = await deleteRun(userId, clientId);
      if (!deleted) {
        return res.status(404).json({ error: "Run not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting run:", error);
      res.status(500).json({ error: "Failed to delete run" });
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
      const { clientId, foodData, date, createdAt, imageUri, mealType } = req.body;

      if (!clientId || !foodData || !date) {
        return res.status(400).json({ error: "clientId, foodData, and date are required" });
      }

      // Prevent logging food for future dates
      const logDate = new Date(date);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      if (logDate >= tomorrow) {
        return res.status(400).json({ error: "Cannot log food for future dates" });
      }

      await saveFoodLog(userId, { clientId, foodData, date, createdAt: createdAt || new Date().toISOString(), mealType, imageUri });
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving food log:", error);
      res.status(500).json({ error: "Failed to save food log" });
    }
  });

  app.put("/api/food-logs/:clientId", requireAuth, async (req: Request<{ clientId: string }>, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { foodData } = req.body;
      if (!foodData) {
        return res.status(400).json({ error: "foodData is required" });
      }
      const updated = await updateFoodLog(userId, req.params.clientId, foodData);
      if (!updated) {
        return res.status(404).json({ error: "Food log not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating food log:", error);
      res.status(500).json({ error: "Failed to update food log" });
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

  // ========== Bulk Sync Endpoint ==========
  app.post("/api/sync/bulk", requireAuth, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { routines, workouts, runs, foodLogs, bodyWeights } = req.body;
    const synced = { routines: 0, workouts: 0, runs: 0, foodLogs: 0, bodyWeights: 0 };
    const errors: string[] = [];

    const client = await (await import("./db")).pool.connect();
    try {
      await client.query("BEGIN");

      if (Array.isArray(routines)) {
        for (const r of routines) {
          try {
            await saveRoutine(userId, r);
            synced.routines++;
          } catch (e: any) { errors.push(`routine ${r.clientId}: ${e.message}`); }
        }
      }
      if (Array.isArray(workouts)) {
        for (const w of workouts) {
          try {
            await saveWorkout(userId, w);
            synced.workouts++;
          } catch (e: any) { errors.push(`workout ${w.clientId}: ${e.message}`); }
        }
      }
      if (Array.isArray(runs)) {
        for (const r of runs) {
          try {
            await saveRun(userId, r);
            synced.runs++;
          } catch (e: any) { errors.push(`run ${r.clientId}: ${e.message}`); }
        }
      }
      if (Array.isArray(foodLogs)) {
        for (const f of foodLogs) {
          try {
            await saveFoodLog(userId, f);
            synced.foodLogs++;
          } catch (e: any) { errors.push(`foodLog ${f.clientId}: ${e.message}`); }
        }
      }
      if (Array.isArray(bodyWeights)) {
        for (const b of bodyWeights) {
          try {
            await addBodyWeight(userId, b.weightKg, new Date(b.date));
            synced.bodyWeights++;
          } catch (e: any) { errors.push(`bodyWeight: ${e.message}`); }
        }
      }

      await client.query("COMMIT");
      res.json({ synced, errors });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Bulk sync error:", error);
      res.status(500).json({ error: "Bulk sync failed" });
    } finally {
      client.release();
    }
  });

  // ========== Workout Analytics Endpoint ==========
  app.get("/api/workouts/analytics", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const period = (req.query.period as string) || "month";

      let dateFilter = "";
      if (period === "week") {
        dateFilter = "AND completed_at >= NOW() - INTERVAL '7 days'";
      } else if (period === "month") {
        dateFilter = "AND completed_at >= NOW() - INTERVAL '30 days'";
      }
      // "all" = no filter

      const { pool } = await import("./db");

      // Basic stats
      const statsResult = await pool.query(
        `SELECT
           COUNT(*)::int as total_workouts,
           COALESCE(AVG(duration_minutes), 0)::real as avg_duration,
           COALESCE(SUM(total_volume_kg), 0)::real as total_volume
         FROM workouts
         WHERE user_id = $1 AND completed_at IS NOT NULL ${dateFilter}`,
        [userId]
      );

      // Workout frequency (workouts per week)
      const freqResult = await pool.query(
        `SELECT
           COUNT(*)::real / GREATEST(
             EXTRACT(EPOCH FROM (MAX(completed_at) - MIN(completed_at))) / 604800,
             1
           ) as workouts_per_week
         FROM workouts
         WHERE user_id = $1 AND completed_at IS NOT NULL ${dateFilter}`,
        [userId]
      );

      // Muscle group breakdown from exercises JSONB
      const muscleResult = await pool.query(
        `SELECT
           exercise->>'exerciseName' as exercise_name,
           COUNT(*)::int as times_performed
         FROM workouts,
              jsonb_array_elements(exercises) as exercise
         WHERE user_id = $1 AND completed_at IS NOT NULL ${dateFilter}
         GROUP BY exercise->>'exerciseName'
         ORDER BY times_performed DESC
         LIMIT 20`,
        [userId]
      );

      const stats = statsResult.rows[0];
      res.json({
        totalWorkouts: stats.total_workouts,
        avgDurationMinutes: Math.round(stats.avg_duration),
        totalVolumeKg: Math.round(stats.total_volume * 10) / 10,
        workoutsPerWeek: Math.round((freqResult.rows[0]?.workouts_per_week || 0) * 10) / 10,
        topExercises: muscleResult.rows.map(r => ({
          name: r.exercise_name,
          count: r.times_performed,
        })),
        period,
      });
    } catch (error) {
      console.error("Error getting workout analytics:", error);
      res.status(500).json({ error: "Failed to get workout analytics" });
    }
  });

  // Personal Records endpoint
  app.get("/api/workouts/prs", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { pool } = await import("./db");

      const result = await pool.query(
        `SELECT
           exercise->>'exerciseName' as exercise_name,
           exercise->>'exerciseId' as exercise_id,
           s->>'weight' as weight,
           s->>'reps' as reps,
           w.completed_at
         FROM workouts w,
              jsonb_array_elements(w.exercises) as exercise,
              jsonb_array_elements(exercise->'sets') as s
         WHERE w.user_id = $1
           AND w.completed_at IS NOT NULL
           AND (s->>'completed')::boolean = true
           AND (s->>'weight')::real > 0`,
        [userId]
      );

      // Calculate max weight and max volume per exercise
      const exercisePRs: Record<string, {
        exerciseName: string;
        exerciseId: string;
        maxWeight: number;
        maxWeightDate: string;
        maxWeightReps: number;
        maxVolume: number;
        maxVolumeDate: string;
      }> = {};

      for (const row of result.rows) {
        const key = row.exercise_id;
        const weight = parseFloat(row.weight);
        const reps = parseInt(row.reps);
        const volume = weight * reps;
        const date = row.completed_at;

        if (!exercisePRs[key]) {
          exercisePRs[key] = {
            exerciseName: row.exercise_name,
            exerciseId: key,
            maxWeight: 0,
            maxWeightDate: "",
            maxWeightReps: 0,
            maxVolume: 0,
            maxVolumeDate: "",
          };
        }

        if (weight > exercisePRs[key].maxWeight) {
          exercisePRs[key].maxWeight = weight;
          exercisePRs[key].maxWeightDate = date;
          exercisePRs[key].maxWeightReps = reps;
        }
        if (volume > exercisePRs[key].maxVolume) {
          exercisePRs[key].maxVolume = volume;
          exercisePRs[key].maxVolumeDate = date;
        }
      }

      res.json(Object.values(exercisePRs));
    } catch (error) {
      console.error("Error getting PRs:", error);
      res.status(500).json({ error: "Failed to get personal records" });
    }
  });

  // ========== Progress Photos ==========

  app.get("/api/progress-photos", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        "SELECT client_id, image_data, date, weight_kg, notes, created_at FROM progress_photos WHERE user_id = $1 ORDER BY date DESC",
        [req.session.userId]
      );
      res.json(result.rows.map((r: any) => ({
        id: r.client_id,
        imageData: r.image_data,
        date: r.date,
        weightKg: r.weight_kg,
        notes: r.notes,
        createdAt: r.created_at,
      })));
    } catch (error) {
      console.error("Error getting progress photos:", error);
      res.status(500).json({ error: "Failed to get progress photos" });
    }
  });

  app.post("/api/progress-photos", requireAuth, async (req: Request, res: Response) => {
    try {
      const { clientId, imageData, date, weightKg, notes } = req.body;
      if (!clientId || !imageData || !date) {
        res.status(400).json({ error: "clientId, imageData, and date are required" });
        return;
      }
      await pool.query(
        `INSERT INTO progress_photos (user_id, client_id, image_data, date, weight_kg, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, client_id) DO UPDATE SET
           image_data = EXCLUDED.image_data,
           date = EXCLUDED.date,
           weight_kg = EXCLUDED.weight_kg,
           notes = EXCLUDED.notes`,
        [req.session.userId, clientId, imageData, date, weightKg || null, notes || null]
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving progress photo:", error);
      res.status(500).json({ error: "Failed to save progress photo" });
    }
  });

  app.delete("/api/progress-photos/:clientId", requireAuth, async (req: Request, res: Response) => {
    try {
      await pool.query(
        "DELETE FROM progress_photos WHERE user_id = $1 AND client_id = $2",
        [req.session.userId, req.params.clientId]
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting progress photo:", error);
      res.status(500).json({ error: "Failed to delete progress photo" });
    }
  });

  // ========== Social: Follow Routes ==========

  app.post("/api/social/follow/:userId", requireAuth, async (req: any, res: Response) => {
    try {
      const targetId = parseInt(req.params.userId);
      if (isNaN(targetId) || targetId === req.userId) {
        return res.status(400).json({ error: "Invalid user" });
      }
      const success = await followUser(req.userId, targetId);
      res.json({ success });
    } catch (error) {
      console.error("Error following user:", error);
      res.status(500).json({ error: "Failed to follow user" });
    }
  });

  app.delete("/api/social/follow/:userId", requireAuth, async (req: any, res: Response) => {
    try {
      const targetId = parseInt(req.params.userId);
      if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user" });
      const success = await unfollowUser(req.userId, targetId);
      res.json({ success });
    } catch (error) {
      console.error("Error unfollowing user:", error);
      res.status(500).json({ error: "Failed to unfollow user" });
    }
  });

  app.get("/api/social/followers/:userId", requireAuth, async (req: any, res: Response) => {
    try {
      const targetId = parseInt(req.params.userId);
      const page = parseInt(req.query.page as string) || 0;
      const followers = await getFollowers(targetId, req.userId, page, 20);
      res.json(followers);
    } catch (error) {
      console.error("Error getting followers:", error);
      res.status(500).json({ error: "Failed to get followers" });
    }
  });

  app.get("/api/social/following/:userId", requireAuth, async (req: any, res: Response) => {
    try {
      const targetId = parseInt(req.params.userId);
      const page = parseInt(req.query.page as string) || 0;
      const following = await getFollowing(targetId, req.userId, page, 20);
      res.json(following);
    } catch (error) {
      console.error("Error getting following:", error);
      res.status(500).json({ error: "Failed to get following" });
    }
  });

  // ========== Social: Post Routes ==========

  app.get("/api/social/feed", requireAuth, async (req: any, res: Response) => {
    try {
      const cursor = req.query.cursor as string | undefined;
      const result = await getFeedPosts(req.userId, cursor);
      res.json(result);
    } catch (error) {
      console.error("Error getting feed:", error);
      res.status(500).json({ error: "Failed to get feed" });
    }
  });

  app.post("/api/social/posts", requireAuth, async (req: any, res: Response) => {
    try {
      const { clientId, postType, content, referenceId, referenceData, imageData, visibility } = req.body;
      if (!clientId || !postType) {
        return res.status(400).json({ error: "clientId and postType are required" });
      }
      const postId = await createPost(req.userId, { clientId, postType, content, referenceId, referenceData, imageData, visibility });
      res.json({ success: true, postId });
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  app.get("/api/social/posts/:postId", requireAuth, async (req: any, res: Response) => {
    try {
      const postId = parseInt(req.params.postId);
      if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });
      const post = await getPost(postId, req.userId);
      if (!post) return res.status(404).json({ error: "Post not found" });
      res.json(post);
    } catch (error) {
      console.error("Error getting post:", error);
      res.status(500).json({ error: "Failed to get post" });
    }
  });

  app.delete("/api/social/posts/:postId", requireAuth, async (req: any, res: Response) => {
    try {
      const postId = parseInt(req.params.postId);
      if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });
      const success = await deletePost(req.userId, postId);
      if (!success) return res.status(404).json({ error: "Post not found or not owned" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ error: "Failed to delete post" });
    }
  });

  app.get("/api/social/posts/user/:userId", requireAuth, async (req: any, res: Response) => {
    try {
      const targetId = parseInt(req.params.userId);
      const cursor = req.query.cursor as string | undefined;
      if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user ID" });

      // Privacy check: non-public profiles hidden from non-followers
      if (targetId !== req.userId) {
        const profile = await getSocialProfile(targetId, req.userId);
        if (profile && !profile.isPublic && !profile.isFollowedByMe) {
          return res.json({ posts: [], nextCursor: undefined });
        }
      }

      const result = await getUserPosts(targetId, req.userId, cursor);
      res.json(result);
    } catch (error) {
      console.error("Error getting user posts:", error);
      res.status(500).json({ error: "Failed to get user posts" });
    }
  });

  // ========== Social: Like Routes ==========

  app.post("/api/social/posts/:postId/like", requireAuth, async (req: any, res: Response) => {
    try {
      const postId = parseInt(req.params.postId);
      if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });
      const success = await likePost(req.userId, postId);
      res.json({ success });
    } catch (error) {
      console.error("Error liking post:", error);
      res.status(500).json({ error: "Failed to like post" });
    }
  });

  app.delete("/api/social/posts/:postId/like", requireAuth, async (req: any, res: Response) => {
    try {
      const postId = parseInt(req.params.postId);
      if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });
      const success = await unlikePost(req.userId, postId);
      res.json({ success });
    } catch (error) {
      console.error("Error unliking post:", error);
      res.status(500).json({ error: "Failed to unlike post" });
    }
  });

  // ========== Social: Comment Routes ==========

  app.get("/api/social/posts/:postId/comments", requireAuth, async (req: any, res: Response) => {
    try {
      const postId = parseInt(req.params.postId);
      const page = parseInt(req.query.page as string) || 0;
      if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });
      const comments = await getPostComments(postId, page, 20);
      res.json(comments);
    } catch (error) {
      console.error("Error getting comments:", error);
      res.status(500).json({ error: "Failed to get comments" });
    }
  });

  app.post("/api/social/posts/:postId/comments", requireAuth, async (req: any, res: Response) => {
    try {
      const postId = parseInt(req.params.postId);
      const { clientId, content } = req.body;
      if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });
      if (!clientId || !content?.trim()) return res.status(400).json({ error: "clientId and content are required" });
      const comment = await addComment(req.userId, postId, clientId, content.trim());
      res.json(comment);
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  app.delete("/api/social/comments/:commentId", requireAuth, async (req: any, res: Response) => {
    try {
      const commentId = parseInt(req.params.commentId);
      if (isNaN(commentId)) return res.status(400).json({ error: "Invalid comment ID" });
      const success = await deleteComment(req.userId, commentId);
      if (!success) return res.status(404).json({ error: "Comment not found or not owned" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // ========== Social: User Discovery & Profile ==========

  app.get("/api/social/users/search", requireAuth, async (req: any, res: Response) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (query.length < 2) return res.json([]);
      const users = await searchUsers(query, req.userId);
      res.json(users);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  app.get("/api/social/users/:userId/profile", requireAuth, async (req: any, res: Response) => {
    try {
      const targetId = parseInt(req.params.userId);
      if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user ID" });
      const profile = await getSocialProfile(targetId, req.userId);
      if (!profile) return res.status(404).json({ error: "User not found" });
      res.json(profile);
    } catch (error) {
      console.error("Error getting social profile:", error);
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  app.put("/api/social/profile", requireAuth, async (req: any, res: Response) => {
    try {
      const { bio, avatarUrl, isPublic } = req.body;
      await updateSocialProfile(req.userId, { bio, avatarUrl, isPublic });
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating social profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
