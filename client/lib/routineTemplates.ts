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
  // ── Full Body (Beginner) ──────────────────────────────────────────

  {
    id: "template_sl5x5_a",
    name: "StrongLifts 5x5 - Workout A",
    description:
      "The classic StrongLifts 5x5 Workout A. Three compound lifts, progressive overload each session. One of the most popular beginner programs.",
    difficulty: "beginner",
    category: "full_body",
    daysPerWeek: "3",
    exercises: [
      { exerciseId: "t1", exerciseName: "barbell full squat", order: 0 },
      { exerciseId: "t2", exerciseName: "barbell bench press", order: 1 },
      { exerciseId: "t3", exerciseName: "barbell bent over row", order: 2 },
    ],
  },
  {
    id: "template_sl5x5_b",
    name: "StrongLifts 5x5 - Workout B",
    description:
      "The classic StrongLifts 5x5 Workout B. Alternates with Workout A for a complete 3-day full body program.",
    difficulty: "beginner",
    category: "full_body",
    daysPerWeek: "3",
    exercises: [
      { exerciseId: "t4", exerciseName: "barbell full squat", order: 0 },
      {
        exerciseId: "t5",
        exerciseName: "barbell seated overhead press",
        order: 1,
      },
      { exerciseId: "t6", exerciseName: "barbell deadlift", order: 2 },
    ],
  },
  {
    id: "template_fullbody_beginner",
    name: "Full Body Beginner",
    description:
      "A well-rounded full body routine covering all major muscle groups with compound movements. Ideal for beginners building a strength foundation.",
    difficulty: "beginner",
    category: "full_body",
    daysPerWeek: "3",
    exercises: [
      { exerciseId: "t7", exerciseName: "barbell full squat", order: 0 },
      { exerciseId: "t8", exerciseName: "barbell bench press", order: 1 },
      { exerciseId: "t9", exerciseName: "barbell bent over row", order: 2 },
      {
        exerciseId: "t10",
        exerciseName: "barbell seated overhead press",
        order: 3,
      },
      {
        exerciseId: "t11",
        exerciseName: "barbell romanian deadlift",
        order: 4,
      },
      { exerciseId: "t12", exerciseName: "barbell curl", order: 5 },
      { exerciseId: "t13", exerciseName: "cable pushdown", order: 6 },
    ],
  },

  // ── Upper/Lower Split (PHUL-inspired) ─────────────────────────────

  {
    id: "template_upper_power",
    name: "Upper Body - Power",
    description:
      "PHUL-style upper body power day. Heavy compound movements to build strength in chest, back, shoulders, and arms.",
    difficulty: "intermediate",
    category: "upper_lower",
    daysPerWeek: "4",
    exercises: [
      { exerciseId: "t14", exerciseName: "barbell bench press", order: 0 },
      {
        exerciseId: "t15",
        exerciseName: "barbell incline bench press",
        order: 1,
      },
      { exerciseId: "t16", exerciseName: "barbell bent over row", order: 2 },
      {
        exerciseId: "t17",
        exerciseName: "cable lat pulldown full range of motion",
        order: 3,
      },
      {
        exerciseId: "t18",
        exerciseName: "barbell seated overhead press",
        order: 4,
      },
      { exerciseId: "t19", exerciseName: "barbell curl", order: 5 },
      {
        exerciseId: "t20",
        exerciseName: "barbell lying triceps extension skull crusher",
        order: 6,
      },
    ],
  },
  {
    id: "template_upper_hypertrophy",
    name: "Upper Body - Hypertrophy",
    description:
      "PHUL-style upper body hypertrophy day. Higher reps with isolation work to maximize muscle growth.",
    difficulty: "intermediate",
    category: "upper_lower",
    daysPerWeek: "4",
    exercises: [
      {
        exerciseId: "t21",
        exerciseName: "dumbbell incline bench press",
        order: 0,
      },
      { exerciseId: "t22", exerciseName: "cable middle fly", order: 1 },
      { exerciseId: "t23", exerciseName: "cable seated row", order: 2 },
      {
        exerciseId: "t24",
        exerciseName: "cable lat pulldown full range of motion",
        order: 3,
      },
      {
        exerciseId: "t25",
        exerciseName: "dumbbell lateral raise",
        order: 4,
      },
      { exerciseId: "t26", exerciseName: "dumbbell hammer curl", order: 5 },
      {
        exerciseId: "t27",
        exerciseName: "cable overhead triceps extension (rope attachment)",
        order: 6,
      },
    ],
  },
  {
    id: "template_lower_power",
    name: "Lower Body - Power",
    description:
      "PHUL-style lower body power day. Heavy squats and deadlifts for maximum lower body strength.",
    difficulty: "intermediate",
    category: "upper_lower",
    daysPerWeek: "4",
    exercises: [
      { exerciseId: "t28", exerciseName: "barbell full squat", order: 0 },
      { exerciseId: "t29", exerciseName: "barbell deadlift", order: 1 },
      {
        exerciseId: "t30",
        exerciseName: "sled 45 degrees leg press",
        order: 2,
      },
      { exerciseId: "t31", exerciseName: "lever lying leg curl", order: 3 },
      {
        exerciseId: "t32",
        exerciseName: "barbell standing calf raise",
        order: 4,
      },
    ],
  },
  {
    id: "template_lower_hypertrophy",
    name: "Lower Body - Hypertrophy",
    description:
      "PHUL-style lower body hypertrophy day. Higher volume with front squats and lunges for balanced leg development.",
    difficulty: "intermediate",
    category: "upper_lower",
    daysPerWeek: "4",
    exercises: [
      { exerciseId: "t33", exerciseName: "barbell front squat", order: 0 },
      {
        exerciseId: "t34",
        exerciseName: "barbell romanian deadlift",
        order: 1,
      },
      { exerciseId: "t35", exerciseName: "lever leg extension", order: 2 },
      { exerciseId: "t36", exerciseName: "lever lying leg curl", order: 3 },
      { exerciseId: "t37", exerciseName: "barbell lunge", order: 4 },
      {
        exerciseId: "t38",
        exerciseName: "barbell seated calf raise",
        order: 5,
      },
    ],
  },

  // ── Push/Pull/Legs ────────────────────────────────────────────────

  {
    id: "template_ppl_push",
    name: "Push Day",
    description:
      "Push day targeting chest, shoulders, and triceps with a mix of compound and isolation movements.",
    difficulty: "intermediate",
    category: "ppl",
    daysPerWeek: "3-6",
    exercises: [
      { exerciseId: "t39", exerciseName: "barbell bench press", order: 0 },
      {
        exerciseId: "t40",
        exerciseName: "dumbbell incline bench press",
        order: 1,
      },
      { exerciseId: "t41", exerciseName: "cable middle fly", order: 2 },
      {
        exerciseId: "t42",
        exerciseName: "barbell seated overhead press",
        order: 3,
      },
      {
        exerciseId: "t43",
        exerciseName: "dumbbell lateral raise",
        order: 4,
      },
      { exerciseId: "t44", exerciseName: "cable pushdown", order: 5 },
      {
        exerciseId: "t45",
        exerciseName: "barbell lying triceps extension skull crusher",
        order: 6,
      },
    ],
  },
  {
    id: "template_ppl_pull",
    name: "Pull Day",
    description:
      "Pull day targeting back and biceps with heavy rows, pulldowns, and curls.",
    difficulty: "intermediate",
    category: "ppl",
    daysPerWeek: "3-6",
    exercises: [
      { exerciseId: "t46", exerciseName: "barbell deadlift", order: 0 },
      { exerciseId: "t47", exerciseName: "barbell bent over row", order: 1 },
      {
        exerciseId: "t48",
        exerciseName: "cable lat pulldown full range of motion",
        order: 2,
      },
      { exerciseId: "t49", exerciseName: "cable seated row", order: 3 },
      {
        exerciseId: "t50",
        exerciseName: "cable rear delt row (with rope)",
        order: 4,
      },
      { exerciseId: "t51", exerciseName: "barbell curl", order: 5 },
      { exerciseId: "t52", exerciseName: "dumbbell hammer curl", order: 6 },
    ],
  },
  {
    id: "template_ppl_legs",
    name: "Legs Day",
    description:
      "Legs day with squats, Romanian deadlifts, and accessories for complete lower body development.",
    difficulty: "intermediate",
    category: "ppl",
    daysPerWeek: "3-6",
    exercises: [
      { exerciseId: "t53", exerciseName: "barbell full squat", order: 0 },
      {
        exerciseId: "t54",
        exerciseName: "barbell romanian deadlift",
        order: 1,
      },
      {
        exerciseId: "t55",
        exerciseName: "sled 45 degrees leg press",
        order: 2,
      },
      { exerciseId: "t56", exerciseName: "lever leg extension", order: 3 },
      { exerciseId: "t57", exerciseName: "lever lying leg curl", order: 4 },
      {
        exerciseId: "t58",
        exerciseName: "barbell standing calf raise",
        order: 5,
      },
    ],
  },

  // ── Bro Split / Arnold Split (Advanced) ───────────────────────────

  {
    id: "template_arnold_chest_back",
    name: "Chest & Back",
    description:
      "Arnold Split chest and back day. Superset-friendly pairing for an intense push-pull pump session.",
    difficulty: "advanced",
    category: "bro_split",
    daysPerWeek: "6",
    exercises: [
      { exerciseId: "t59", exerciseName: "barbell bench press", order: 0 },
      {
        exerciseId: "t60",
        exerciseName: "dumbbell incline bench press",
        order: 1,
      },
      { exerciseId: "t61", exerciseName: "cable middle fly", order: 2 },
      { exerciseId: "t62", exerciseName: "barbell bent over row", order: 3 },
      {
        exerciseId: "t63",
        exerciseName: "cable lat pulldown full range of motion",
        order: 4,
      },
      { exerciseId: "t64", exerciseName: "cable seated row", order: 5 },
    ],
  },
  {
    id: "template_arnold_shoulders_arms",
    name: "Shoulders & Arms",
    description:
      "Arnold Split shoulders and arms day. Overhead pressing, lateral raises, and dedicated arm work.",
    difficulty: "advanced",
    category: "bro_split",
    daysPerWeek: "6",
    exercises: [
      {
        exerciseId: "t65",
        exerciseName: "barbell seated overhead press",
        order: 0,
      },
      {
        exerciseId: "t66",
        exerciseName: "dumbbell lateral raise",
        order: 1,
      },
      {
        exerciseId: "t67",
        exerciseName: "cable rear delt row (with rope)",
        order: 2,
      },
      { exerciseId: "t68", exerciseName: "barbell curl", order: 3 },
      { exerciseId: "t69", exerciseName: "dumbbell hammer curl", order: 4 },
      { exerciseId: "t70", exerciseName: "cable pushdown", order: 5 },
      {
        exerciseId: "t71",
        exerciseName: "barbell lying triceps extension skull crusher",
        order: 6,
      },
    ],
  },
  {
    id: "template_arnold_legs",
    name: "Legs",
    description:
      "Arnold Split legs day. Heavy squats, Romanian deadlifts, and machine work for complete lower body development.",
    difficulty: "advanced",
    category: "bro_split",
    daysPerWeek: "6",
    exercises: [
      { exerciseId: "t72", exerciseName: "barbell full squat", order: 0 },
      {
        exerciseId: "t73",
        exerciseName: "sled 45 degrees leg press",
        order: 1,
      },
      { exerciseId: "t74", exerciseName: "lever leg extension", order: 2 },
      {
        exerciseId: "t75",
        exerciseName: "barbell romanian deadlift",
        order: 3,
      },
      { exerciseId: "t76", exerciseName: "lever lying leg curl", order: 4 },
      {
        exerciseId: "t77",
        exerciseName: "barbell standing calf raise",
        order: 5,
      },
    ],
  },
];

export function getTemplatesByDifficulty(
  difficulty: string
): RoutineTemplate[] {
  return ROUTINE_TEMPLATES.filter((t) => t.difficulty === difficulty);
}

export function getTemplatesByCategory(category: string): RoutineTemplate[] {
  return ROUTINE_TEMPLATES.filter((t) => t.category === category);
}
