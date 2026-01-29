import type { RoutineExercise } from "@/types";

export interface RoutineTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: "full_body" | "upper_lower" | "ppl" | "bro_split";
  daysPerWeek: string;
  exercises: RoutineExercise[];
}

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  // Full Body (2-3 days/week)
  {
    id: "template_fullbody",
    name: "Full Body",
    description: "Complete full body workout hitting all major muscle groups. Great for beginners or those with limited time.",
    difficulty: "beginner",
    category: "full_body",
    daysPerWeek: "2-3",
    exercises: [
      { exerciseId: "1", exerciseName: "Squat", order: 0 },
      { exerciseId: "2", exerciseName: "Bench Press", order: 1 },
      { exerciseId: "4", exerciseName: "Barbell Row", order: 2 },
      { exerciseId: "6", exerciseName: "Overhead Press", order: 3 },
      { exerciseId: "10", exerciseName: "Romanian Deadlift", order: 4 },
      { exerciseId: "5", exerciseName: "Lat Pulldown", order: 5 },
      { exerciseId: "7", exerciseName: "Bicep Curl", order: 6 },
      { exerciseId: "8", exerciseName: "Tricep Extension", order: 7 },
    ],
  },
  // Upper/Lower Split (4 days/week)
  {
    id: "template_upper",
    name: "Upper Body",
    description: "Complete upper body workout targeting chest, back, shoulders, and arms.",
    difficulty: "intermediate",
    category: "upper_lower",
    daysPerWeek: "4",
    exercises: [
      { exerciseId: "2", exerciseName: "Bench Press", order: 0 },
      { exerciseId: "4", exerciseName: "Barbell Row", order: 1 },
      { exerciseId: "6", exerciseName: "Overhead Press", order: 2 },
      { exerciseId: "5", exerciseName: "Lat Pulldown", order: 3 },
      { exerciseId: "11", exerciseName: "Incline DB Press", order: 4 },
      { exerciseId: "18", exerciseName: "Cable Row", order: 5 },
      { exerciseId: "7", exerciseName: "Bicep Curl", order: 6 },
      { exerciseId: "8", exerciseName: "Tricep Extension", order: 7 },
    ],
  },
  {
    id: "template_lower",
    name: "Lower Body",
    description: "Complete lower body workout targeting quads, hamstrings, glutes, and calves.",
    difficulty: "intermediate",
    category: "upper_lower",
    daysPerWeek: "4",
    exercises: [
      { exerciseId: "1", exerciseName: "Squat", order: 0 },
      { exerciseId: "10", exerciseName: "Romanian Deadlift", order: 1 },
      { exerciseId: "9", exerciseName: "Leg Press", order: 2 },
      { exerciseId: "15", exerciseName: "Leg Curl", order: 3 },
      { exerciseId: "16", exerciseName: "Leg Extension", order: 4 },
      { exerciseId: "17", exerciseName: "Calf Raise", order: 5 },
    ],
  },
  // Push/Pull/Legs (3 or 6 days/week)
  {
    id: "template_push",
    name: "Push Day",
    description: "Chest, shoulders, and triceps focused workout.",
    difficulty: "intermediate",
    category: "ppl",
    daysPerWeek: "3-6",
    exercises: [
      { exerciseId: "2", exerciseName: "Bench Press", order: 0 },
      { exerciseId: "11", exerciseName: "Incline DB Press", order: 1 },
      { exerciseId: "6", exerciseName: "Overhead Press", order: 2 },
      { exerciseId: "13", exerciseName: "Lateral Raise", order: 3 },
      { exerciseId: "12", exerciseName: "Dumbbell Fly", order: 4 },
      { exerciseId: "8", exerciseName: "Tricep Extension", order: 5 },
    ],
  },
  {
    id: "template_pull",
    name: "Pull Day",
    description: "Back and biceps focused workout.",
    difficulty: "intermediate",
    category: "ppl",
    daysPerWeek: "3-6",
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
    name: "Legs Day",
    description: "Quads, hamstrings, glutes, and calves focused workout.",
    difficulty: "intermediate",
    category: "ppl",
    daysPerWeek: "3-6",
    exercises: [
      { exerciseId: "1", exerciseName: "Squat", order: 0 },
      { exerciseId: "9", exerciseName: "Leg Press", order: 1 },
      { exerciseId: "10", exerciseName: "Romanian Deadlift", order: 2 },
      { exerciseId: "16", exerciseName: "Leg Extension", order: 3 },
      { exerciseId: "15", exerciseName: "Leg Curl", order: 4 },
      { exerciseId: "17", exerciseName: "Calf Raise", order: 5 },
    ],
  },
  // Bro Split (5 days/week)
  {
    id: "template_bro_chest",
    name: "Chest Day",
    description: "High volume chest workout for maximum chest development.",
    difficulty: "advanced",
    category: "bro_split",
    daysPerWeek: "5",
    exercises: [
      { exerciseId: "2", exerciseName: "Bench Press", order: 0 },
      { exerciseId: "11", exerciseName: "Incline DB Press", order: 1 },
      { exerciseId: "12", exerciseName: "Dumbbell Fly", order: 2 },
    ],
  },
  {
    id: "template_bro_back",
    name: "Back Day",
    description: "High volume back workout for a thick and wide back.",
    difficulty: "advanced",
    category: "bro_split",
    daysPerWeek: "5",
    exercises: [
      { exerciseId: "3", exerciseName: "Deadlift", order: 0 },
      { exerciseId: "4", exerciseName: "Barbell Row", order: 1 },
      { exerciseId: "5", exerciseName: "Lat Pulldown", order: 2 },
      { exerciseId: "18", exerciseName: "Cable Row", order: 3 },
    ],
  },
  {
    id: "template_bro_shoulders",
    name: "Shoulders Day",
    description: "Complete shoulder workout for 3D delts.",
    difficulty: "advanced",
    category: "bro_split",
    daysPerWeek: "5",
    exercises: [
      { exerciseId: "6", exerciseName: "Overhead Press", order: 0 },
      { exerciseId: "13", exerciseName: "Lateral Raise", order: 1 },
      { exerciseId: "14", exerciseName: "Face Pull", order: 2 },
    ],
  },
  {
    id: "template_bro_arms",
    name: "Arms Day",
    description: "Biceps and triceps workout for bigger arms.",
    difficulty: "advanced",
    category: "bro_split",
    daysPerWeek: "5",
    exercises: [
      { exerciseId: "7", exerciseName: "Bicep Curl", order: 0 },
      { exerciseId: "8", exerciseName: "Tricep Extension", order: 1 },
    ],
  },
  {
    id: "template_bro_legs",
    name: "Legs Day",
    description: "Complete leg workout for lower body development.",
    difficulty: "advanced",
    category: "bro_split",
    daysPerWeek: "5",
    exercises: [
      { exerciseId: "1", exerciseName: "Squat", order: 0 },
      { exerciseId: "9", exerciseName: "Leg Press", order: 1 },
      { exerciseId: "10", exerciseName: "Romanian Deadlift", order: 2 },
      { exerciseId: "16", exerciseName: "Leg Extension", order: 3 },
      { exerciseId: "15", exerciseName: "Leg Curl", order: 4 },
      { exerciseId: "17", exerciseName: "Calf Raise", order: 5 },
    ],
  },
];

export function getTemplatesByDifficulty(difficulty: string): RoutineTemplate[] {
  return ROUTINE_TEMPLATES.filter((t) => t.difficulty === difficulty);
}

export function getTemplatesByCategory(category: string): RoutineTemplate[] {
  return ROUTINE_TEMPLATES.filter((t) => t.category === category);
}
