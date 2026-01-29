import type { Express } from "express";
import { createServer, type Server } from "node:http";

interface ExerciseFromAPI {
  name: string;
  type: string;
  muscle: string;
  equipment: string;
  difficulty: string;
  instructions: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Exercises API - fetches from API Ninjas
  app.get("/api/exercises", async (req, res) => {
    try {
      const { muscle, type, difficulty, name, offset = "0" } = req.query;
      
      const apiKey = process.env.WORKOUT_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Workout API key not configured" });
      }
      
      const params = new URLSearchParams();
      if (muscle) params.append("muscle", String(muscle));
      if (type) params.append("type", String(type));
      if (difficulty) params.append("difficulty", String(difficulty));
      if (name) params.append("name", String(name));
      params.append("offset", String(offset));
      
      const response = await fetch(
        `https://api.api-ninjas.com/v1/exercises?${params.toString()}`,
        {
          headers: {
            "X-Api-Key": apiKey,
          },
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Ninjas error:", errorText);
        return res.status(response.status).json({ error: "Failed to fetch exercises" });
      }
      
      const exercises: ExerciseFromAPI[] = await response.json();
      res.json(exercises);
    } catch (error) {
      console.error("Error fetching exercises:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // Generate routine - creates a balanced workout from API exercises
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
      
      const allExercises: ExerciseFromAPI[] = [];
      
      // Fetch exercises for each muscle group
      for (const muscle of muscleGroups) {
        const params = new URLSearchParams();
        params.append("muscle", muscle);
        if (difficulty) params.append("difficulty", difficulty);
        
        const response = await fetch(
          `https://api.api-ninjas.com/v1/exercises?${params.toString()}`,
          {
            headers: {
              "X-Api-Key": apiKey,
            },
          }
        );
        
        if (response.ok) {
          const exercises: ExerciseFromAPI[] = await response.json();
          // Take up to 3 exercises per muscle group
          allExercises.push(...exercises.slice(0, 3));
        }
      }
      
      // Transform to routine format
      const routineExercises = allExercises.map((ex, index) => ({
        id: `gen-${index}-${Date.now()}`,
        name: ex.name,
        muscleGroup: ex.muscle,
        equipment: ex.equipment,
        sets: difficulty === "beginner" ? 3 : difficulty === "intermediate" ? 4 : 5,
        reps: ex.type === "strength" ? 8 : ex.type === "cardio" ? 15 : 12,
        restSeconds: difficulty === "beginner" ? 90 : difficulty === "intermediate" ? 60 : 45,
        instructions: ex.instructions,
      }));
      
      res.json({
        id: `routine-${Date.now()}`,
        name: name || `${muscleGroups.join(" & ")} Workout`,
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
