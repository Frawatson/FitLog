// User Profile Types
export type Sex = "male" | "female";
export type TrainingExperience = "beginner" | "intermediate" | "advanced";
export type FitnessGoal = "lose_fat" | "gain_muscle" | "recomposition" | "maintain";
export type ActivityLevel = "1-2" | "3-4" | "5-6";
export type UnitSystem = "metric" | "imperial";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  weightGoalKg?: number;
  experience: TrainingExperience;
  goal: FitnessGoal;
  activityLevel: ActivityLevel;
  unitSystem: UnitSystem;
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
  isFavorite?: boolean;
  category?: string;
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
  notes?: string;
  totalVolumeKg?: number;
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
  serving?: string;
  imageUri?: string;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface FoodLogEntry {
  id: string;
  foodId: string;
  food: Food;
  date: string;
  createdAt: string;
  imageUri?: string;
  mealType?: MealType;
}

// Progression Suggestion
export interface ProgressionSuggestion {
  exerciseId: string;
  exerciseName: string;
  suggestedWeight: number;
  message: string;
}

// Heart Rate Zone Types
export type HeartRateZone = "zone1" | "zone2" | "zone3" | "zone4" | "zone5";

export interface HeartRateZoneInfo {
  zone: HeartRateZone;
  name: string;
  minBpm: number;
  maxBpm: number;
  color: string;
  description: string;
}

// Social Types
export type PostType = 'workout' | 'run' | 'meal' | 'progress_photo' | 'achievement' | 'text';
export type PostVisibility = 'followers' | 'public';

export interface Post {
  id: number;
  userId: number;
  clientId: string;
  postType: PostType;
  content?: string;
  referenceId?: string;
  referenceData?: any;
  imageData?: string;
  visibility: PostVisibility;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  authorName: string;
  authorAvatarUrl?: string;
  likedByMe: boolean;
}

export interface PostComment {
  id: number;
  postId: number;
  userId: number;
  clientId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatarUrl?: string;
}

export interface SocialProfile {
  userId: number;
  name: string;
  bio?: string;
  avatarUrl?: string;
  isPublic: boolean;
  followersCount: number;
  followingCount: number;
  isFollowedByMe: boolean;
  totalWorkouts: number;
  totalRuns: number;
  totalDistanceKm: number;
  currentStreak: number;
  memberSince: string;
}

export interface FollowUser {
  userId: number;
  name: string;
  avatarUrl?: string;
  bio?: string;
  isFollowedByMe: boolean;
}

// Run Tracking Types
export interface RunEntry {
  id: string;
  distanceKm: number;
  durationSeconds: number;
  paceMinPerKm: number;
  calories?: number;
  startedAt: string;
  completedAt: string;
  route?: {
    latitude: number;
    longitude: number;
  }[];
  avgHeartRate?: number;
  maxHeartRate?: number;
  heartRateZone?: HeartRateZone;
  elevationGainM?: number;
}
