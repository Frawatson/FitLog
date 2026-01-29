// User Profile Types
export type Sex = "male" | "female";
export type TrainingExperience = "beginner" | "intermediate" | "advanced";
export type FitnessGoal = "lose_fat" | "gain_muscle" | "recomposition" | "maintain";
export type ActivityLevel = "3-4" | "5-6";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  experience: TrainingExperience;
  goal: FitnessGoal;
  activityLevel: ActivityLevel;
  onboardingCompleted: boolean;
  createdAt: string;
}

// Macro Targets
export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Exercise Types
export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  isCustom: boolean;
}

// Routine Types
export interface RoutineExercise {
  exerciseId: string;
  exerciseName: string;
  order: number;
}

export interface Routine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
  createdAt: string;
  lastCompletedAt?: string;
}

// Workout Logging Types
export interface WorkoutSet {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  routineId: string;
  routineName: string;
  exercises: WorkoutExercise[];
  startedAt: string;
  completedAt?: string;
  durationMinutes?: number;
}

// Body Weight Entry
export interface BodyWeightEntry {
  id: string;
  weightKg: number;
  date: string;
}

// Food Logging Types
export interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isSaved: boolean;
}

export interface FoodLogEntry {
  id: string;
  foodId: string;
  food: Food;
  date: string;
  createdAt: string;
}

// Progression Suggestion
export interface ProgressionSuggestion {
  exerciseId: string;
  exerciseName: string;
  suggestedWeight: number;
  message: string;
}

// Run Tracking Types
export interface RunEntry {
  id: string;
  distanceKm: number;
  durationSeconds: number;
  paceMinPerKm: number;
  startedAt: string;
  completedAt: string;
  route?: {
    latitude: number;
    longitude: number;
  }[];
}
