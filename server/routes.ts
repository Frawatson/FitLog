import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import sharp from "sharp";
// exerciseDatabase import removed — using exercise_gif_cache (ExerciseDB) as the sole exercise source
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
  getExerciseGifCache, saveExerciseGifCache, bulkSaveExerciseMetadata, getExerciseGifDataById, fuzzySearchExerciseGifCache,
  blockUser, unblockUser, getBlockedUsers, isBlocked, reportContent,
  createNotification, getNotifications, markNotificationsRead, getUnreadNotificationCount,
  updatePost, updateComment,
} from "./db";
import { requireAuth } from "./auth";


// Map frontend muscle group IDs to ExerciseDB body_part / target_muscle search terms
const MUSCLE_SEARCH_TERMS: Record<string, string[]> = {
  chest: ["pectorals", "chest"],
  shoulders: ["delts", "shoulders"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearms"],
  lats: ["lats", "back"],
  middle_back: ["upper back", "back"],
  lower_back: ["spine", "back"],
  traps: ["traps"],
  abs: ["abs", "waist"],
  quadriceps: ["quads", "upper legs"],
  hamstrings: ["hamstrings", "upper legs"],
  glutes: ["glutes", "upper legs"],
  calves: ["calves", "lower legs"],
};

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

  // Exercise library - returns all exercises from cache with GIF status
  app.get("/api/exercises/library", async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT exercise_name, body_part, equipment, target_muscle, gif_data IS NOT NULL AS has_gif
         FROM exercise_gif_cache
         ORDER BY exercise_name ASC`
      );
      const exercises = result.rows.map(row => ({
        name: row.exercise_name,
        bodyPart: row.body_part,
        equipment: row.equipment,
        targetMuscle: row.target_muscle,
        hasGif: row.has_gif,
      }));
      res.json(exercises);
    } catch (error) {
      console.error("Error fetching exercise library:", error);
      res.status(500).json({ error: "Failed to fetch exercise library" });
    }
  });

  // Exercise GIF / demo info endpoint
  // Exercise info lookup (cache + local fallback)
  app.get("/api/exercises/gif", async (req: Request, res: Response) => {
    try {
      const { name } = req.query;
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "Exercise name is required" });
      }

      const exerciseName = name.trim();

      // 1. Check database cache by exact name
      const cached = await getExerciseGifCache(exerciseName);
      if (cached?.gifUrl) {
        const { gifData, ...rest } = cached;
        return res.json({ ...rest, source: "cache" });
      }

      // 2. Fuzzy search cache for entries with GIF data (e.g. "Squat" → "Bodyweight Squats")
      const fuzzy = await fuzzySearchExerciseGifCache(exerciseName);
      if (fuzzy?.gifUrl) {
        const { gifData, ...rest } = fuzzy;
        return res.json({ ...rest, exerciseName, source: "cache" });
      }

      // 3. No match found in ExerciseDB cache
      res.json({
        exerciseName,
        gifUrl: null,
        bodyPart: null,
        equipment: null,
        targetMuscle: null,
        instructions: null,
        source: "not_found",
      });
    } catch (error) {
      console.error("Error fetching exercise GIF:", error);
      res.status(500).json({ error: "Failed to fetch exercise info" });
    }
  });

  // Serve exercise GIF images from database
  app.get("/api/exercises/image/:exerciseId", async (req: Request, res: Response) => {
    try {
      const gifData = await getExerciseGifDataById(req.params.exerciseId);
      if (!gifData) return res.status(404).send("Image not found");

      const buffer = Buffer.from(gifData, "base64");
      res.setHeader("Content-Type", "image/gif");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(buffer);
    } catch {
      res.status(500).send("Failed to fetch image");
    }
  });


  // Bulk seed ALL exercises from ExerciseDB (metadata only, no GIFs)
  app.post("/api/admin/seed-all-exercises", async (req: Request, res: Response) => {
    const adminSecret = process.env.ADMIN_SECRET;
    const providedSecret = req.headers["x-admin-secret"];
    if (!adminSecret || providedSecret !== adminSecret) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const apiKey = process.env.EXERCISEDB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "EXERCISEDB_API_KEY not configured" });
    }

    try {
      const response = await fetch(
        "https://exercisedb.p.rapidapi.com/exercises?limit=0",
        {
          headers: {
            "X-RapidAPI-Key": apiKey,
            "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
          },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        return res.status(502).json({ error: `ExerciseDB API returned ${response.status}`, message: text });
      }

      const exercises = await response.json();
      if (!Array.isArray(exercises)) {
        return res.status(502).json({ error: "Unexpected API response format" });
      }

      const mapped = exercises.map((ex: any) => ({
        exerciseName: ex.name,
        bodyPart: ex.bodyPart || null,
        equipment: ex.equipment || null,
        targetMuscle: ex.target || null,
        instructions: Array.isArray(ex.instructions) ? ex.instructions.join("\n") : null,
        exerciseDbId: String(ex.id),
      }));

      const results = await bulkSaveExerciseMetadata(mapped);

      // Clean up old local-only exercises that have no ExerciseDB match
      const cleanup = await pool.query(
        `DELETE FROM exercise_gif_cache WHERE exercisedb_id IS NULL`
      );

      res.json({ totalFromApi: exercises.length, ...results, removedLegacy: cleanup.rowCount });
    } catch (err: any) {
      console.error("[seed-all-exercises] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Download GIF binaries for exercises that have metadata but no gif_data
  app.post("/api/admin/download-exercise-gifs", async (req: Request, res: Response) => {
    const adminSecret = process.env.ADMIN_SECRET;
    const providedSecret = req.headers["x-admin-secret"];
    if (!adminSecret || providedSecret !== adminSecret) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const apiKey = process.env.EXERCISEDB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "EXERCISEDB_API_KEY not configured" });
    }

    const batchLimit = parseInt(req.body?.limit as string) || 50;
    const delayMs = parseInt(req.body?.delayMs as string) || 500;

    const pending = await pool.query(
      `SELECT exercise_name, exercisedb_id
       FROM exercise_gif_cache
       WHERE exercisedb_id IS NOT NULL
         AND (gif_data IS NULL OR gif_data = '')
       ORDER BY exercise_name ASC
       LIMIT $1`,
      [batchLimit]
    );

    if (pending.rows.length === 0) {
      const total = await pool.query(`SELECT COUNT(*)::int as count FROM exercise_gif_cache`);
      return res.json({ message: "All exercises already have GIFs", pending: 0, total: total.rows[0].count });
    }

    const totalPending = await pool.query(
      `SELECT COUNT(*)::int as count FROM exercise_gif_cache
       WHERE exercisedb_id IS NOT NULL AND (gif_data IS NULL OR gif_data = '')`
    );

    let success = 0;
    let failed = 0;
    const failures: string[] = [];

    for (const row of pending.rows) {
      try {
        const imgRes = await fetch(
          `https://exercisedb.p.rapidapi.com/image?exerciseId=${row.exercisedb_id}&resolution=180&rapidapi-key=${apiKey}`
        );

        if (imgRes.status === 429) {
          return res.json({
            rateLimited: true,
            success,
            failed,
            remaining: totalPending.rows[0].count - success,
            message: "API rate limit reached. Re-run later to continue.",
            failures,
          });
        }

        if (!imgRes.ok) {
          failed++;
          if (failures.length < 20) failures.push(`${row.exercise_name}: HTTP ${imgRes.status}`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }

        const buffer = Buffer.from(await imgRes.arrayBuffer());
        const gifData = buffer.toString("base64");

        await pool.query(
          `UPDATE exercise_gif_cache
           SET gif_data = $1, gif_url = $2
           WHERE exercisedb_id = $3`,
          [gifData, `/api/exercises/image/${row.exercisedb_id}`, row.exercisedb_id]
        );

        success++;
        console.log(`[GIF Download] ${success}/${pending.rows.length} - ${row.exercise_name} OK`);
      } catch (err: any) {
        failed++;
        if (failures.length < 20) failures.push(`${row.exercise_name}: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, delayMs));
    }

    res.json({
      success,
      failed,
      totalPending: totalPending.rows[0].count,
      remaining: totalPending.rows[0].count - success,
      failures,
    });
  });

  // Check exercise seed status
  app.get("/api/admin/exercise-seed-status", async (req: Request, res: Response) => {
    const adminSecret = process.env.ADMIN_SECRET;
    const providedSecret = req.headers["x-admin-secret"];
    if (!adminSecret || providedSecret !== adminSecret) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const result = await pool.query(`
      SELECT
        COUNT(*)::int as total,
        COUNT(gif_data)::int as "withGifs",
        COUNT(*) FILTER (WHERE gif_data IS NULL AND exercisedb_id IS NOT NULL)::int as "pendingGifs",
        COUNT(*) FILTER (WHERE exercisedb_id IS NULL)::int as "noApiId",
        COUNT(DISTINCT body_part) FILTER (WHERE body_part IS NOT NULL)::int as "bodyParts",
        COUNT(DISTINCT equipment) FILTER (WHERE equipment IS NOT NULL)::int as "equipmentTypes"
      FROM exercise_gif_cache
    `);

    res.json(result.rows[0]);
  });

  // Generate routine - creates a balanced workout from exercise_gif_cache
  app.post("/api/generate-routine", requireAuth, async (req, res) => {
    try {
      const { muscleGroups, difficulty, name, equipment } = req.body;

      if (!muscleGroups || !Array.isArray(muscleGroups) || muscleGroups.length === 0) {
        return res.status(400).json({ error: "At least one muscle group is required" });
      }

      const difficultyLevel = difficulty === "beginner" ? "beginner" : difficulty === "advanced" || difficulty === "expert" ? "advanced" : "intermediate";
      const exercisesPerMuscle = muscleGroups.length <= 2 ? 4 : 3;
      const sets = difficultyLevel === "beginner" ? 3 : difficultyLevel === "intermediate" ? 4 : 5;
      const restSeconds = difficultyLevel === "beginner" ? 90 : difficultyLevel === "intermediate" ? 60 : 45;

      const routineExercises: any[] = [];
      const usedExerciseNames = new Set<string>();

      // Build equipment filter if user selected specific equipment
      const equipmentFilter = equipment && equipment.length > 0
        ? equipment.map((e: string) => e.toLowerCase())
        : null;

      for (const muscle of muscleGroups) {
        const muscleLower = String(muscle).toLowerCase();
        const searchTerms = MUSCLE_SEARCH_TERMS[muscleLower] || [muscleLower.replace("_", " ")];

        // Build WHERE conditions for all search terms
        const conditions = searchTerms.flatMap((term: string, i: number) => [
          `LOWER(target_muscle) = $${i + 1}`,
          `LOWER(body_part) = $${i + 1}`,
        ]).join(" OR ");

        let query = `SELECT exercise_name, body_part, equipment, target_muscle, instructions
           FROM exercise_gif_cache
           WHERE exercisedb_id IS NOT NULL
             AND (${conditions})
           ORDER BY RANDOM()
           LIMIT $${searchTerms.length + 1}`;

        const params: any[] = [...searchTerms, exercisesPerMuscle * 3];

        const cacheResult = await pool.query(query, params);

        let muscleExercisesCount = 0;
        for (const row of cacheResult.rows) {
          if (muscleExercisesCount >= exercisesPerMuscle) break;
          if (usedExerciseNames.has(row.exercise_name.toLowerCase())) continue;

          // Filter by equipment if specified
          if (equipmentFilter) {
            const exEquipment = (row.equipment || "").toLowerCase();
            const matchesEquipment = equipmentFilter.some((eq: string) =>
              exEquipment.includes(eq) || eq.includes(exEquipment)
            );
            if (!matchesEquipment) continue;
          }

          usedExerciseNames.add(row.exercise_name.toLowerCase());
          routineExercises.push({
            id: `gen-${Date.now()}-${routineExercises.length}`,
            name: row.exercise_name,
            muscleGroup: muscle.charAt(0).toUpperCase() + muscle.slice(1).replace("_", " "),
            equipment: row.equipment || "body weight",
            sets,
            reps: "10",
            restSeconds,
            instructions: row.instructions,
          });
          muscleExercisesCount++;
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

  // ========== Social: Follow Routes ==========

  app.post("/api/social/follow/:userId", requireAuth, async (req: any, res: Response) => {
    try {
      const targetId = parseInt(req.params.userId);
      if (isNaN(targetId) || targetId === req.userId) {
        return res.status(400).json({ error: "Invalid user" });
      }
      const success = await followUser(req.userId, targetId);
      if (success) {
        const user = await getUserById(req.userId);
        createNotification(targetId, "follow", req.userId, null, `${user?.name || "Someone"} started following you`).catch(() => {});
      }
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
      res.json({ ...result, serverTime: new Date().toISOString() });
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
      res.json({ ...post, serverTime: new Date().toISOString() });
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
      res.json({ ...result, serverTime: new Date().toISOString() });
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
      if (success) {
        const post = await getPost(postId, req.userId);
        if (post) {
          const user = await getUserById(req.userId);
          createNotification(post.userId, "like", req.userId, postId, `${user?.name || "Someone"} liked your post`).catch(() => {});
        }
      }
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
      const comments = await getPostComments(postId, req.userId, page, 20);
      res.json({ comments, serverTime: new Date().toISOString() });
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
      // Notify post author about the comment
      const post = await getPost(postId, req.userId);
      if (post && post.userId !== req.userId) {
        const user = await getUserById(req.userId);
        createNotification(post.userId, "comment", req.userId, postId, `${user?.name || "Someone"} commented on your post`).catch(() => {});
      }
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

  // ========== Social: Block & Report ==========

  app.post("/api/social/block/:userId", requireAuth, async (req: any, res: Response) => {
    try {
      const targetId = parseInt(req.params.userId);
      if (isNaN(targetId) || targetId === req.userId) {
        return res.status(400).json({ error: "Invalid user" });
      }
      await blockUser(req.userId, targetId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error blocking user:", error);
      res.status(500).json({ error: "Failed to block user" });
    }
  });

  app.delete("/api/social/block/:userId", requireAuth, async (req: any, res: Response) => {
    try {
      const targetId = parseInt(req.params.userId);
      if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user" });
      await unblockUser(req.userId, targetId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unblocking user:", error);
      res.status(500).json({ error: "Failed to unblock user" });
    }
  });

  app.get("/api/social/blocked", requireAuth, async (req: any, res: Response) => {
    try {
      const users = await getBlockedUsers(req.userId);
      res.json(users);
    } catch (error) {
      console.error("Error getting blocked users:", error);
      res.status(500).json({ error: "Failed to get blocked users" });
    }
  });

  app.post("/api/social/report", requireAuth, async (req: any, res: Response) => {
    try {
      const { reportType, targetId, reason, details } = req.body;
      if (!reportType || !targetId || !reason) {
        return res.status(400).json({ error: "reportType, targetId, and reason are required" });
      }
      if (!["post", "comment", "user"].includes(reportType)) {
        return res.status(400).json({ error: "reportType must be post, comment, or user" });
      }
      if (!["spam", "harassment", "inappropriate", "other"].includes(reason)) {
        return res.status(400).json({ error: "Invalid reason" });
      }
      await reportContent(req.userId, reportType, targetId, reason, details);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reporting content:", error);
      res.status(500).json({ error: "Failed to report content" });
    }
  });

  // ========== Social: Notifications ==========

  app.get("/api/notifications", requireAuth, async (req: any, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 0;
      const notifications = await getNotifications(req.userId, page, 20);
      res.json({ notifications });
    } catch (error) {
      console.error("Error getting notifications:", error);
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  app.post("/api/notifications/read", requireAuth, async (req: any, res: Response) => {
    try {
      await markNotificationsRead(req.userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notifications read:", error);
      res.status(500).json({ error: "Failed to mark notifications read" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req: any, res: Response) => {
    try {
      const count = await getUnreadNotificationCount(req.userId);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  // ========== Social: Edit Post & Comment ==========

  app.put("/api/social/posts/:postId", requireAuth, async (req: any, res: Response) => {
    try {
      const postId = parseInt(req.params.postId);
      if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "Content is required" });
      const success = await updatePost(postId, req.userId, content.trim());
      if (!success) return res.status(404).json({ error: "Post not found or not owned" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating post:", error);
      res.status(500).json({ error: "Failed to update post" });
    }
  });

  app.put("/api/social/comments/:commentId", requireAuth, async (req: any, res: Response) => {
    try {
      const commentId = parseInt(req.params.commentId);
      if (isNaN(commentId)) return res.status(400).json({ error: "Invalid comment ID" });
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ error: "Content is required" });
      const success = await updateComment(commentId, req.userId, content.trim());
      if (!success) return res.status(404).json({ error: "Comment not found or not owned" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating comment:", error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
