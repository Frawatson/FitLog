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
  getNotificationPrefs, saveNotificationPrefs,
  getUserById
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

      // CALL A: Vision - identify food items, categorize, and estimate grams
      const promptA = `Analyze this food photo for a bodybuilding-focused macro tracker.

STRICT RULES:
- Identify visible items only.
- Output COOKED edible grams (exclude bones, shells, packaging). If bone-in, set bone_in=true.
- Choose category ONLY from APPROVED_LIST. If uncertain, choose the closest match. Do NOT invent categories.
- If fried/breaded, set fried_breaded=true.
- If pan-seared meat and visible oil sheen/pooling, set pan_seared=true and oil_present=true.
- If sauce is visible, estimate sauce_tbsp (min/median/max) and set sauce_type from ["none","bbq","mayo_ranch","ketchup","hot_sauce","unknown"].

APPROVED_LIST:

PROTEINS (50):
chicken_breast_grilled, chicken_breast_pan_seared, chicken_thigh, chicken_fried_breaded, ground_beef_lean, ground_beef_regular, steak_lean, steak_moderate, steak_fatty, pork_chop_lean, pork_chop_moderate, pork_chop_fatty, salmon, white_fish, tilapia, tuna, turkey_breast, ground_turkey_lean, ground_turkey_regular, shrimp, egg_whole, egg_whites, tofu, tempeh, protein_bar, protein_powder, greek_yogurt_plain, greek_yogurt_flavored, cottage_cheese, beef_jerky, ham, bacon, sausage, lamb, venison, crab, lobster, sardines, mackerel, whey_shake_ready_to_drink, casein_shake, edamame, beans_chili, chicken_sausage, turkey_bacon, deli_chicken, deli_turkey, ground_bison, bison_steak, pork_tenderloin

CARBS (50):
white_rice, brown_rice, jasmine_rice, basmati_rice, rice_mix, sweet_potato, white_potato, mashed_potatoes, baked_potato, fries_fried, oats_cooked, oats_overnight, pasta_cooked, quinoa, couscous, black_beans, kidney_beans, lentils, chickpeas, tortilla_flour, tortilla_corn, bagel_plain, bread_white, bread_wheat, wrap_flatbread, burger_bun, english_muffin, pancakes, waffles, cereal, granola, rice_cakes, banana, apple, berries, grapes, orange, mango, pineapple, mixed_fruit, yogurt_parfait, protein_cookie, pretzels, popcorn, crackers, ramen_noodles, udon_noodles, sushi_rice, honey, jam_jelly, dates

FATS/SAUCES (50):
olive_oil, avocado_oil, butter, ghee, cheese_generic, cheddar_cheese, mozzarella, parmesan, cream_cheese, sour_cream, bbq_sauce, ketchup, mayo, ranch, aioli, hot_sauce, mustard, soy_sauce, teriyaki_sauce, sriracha, peanut_butter, almond_butter, nuts_mixed, walnuts, almonds, cashews, trail_mix, avocado, guacamole, pesto, hummus, tahini, olive_tapenade, coconut_oil, sesame_oil, vinaigrette, italian_dressing, caesar_dressing, blue_cheese_dressing, honey_mustard, buffalo_sauce, gravy, cheese_sauce, chili_oil, maple_syrup, chocolate_sauce, ice_cream, whipped_cream, bacon_bits, croutons, butter_sauce, garlic_butter

VEGETABLES (50):
broccoli, green_beans, asparagus, spinach, kale, mixed_vegetables, salad_plain, carrots, zucchini, brussels_sprouts, cauliflower, cabbage, bell_peppers, onions, mushrooms, tomatoes, cucumber, lettuce, arugula, bok_choy, broccolini, snap_peas, peas, corn, sweet_corn, eggplant, okra, beets, celery, radish, sauerkraut, pickles, jalapenos, garlic, ginger, spring_mix, coleslaw_plain, coleslaw_creamy, salsa, pico_de_gallo, kimchi, seaweed_salad, edamame_side, butternut_squash, pumpkin, parsnips, turnips, artichoke, leeks, fajita_veggies, stir_fry_veggies

Return JSON only:
{"items":[{"name":"","category":"","grams":{"min":0,"median":0,"max":0},"bone_in":false,"fried_breaded":false,"pan_seared":false,"oil_present":false,"sauce_type":"none","sauce_tbsp":{"min":0,"median":0,"max":0}}],"confidence":0}`;

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
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: "auto",
                },
              },
            ],
          },
        ],
        max_completion_tokens: 500,
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

      // CALL B: Text-only - calculate macros using built-in macro table
      // Use gpt-4o-mini for fast, cheap text-only macro math (no reasoning overhead)
      const promptB = `Compute macros from the detected items using ONLY the macro table below. No external lookups.

INPUTS:
- mode: "${mode}"
- items[] from Prompt A

MACRO_TABLE (per 100g unless noted):
PROTEINS:
chicken_breast_grilled: kcal165 P31 C0 F4
chicken_breast_pan_seared: kcal190 P30 C0 F8
chicken_thigh: kcal215 P24 C0 F13
chicken_fried_breaded: kcal280 P23 C16 F16
ground_beef_lean: kcal200 P26 C0 F10
ground_beef_regular: kcal254 P26 C0 F16
steak_lean: kcal200 P27 C0 F10
steak_moderate: kcal250 P26 C0 F16
steak_fatty: kcal310 P24 C0 F24
pork_chop_lean: kcal200 P27 C0 F9
pork_chop_moderate: kcal250 P26 C0 F17
pork_chop_fatty: kcal310 P23 C0 F25
salmon: kcal208 P22 C0 F13
white_fish: kcal120 P24 C0 F2
tilapia: kcal128 P26 C0 F3
tuna: kcal132 P29 C0 F1
turkey_breast: kcal135 P29 C0 F2
ground_turkey_lean: kcal170 P24 C0 F8
ground_turkey_regular: kcal220 P23 C0 F14
shrimp: kcal100 P24 C0 F1
egg_whole: kcal143 P13 C1 F10
egg_whites: kcal52 P11 C1 F0
tofu: kcal90 P10 C2 F5
tempeh: kcal190 P19 C9 F11
greek_yogurt_plain: kcal60 P10 C4 F0
greek_yogurt_flavored: kcal95 P9 C12 F1
cottage_cheese: kcal98 P11 C3 F4
beef_jerky: kcal300 P40 C10 F8
protein_bar: kcal360 P25 C35 F10
protein_powder: kcal400 P80 C10 F6
(If category not listed above but is a protein, default to: kcal200 P25 C0 F10)

CARBS:
white_rice: kcal130 P2.7 C28 F0.3
brown_rice: kcal112 P2.3 C23 F0.9
jasmine_rice: kcal130 P2.7 C28 F0.3
basmati_rice: kcal125 P2.6 C27 F0.3
sweet_potato: kcal90 P2 C21 F0.1
white_potato: kcal87 P2 C20 F0.1
mashed_potatoes: kcal110 P2 C17 F4
baked_potato: kcal93 P2.5 C21 F0.1
fries_fried: kcal320 P3.5 C41 F15
oats_cooked: kcal70 P2.5 C12 F1.5
pasta_cooked: kcal131 P5 C25 F1.1
quinoa: kcal120 P4 C21 F2
black_beans: kcal132 P9 C24 F0.5
lentils: kcal116 P9 C20 F0.4
tortilla_flour: kcal300 P8 C50 F8
bread_white: kcal265 P9 C49 F3.2
bread_wheat: kcal250 P9 C43 F4
burger_bun: kcal270 P9 C50 F4
rice_cakes: kcal387 P8 C82 F3
banana: kcal89 P1.1 C23 F0.3
berries: kcal50 P1 C12 F0.3
mixed_fruit: kcal60 P0.8 C15 F0.2
(If category not listed above but is a carb, default to: kcal130 P3 C28 F1)

VEGETABLES:
vegetables_default: kcal35 P2 C7 F0.3
(broccoli/green_beans/asparagus/spinach/kale/mixed_vegetables/salad_plain/etc use vegetables_default unless creamy slaw)
coleslaw_creamy: kcal150 P1 C14 F10
pickles: kcal15 P0.5 C3 F0

SAUCES/FATS:
olive_oil (per 1 tbsp): kcal120 P0 C0 F14
butter (per 1 tbsp): kcal100 P0 C0 F11
bbq_sauce (per 1 tbsp): kcal40 P0 C10 F0
ketchup (per 1 tbsp): kcal20 P0 C5 F0
hot_sauce (per 1 tbsp): kcal5 P0 C1 F0
mayo_ranch_sauce (per 1 tbsp): kcal100 P0 C1 F11
(If sauce_type unknown and sauce_tbsp>0, use mayo_ranch_sauce)

LEAN/BULK ADJUSTMENT LAYER:
A) Portion bias on grams.median ONLY:
- lean: grams_median *= 0.95
- maintenance: *= 1.00
- bulk: *= 1.05

B) Meat leanness bias (only for beef/pork/steak/ground_*):
- lean: fatty->moderate, moderate->lean
- maintenance: no change
- bulk: lean->moderate, moderate->fatty

C) Pan-seared oil add-on (only if pan_seared=true AND fried_breaded=false):
Oil tbsp by mode:
- lean: min 0, median 0.5, max 1.0
- maintenance: min 0, median 1.0, max 1.5
- bulk: min 0.5, median 1.5, max 2.0

D) Sauce bias on sauce_tbsp.median ONLY:
- lean *= 0.80
- maintenance *= 1.00
- bulk *= 1.20

E) Bone-in edible grams:
If bone_in=true, edible_grams = grams * 0.70 (apply after portion bias).

CALC RULES:
1) For each item, compute min/median/max using grams(min/median/max) with the adjustments above (median gets mode bias; min/max stay as-is except bone and oil/sauce rules).
2) If fried_breaded=true: do NOT add oil.
3) Add sauce macros using sauce_type and sauce_tbsp.
4) Calorie check: ensure |(P*4 + C*4 + F*9) - kcal| / kcal <= 10%. If not, adjust oil first, then sauce, then grams within min/max and add a warning.

Items: ${JSON.stringify(identifiedItems.items)}

Return JSON only:
{"mode":"${mode}","items":[{"name":"","category_used":"","kcal":{"min":0,"median":0,"max":0},"p":{"min":0,"median":0,"max":0},"c":{"min":0,"median":0,"max":0},"f":{"min":0,"median":0,"max":0}}],"totals":{"kcal":{"min":0,"median":0,"max":0},"p":{"min":0,"median":0,"max":0},"c":{"min":0,"median":0,"max":0},"f":{"min":0,"median":0,"max":0}},"confidence":0,"warnings":[]}`;

      const callBResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a nutrition calculator. Return only valid JSON, no explanation or markdown."
          },
          {
            role: "user",
            content: promptB,
          },
        ],
        max_tokens: 1500,
      });

      const callBFinish = callBResponse.choices[0]?.finish_reason;
      let callBContent = callBResponse.choices[0]?.message?.content || "";
      console.log("[Photo] Call B finish_reason:", callBFinish, "length:", callBContent.length);
      callBContent = callBContent.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

      let macroData;
      try {
        macroData = JSON.parse(callBContent);
      } catch (parseError) {
        console.error("[Photo] Call B parse failed. Raw:", callBContent.substring(0, 500));
        // Try to recover truncated JSON by closing open brackets/braces
        let recovered = callBContent;
        const openBraces = (recovered.match(/\{/g) || []).length;
        const closeBraces = (recovered.match(/\}/g) || []).length;
        const openBrackets = (recovered.match(/\[/g) || []).length;
        const closeBrackets = (recovered.match(/\]/g) || []).length;
        // Remove trailing incomplete key-value pairs
        recovered = recovered.replace(/,\s*"[^"]*"?\s*:?\s*[^}\]]*$/, "");
        recovered = recovered.replace(/,\s*\{[^}]*$/, "");
        for (let i = 0; i < openBrackets - closeBrackets; i++) recovered += "]";
        for (let i = 0; i < openBraces - closeBraces; i++) recovered += "}";
        try {
          macroData = JSON.parse(recovered);
          console.log("[Photo] Call B recovered from truncated JSON");
        } catch (e2) {
          console.error("[Photo] Call B recovery also failed");
          return res.json({
            success: false,
            message: "Could not calculate nutrition. Please enter details manually.",
            requiresManualEntry: true,
          });
        }
      }

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
