import type { Workout, RunEntry, FoodLogEntry, BodyWeightEntry } from "@/types";
import { getLocalDateString } from "@/lib/dateUtils";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: "workout" | "nutrition" | "running" | "consistency";
  threshold: number;
  progress: number;
  unlocked: boolean;
}

interface AchievementData {
  workouts: Workout[];
  runs: RunEntry[];
  bodyWeights: BodyWeightEntry[];
  foodLogDays: number; // number of days with food logged
}

export function checkAchievements(data: AchievementData): Achievement[] {
  const completedWorkouts = data.workouts.filter((w) => w.completedAt);
  const totalVolume = completedWorkouts.reduce((acc, w) =>
    acc + w.exercises.reduce((ea, ex) =>
      ea + ex.sets.reduce((sa, s) => sa + (s.completed ? s.weight * s.reps : 0), 0), 0), 0);
  const totalRuns = data.runs.length;
  const totalRunKm = data.runs.reduce((acc, r) => acc + r.distanceKm, 0);

  // Calculate workout streak
  const workoutStreak = calculateStreak(completedWorkouts.map((w) => w.completedAt!));

  return [
    // Workout milestones
    {
      id: "first_workout",
      title: "First Rep",
      description: "Complete your first workout",
      icon: "zap",
      category: "workout",
      threshold: 1,
      progress: completedWorkouts.length,
      unlocked: completedWorkouts.length >= 1,
    },
    {
      id: "workouts_10",
      title: "Getting Started",
      description: "Complete 10 workouts",
      icon: "target",
      category: "workout",
      threshold: 10,
      progress: completedWorkouts.length,
      unlocked: completedWorkouts.length >= 10,
    },
    {
      id: "workouts_50",
      title: "Dedicated Lifter",
      description: "Complete 50 workouts",
      icon: "award",
      category: "workout",
      threshold: 50,
      progress: completedWorkouts.length,
      unlocked: completedWorkouts.length >= 50,
    },
    {
      id: "workouts_100",
      title: "Iron Warrior",
      description: "Complete 100 workouts",
      icon: "shield",
      category: "workout",
      threshold: 100,
      progress: completedWorkouts.length,
      unlocked: completedWorkouts.length >= 100,
    },

    // Volume milestones
    {
      id: "volume_10k",
      title: "10K Club",
      description: "Lift 10,000 lbs total volume",
      icon: "trending-up",
      category: "workout",
      threshold: 10000,
      progress: Math.round(totalVolume),
      unlocked: totalVolume >= 10000,
    },
    {
      id: "volume_50k",
      title: "Heavy Lifter",
      description: "Lift 50,000 lbs total volume",
      icon: "trending-up",
      category: "workout",
      threshold: 50000,
      progress: Math.round(totalVolume),
      unlocked: totalVolume >= 50000,
    },
    {
      id: "volume_100k",
      title: "Volume King",
      description: "Lift 100,000 lbs total volume",
      icon: "trending-up",
      category: "workout",
      threshold: 100000,
      progress: Math.round(totalVolume),
      unlocked: totalVolume >= 100000,
    },

    // Streak milestones
    {
      id: "streak_7",
      title: "Week Warrior",
      description: "7-day activity streak",
      icon: "zap",
      category: "consistency",
      threshold: 7,
      progress: workoutStreak,
      unlocked: workoutStreak >= 7,
    },
    {
      id: "streak_30",
      title: "Monthly Machine",
      description: "30-day activity streak",
      icon: "zap",
      category: "consistency",
      threshold: 30,
      progress: workoutStreak,
      unlocked: workoutStreak >= 30,
    },

    // Running milestones
    {
      id: "first_run",
      title: "First Mile",
      description: "Complete your first run",
      icon: "map-pin",
      category: "running",
      threshold: 1,
      progress: totalRuns,
      unlocked: totalRuns >= 1,
    },
    {
      id: "run_distance_50",
      title: "Road Runner",
      description: "Run 50 km total",
      icon: "map",
      category: "running",
      threshold: 50,
      progress: Math.round(totalRunKm * 10) / 10,
      unlocked: totalRunKm >= 50,
    },
    {
      id: "run_distance_100",
      title: "Marathon Legend",
      description: "Run 100 km total",
      icon: "map",
      category: "running",
      threshold: 100,
      progress: Math.round(totalRunKm * 10) / 10,
      unlocked: totalRunKm >= 100,
    },

    // Nutrition milestones
    {
      id: "nutrition_7",
      title: "Mindful Eater",
      description: "Log food for 7 days",
      icon: "pie-chart",
      category: "nutrition",
      threshold: 7,
      progress: data.foodLogDays,
      unlocked: data.foodLogDays >= 7,
    },
    {
      id: "nutrition_30",
      title: "Nutrition Pro",
      description: "Log food for 30 days",
      icon: "pie-chart",
      category: "nutrition",
      threshold: 30,
      progress: data.foodLogDays,
      unlocked: data.foodLogDays >= 30,
    },

    // Body weight tracking
    {
      id: "weight_tracker",
      title: "Body Aware",
      description: "Log body weight 10 times",
      icon: "activity",
      category: "consistency",
      threshold: 10,
      progress: data.bodyWeights.length,
      unlocked: data.bodyWeights.length >= 10,
    },
  ];
}

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const uniqueDays = new Set(dates.map((d) => getLocalDateString(new Date(d))));
  const sortedDays = Array.from(uniqueDays).sort().reverse();

  let streak = 0;
  const today = new Date();
  const checkDate = new Date(today);

  for (let i = 0; i < 365; i++) {
    const dateStr = getLocalDateString(checkDate);
    if (uniqueDays.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}
