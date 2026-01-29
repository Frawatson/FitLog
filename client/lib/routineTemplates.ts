import type { RoutineExercise } from "@/types";

export interface RoutineTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: "strength" | "hypertrophy" | "full_body" | "split";
  daysPerWeek: number;
  exercises: RoutineExercise[];
}

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: "template_push",
    name: "Push Day",
    description: "Chest, shoulders, and triceps focused workout",
    difficulty: "intermediate",
    category: "split",
    daysPerWeek: 3,
    exercises: [
      { exerciseId: "2", exerciseName: "Bench Press", order: 0 },
      { exerciseId: "11", exerciseName: "Incline DB Press", order: 1 },
      { exerciseId: "6", exerciseName: "Overhead Press", order: 2 },
      { exerciseId: "13", exerciseName: "Lateral Raise", order: 3 },
      { exerciseId: "8", exerciseName: "Tricep Extension", order: 4 },
      { exerciseId: "12", exerciseName: "Dumbbell Fly", order: 5 },
    ],
  },
  {
    id: "template_pull",
    name: "Pull Day",
    description: "Back and biceps focused workout",
    difficulty: "intermediate",
    category: "split",
    daysPerWeek: 3,
    exercises: [
      { exerciseId: "3", exerciseName: "Deadlift", order: 0 },
      { exerciseId: "4", exerciseName: "Barbell Row", order: 1 },
      { exerciseId: "5", exerciseName: "Lat Pulldown", order: 2 },
      { exerciseId: "18", exerciseName: "Cable Row", order: 3 },
      { exerciseId: "14", exerciseName: "Face Pull", order: 4 },
      { exerciseId: "7", exerciseName: "Bicep Curl", order: 5 },
    ],
  },
  {
    id: "template_legs",
    name: "Leg Day",
    description: "Quads, hamstrings, and calves focused workout",
    difficulty: "intermediate",
    category: "split",
    daysPerWeek: 3,
    exercises: [
      { exerciseId: "1", exerciseName: "Squat", order: 0 },
      { exerciseId: "9", exerciseName: "Leg Press", order: 1 },
      { exerciseId: "10", exerciseName: "Romanian Deadlift", order: 2 },
      { exerciseId: "16", exerciseName: "Leg Extension", order: 3 },
      { exerciseId: "15", exerciseName: "Leg Curl", order: 4 },
      { exerciseId: "17", exerciseName: "Calf Raise", order: 5 },
    ],
  },
  {
    id: "template_upper",
    name: "Upper Body",
    description: "Complete upper body workout for strength",
    difficulty: "intermediate",
    category: "split",
    daysPerWeek: 4,
    exercises: [
      { exerciseId: "2", exerciseName: "Bench Press", order: 0 },
      { exerciseId: "4", exerciseName: "Barbell Row", order: 1 },
      { exerciseId: "6", exerciseName: "Overhead Press", order: 2 },
      { exerciseId: "5", exerciseName: "Lat Pulldown", order: 3 },
      { exerciseId: "7", exerciseName: "Bicep Curl", order: 4 },
      { exerciseId: "8", exerciseName: "Tricep Extension", order: 5 },
    ],
  },
  {
    id: "template_lower",
    name: "Lower Body",
    description: "Complete lower body workout for strength",
    difficulty: "intermediate",
    category: "split",
    daysPerWeek: 4,
    exercises: [
      { exerciseId: "1", exerciseName: "Squat", order: 0 },
      { exerciseId: "10", exerciseName: "Romanian Deadlift", order: 1 },
      { exerciseId: "9", exerciseName: "Leg Press", order: 2 },
      { exerciseId: "15", exerciseName: "Leg Curl", order: 3 },
      { exerciseId: "16", exerciseName: "Leg Extension", order: 4 },
      { exerciseId: "17", exerciseName: "Calf Raise", order: 5 },
    ],
  },
  {
    id: "template_fullbody_a",
    name: "Full Body A",
    description: "Compound-focused full body workout",
    difficulty: "beginner",
    category: "full_body",
    daysPerWeek: 3,
    exercises: [
      { exerciseId: "1", exerciseName: "Squat", order: 0 },
      { exerciseId: "2", exerciseName: "Bench Press", order: 1 },
      { exerciseId: "4", exerciseName: "Barbell Row", order: 2 },
      { exerciseId: "6", exerciseName: "Overhead Press", order: 3 },
      { exerciseId: "7", exerciseName: "Bicep Curl", order: 4 },
    ],
  },
  {
    id: "template_fullbody_b",
    name: "Full Body B",
    description: "Alternative full body workout",
    difficulty: "beginner",
    category: "full_body",
    daysPerWeek: 3,
    exercises: [
      { exerciseId: "3", exerciseName: "Deadlift", order: 0 },
      { exerciseId: "11", exerciseName: "Incline DB Press", order: 1 },
      { exerciseId: "5", exerciseName: "Lat Pulldown", order: 2 },
      { exerciseId: "13", exerciseName: "Lateral Raise", order: 3 },
      { exerciseId: "8", exerciseName: "Tricep Extension", order: 4 },
    ],
  },
  {
    id: "template_beginner_strength",
    name: "Beginner Strength",
    description: "Simple 3-day program for building a foundation",
    difficulty: "beginner",
    category: "strength",
    daysPerWeek: 3,
    exercises: [
      { exerciseId: "1", exerciseName: "Squat", order: 0 },
      { exerciseId: "2", exerciseName: "Bench Press", order: 1 },
      { exerciseId: "3", exerciseName: "Deadlift", order: 2 },
      { exerciseId: "6", exerciseName: "Overhead Press", order: 3 },
      { exerciseId: "4", exerciseName: "Barbell Row", order: 4 },
    ],
  },
  {
    id: "template_hypertrophy_chest",
    name: "Chest Hypertrophy",
    description: "High volume chest workout for muscle growth",
    difficulty: "advanced",
    category: "hypertrophy",
    daysPerWeek: 5,
    exercises: [
      { exerciseId: "2", exerciseName: "Bench Press", order: 0 },
      { exerciseId: "11", exerciseName: "Incline DB Press", order: 1 },
      { exerciseId: "12", exerciseName: "Dumbbell Fly", order: 2 },
      { exerciseId: "8", exerciseName: "Tricep Extension", order: 3 },
    ],
  },
  {
    id: "template_hypertrophy_back",
    name: "Back Hypertrophy",
    description: "High volume back workout for muscle growth",
    difficulty: "advanced",
    category: "hypertrophy",
    daysPerWeek: 5,
    exercises: [
      { exerciseId: "5", exerciseName: "Lat Pulldown", order: 0 },
      { exerciseId: "4", exerciseName: "Barbell Row", order: 1 },
      { exerciseId: "18", exerciseName: "Cable Row", order: 2 },
      { exerciseId: "14", exerciseName: "Face Pull", order: 3 },
      { exerciseId: "7", exerciseName: "Bicep Curl", order: 4 },
    ],
  },
];

export function getTemplatesByDifficulty(difficulty: string): RoutineTemplate[] {
  return ROUTINE_TEMPLATES.filter((t) => t.difficulty === difficulty);
}

export function getTemplatesByCategory(category: string): RoutineTemplate[] {
  return ROUTINE_TEMPLATES.filter((t) => t.category === category);
}
