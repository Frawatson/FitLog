import type { Express } from "express";
import { createServer, type Server } from "node:http";

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
