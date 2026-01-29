import type { Express } from "express";
import { createServer, type Server } from "node:http";

// FatSecret OAuth token cache
let fatSecretToken: string | null = null;
let fatSecretTokenExpiry = 0;

async function getFatSecretToken(): Promise<string> {
  const now = Date.now();
  if (fatSecretToken && now < fatSecretTokenExpiry) {
    return fatSecretToken;
  }

  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("FatSecret API credentials not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  
  const response = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=basic",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("FatSecret OAuth error:", errorText);
    throw new Error("Failed to get FatSecret access token");
  }

  const data = await response.json();
  fatSecretToken = data.access_token;
  fatSecretTokenExpiry = now + (data.expires_in * 1000) - 60000; // Refresh 1 min early
  console.log("FatSecret OAuth token obtained");
  return fatSecretToken;
}

interface FatSecretFood {
  food_id: string;
  food_name: string;
  food_type: string;
  food_description: string;
  brand_name?: string;
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
  // FatSecret Food Search API
  app.get("/api/foods/search", async (req, res) => {
    try {
      const { query, page = 0 } = req.query;
      
      if (!query || typeof query !== "string" || query.trim().length < 2) {
        return res.status(400).json({ error: "Search query must be at least 2 characters" });
      }

      const token = await getFatSecretToken();
      
      const searchParams = new URLSearchParams({
        method: "foods.search",
        search_expression: query.trim(),
        format: "json",
        page_number: String(page),
        max_results: "20",
      });

      const response = await fetch(`https://platform.fatsecret.com/rest/server.api?${searchParams}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("FatSecret search error:", errorText);
        return res.status(500).json({ error: "Failed to search foods" });
      }

      const data = await response.json();
      
      // Check for API errors (like IP whitelist issues)
      if (data.error) {
        console.error("FatSecret API error:", data.error);
        // Return error to client so it can fall back to local database
        return res.status(503).json({ 
          error: "Food API temporarily unavailable", 
          useLocalDatabase: true,
          details: data.error.message 
        });
      }
      
      // Parse the response - FatSecret returns foods in a nested structure
      const foods = data.foods?.food || [];
      const foodArray = Array.isArray(foods) ? foods : foods ? [foods] : [];
      
      // Transform to a cleaner format with parsed nutritional info
      const results = foodArray.map((food: FatSecretFood) => {
        // Parse the description to extract nutrition info
        // Format: "Per 100g - Calories: 165kcal | Fat: 3.57g | Carbs: 0.00g | Protein: 31.02g"
        const desc = food.food_description || "";
        const servingMatch = desc.match(/^Per ([^-]+) -/);
        const caloriesMatch = desc.match(/Calories:\s*([\d.]+)/);
        const fatMatch = desc.match(/Fat:\s*([\d.]+)/);
        const carbsMatch = desc.match(/Carbs:\s*([\d.]+)/);
        const proteinMatch = desc.match(/Protein:\s*([\d.]+)/);

        return {
          id: food.food_id,
          name: food.food_name,
          brand: food.brand_name || null,
          type: food.food_type,
          servingSize: servingMatch ? servingMatch[1].trim() : "1 serving",
          calories: caloriesMatch ? Math.round(parseFloat(caloriesMatch[1])) : 0,
          fat: fatMatch ? Math.round(parseFloat(fatMatch[1])) : 0,
          carbs: carbsMatch ? Math.round(parseFloat(carbsMatch[1])) : 0,
          protein: proteinMatch ? Math.round(parseFloat(proteinMatch[1])) : 0,
        };
      });

      res.json({
        foods: results,
        page: parseInt(String(page)),
        totalResults: data.foods?.total_results || results.length,
      });
    } catch (error) {
      console.error("Error searching foods:", error);
      res.status(500).json({ error: "Internal server error" });
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
  app.post("/api/generate-routine", async (req, res) => {
    try {
      const { muscleGroups, difficulty, name } = req.body;
      
      const apiKey = process.env.WORKOUT_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Workout API key not configured" });
      }
      
      if (!muscleGroups || !Array.isArray(muscleGroups) || muscleGroups.length === 0) {
        return res.status(400).json({ error: "At least one muscle group is required" });
      }

      const allExercises = await fetchAllExercises(apiKey);
      const routineExercises: any[] = [];

      // Get exercises for each muscle group
      for (const muscle of muscleGroups) {
        const muscleCode = MUSCLE_MAP[String(muscle).toLowerCase()] || String(muscle).toUpperCase();
        
        const muscleExercises = allExercises.filter(ex => 
          ex.primaryMuscles.some(m => m.code === muscleCode || m.code.includes(muscleCode) || muscleCode.includes(m.code))
        );

        console.log(`Found ${muscleExercises.length} exercises for ${muscle} (code: ${muscleCode})`);

        // Take up to 2 exercises per muscle group
        const selected = muscleExercises.slice(0, 2);
        
        for (const ex of selected) {
          routineExercises.push({
            id: ex.id,
            name: ex.name,
            muscleGroup: ex.primaryMuscles[0]?.name || muscle,
            equipment: ex.categories[0]?.name || "Bodyweight",
            sets: difficulty === "beginner" ? 3 : difficulty === "intermediate" ? 4 : 5,
            reps: 10,
            restSeconds: difficulty === "beginner" ? 90 : difficulty === "intermediate" ? 60 : 45,
            instructions: ex.description,
          });
        }
      }

      console.log(`Total exercises in routine: ${routineExercises.length}`);

      res.json({
        id: `routine-${Date.now()}`,
        name: name || `${muscleGroups.map((m: string) => m.charAt(0).toUpperCase() + m.slice(1).replace('_', ' ')).join(" & ")} Workout`,
        exercises: routineExercises,
        difficulty: difficulty || "intermediate",
        muscleGroups,
      });
    } catch (error) {
      console.error("Error generating routine:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
