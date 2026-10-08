import {
  getCatalog,
  generationScore,
  isCompound,
  type CatalogEntry,
} from "./exerciseCatalog";
import {
  proposeSplit,
  allocateExercises,
  sessionCapFor,
  muscleListLabel,
  MUSCLE_LABELS,
} from "../shared/workoutSplit";

// Client muscle chip id -> exercise_gif_cache.target_muscle values.
// Matching on the precise target first matters: the old matcher also
// accepted the broad body_part ("upper legs", "back"), so asking for
// Quads could return a hamstring curl.
const MUSCLE_TARGETS: Record<string, string[]> = {
  chest: ["pectorals"],
  shoulders: ["delts"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearms"],
  lats: ["lats"],
  middle_back: ["upper back"],
  lower_back: ["spine"],
  traps: ["traps"],
  abdominals: ["abs"],
  abs: ["abs"],
  quadriceps: ["quads"],
  hamstrings: ["hamstrings"],
  glutes: ["glutes", "abductors", "adductors"],
  calves: ["calves"],
};

// Broader fallback, used only when the precise target can't fill the
// allocation (e.g. a narrow equipment filter).
const MUSCLE_BODY_PARTS: Record<string, string[]> = {
  chest: ["chest"],
  shoulders: ["shoulders"],
  biceps: ["upper arms"],
  triceps: ["upper arms"],
  forearms: ["lower arms"],
  lats: ["back"],
  middle_back: ["back"],
  lower_back: ["back"],
  traps: ["back", "neck"],
  abdominals: ["waist"],
  abs: ["waist"],
  quadriceps: ["upper legs"],
  hamstrings: ["upper legs"],
  glutes: ["upper legs"],
  calves: ["lower legs"],
};

// The movements a coach programs first for each muscle, best-first
// (lowercase catalog names). Earlier entries get a bigger boost; the
// random jitter still rotates among them on Regenerate.
export const STAPLES: Record<string, string[]> = {
  chest: [
    "barbell bench press",
    "incline dumbbell press",
    "dumbbell bench press",
    "barbell incline bench press",
    "dumbbell flyes",
    "cable crossover",
    "push-ups",
    "chest dip",
  ],
  shoulders: [
    "barbell seated overhead press",
    "dumbbell seated shoulder press",
    "arnold press",
    "lateral raises",
    "front raises",
    "dumbbell reverse fly",
    "cable lateral raises",
    "upright rows",
  ],
  triceps: [
    "close grip bench press",
    "skull crushers",
    "rope pushdowns",
    "overhead tricep extension",
    "triceps dip",
    "tricep kickbacks",
  ],
  biceps: [
    "barbell curls",
    "dumbbell bicep curls",
    "hammer curls",
    "preacher curls",
    "concentration curls",
    "cable curls",
  ],
  forearms: ["wrist curls", "reverse wrist curls", "farmer's walk"],
  lats: [
    "pull-ups",
    "lat pulldown",
    "chin-ups",
    "cable pulldown",
    "bent over dumbbell rows",
  ],
  middle_back: [
    "barbell bent over row",
    "seated cable row",
    "t-bar row",
    "bent over dumbbell rows",
    "pendlay row",
  ],
  lower_back: ["good mornings", "deadlift", "rack pulls"],
  traps: ["barbell shrugs", "dumbbell shrugs", "upright rows"],
  abdominals: [
    "plank",
    "hanging leg raises",
    "ab wheel rollouts",
    "bicycle crunches",
    "russian twists",
    "crunch floor",
  ],
  quadriceps: [
    "barbell back squat",
    "leg press",
    "front squats",
    "lunges",
    "leg extensions",
    "goblet squats",
    "hack squats",
    "split squats",
  ],
  hamstrings: [
    "romanian deadlift",
    "lying leg curls",
    "seated leg curls",
    "good mornings",
    "single leg romanian deadlift",
  ],
  glutes: [
    "glute bridge",
    "step-ups",
    "sumo squats",
    "cable pull through",
    "lunges",
  ],
  calves: [
    "standing calf raises",
    "seated calf raises",
    "machine standing calf raises",
    "donkey calf raises",
    "single leg calf raises",
  ],
};
STAPLES.abs = STAPLES.abdominals;

// Skill moves that belong in an advanced program, and regressions that
// only make sense for beginners.
const ADVANCED_PATTERN =
  /\b(muscle-up|pistol|handstand|l-sit|nordic|archer|one arm|clean and press|turkish get-up|sissy|toes to bar|weighted pull-up)/i;
const BEGINNER_PATTERN = /\b(knee push-up|kneeling|assisted|incline push-up)/i;

function muscleAwareScore(
  entry: CatalogEntry,
  muscle: string,
  difficulty: string,
): number {
  let score = generationScore(entry);
  const staples = STAPLES[muscle] ?? [];
  const position = staples.indexOf(entry.lowerName);
  if (position >= 0) score += 90 - position * 6;
  if (ADVANCED_PATTERN.test(entry.name) && difficulty !== "advanced") {
    score -= 70;
  }
  if (BEGINNER_PATTERN.test(entry.name) && difficulty !== "beginner") {
    score -= 50;
  }
  return score;
}

// Client equipment chip ids -> catalog equipment categories. The old
// substring match never matched "machines" ("leverage machine"),
// "bodyweight" ("body weight") or "pull_up_bar" (no such equipment).
const EQUIPMENT_CHIP_CATEGORIES: Record<string, string[]> = {
  barbell: ["barbell"],
  dumbbells: ["dumbbell"],
  cables: ["cable"],
  machines: ["machine"],
  kettlebell: ["kettlebell"],
  bodyweight: ["bodyweight"],
  resistance_bands: ["band"],
};

export interface GenerateInput {
  muscleGroups: string[];
  difficulty?: string;
  name?: string;
  equipment?: string[];
  goal?: string;
  mode?: string; // "single" | "split"
  random?: () => number; // injectable for deterministic tests
}

export interface GeneratedExercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  sets: number;
  reps: string;
  restSeconds: number;
  instructions: string | null;
}

export interface GeneratedSession {
  name: string;
  muscleGroups: string[];
  exercises: GeneratedExercise[];
}

export type GenerateResult =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      mode: "single" | "split";
      sessions: GeneratedSession[];
      difficulty: string;
      partialMuscles: string[];
    };

function goalSchemeFor(goal: string | undefined) {
  switch (goal) {
    case "build_strength":
      return { sets: 5, reps: "5", restSeconds: 180 };
    case "lose_fat":
      return { sets: 3, reps: "15", restSeconds: 45 };
    case "endurance":
      return { sets: 3, reps: "20", restSeconds: 30 };
    case "general_fitness":
      return { sets: 3, reps: "10", restSeconds: 60 };
    case "build_muscle":
    default:
      return { sets: 4, reps: "10", restSeconds: 75 };
  }
}

export async function generateRoutine(
  input: GenerateInput,
): Promise<GenerateResult> {
  const { muscleGroups } = input;
  const random = input.random ?? Math.random;
  const mode: "single" | "split" = input.mode === "split" ? "split" : "single";

  if (
    !Array.isArray(muscleGroups) ||
    muscleGroups.length === 0 ||
    muscleGroups.length > 20 ||
    !muscleGroups.every((m) => typeof m === "string")
  ) {
    return {
      ok: false,
      status: 400,
      error: "At least one muscle group is required",
    };
  }
  const muscles = [...new Set(muscleGroups.map((m) => m.toLowerCase()))];

  const difficulty =
    input.difficulty === "beginner"
      ? "beginner"
      : input.difficulty === "advanced" || input.difficulty === "expert"
        ? "advanced"
        : "intermediate";

  const scheme = goalSchemeFor(input.goal);
  const setOffset =
    difficulty === "beginner" ? -1 : difficulty === "advanced" ? 1 : 0;
  const sets = Math.max(2, scheme.sets + setOffset);

  const chips = Array.isArray(input.equipment)
    ? input.equipment.map((e) => String(e))
    : [];
  const allowedCategories = new Set(
    chips.flatMap((c) => EQUIPMENT_CHIP_CATEGORIES[c] ?? []),
  );
  const allowPullUpBar = chips.includes("pull_up_bar");
  const passesEquipment = (e: CatalogEntry) => {
    if (chips.length === 0) return true; // full gym
    if (allowedCategories.has(e.equipmentCategory)) return true;
    return allowPullUpBar && e.usesPullUpBar;
  };

  const catalog = await getCatalog();
  const usable = catalog.entries.filter(
    (e) => passesEquipment(e) && generationScore(e) > -500,
  );

  // Same animation id = same movement; never repeat one across sessions.
  const usedIds = new Set<string>();
  const partialMuscles: string[] = [];

  const rank = (list: CatalogEntry[], muscle: string) =>
    list
      .filter((e) => !usedIds.has(e.exerciseDbId))
      .map((e) => ({
        e,
        score: muscleAwareScore(e, muscle, difficulty) + random() * 30,
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.e);

  const pickForMuscle = (muscle: string, count: number): CatalogEntry[] => {
    const targets = new Set(MUSCLE_TARGETS[muscle] ?? [muscle]);
    const bodyParts = new Set(MUSCLE_BODY_PARTS[muscle] ?? []);
    const staples = new Set(STAPLES[muscle] ?? []);
    // Staples are eligible even when the data tags them with a
    // neighbouring target (Barbell Back Squat is tagged "glutes").
    const precise = rank(
      usable.filter(
        (e) =>
          targets.has((e.targetMuscle || "").toLowerCase()) ||
          staples.has(e.lowerName),
      ),
      muscle,
    );
    const picked: CatalogEntry[] = [];
    const take = (list: CatalogEntry[]) => {
      for (const e of list) {
        if (picked.length >= count) return;
        if (usedIds.has(e.exerciseDbId)) continue;
        usedIds.add(e.exerciseDbId);
        picked.push(e);
      }
    };
    take(precise);
    if (picked.length < count) {
      take(
        rank(
          usable.filter((e) => bodyParts.has((e.bodyPart || "").toLowerCase())),
          muscle,
        ),
      );
    }
    if (picked.length === 0) partialMuscles.push(muscle);
    return picked;
  };

  const plans =
    mode === "split"
      ? proposeSplit(muscles)
      : [{ title: "", muscles, subtitle: muscleListLabel(muscles) }];
  const sessionCap = sessionCapFor(difficulty);
  const stamp = Date.now();

  const sessions: GeneratedSession[] = plans.map((plan, sessionIndex) => {
    const allocation = allocateExercises(plan.muscles, sessionCap);
    const picked: { entry: CatalogEntry; muscle: string }[] = [];
    for (const muscle of plan.muscles) {
      for (const entry of pickForMuscle(muscle, allocation.get(muscle) ?? 1)) {
        picked.push({ entry, muscle });
      }
    }
    // Compound lifts first, then isolation — the order a coach would
    // program them. Stable sort keeps per-muscle grouping otherwise.
    picked.sort(
      (a, b) => Number(isCompound(b.entry)) - Number(isCompound(a.entry)),
    );
    const defaultName =
      mode === "split"
        ? `${plan.title} — ${plan.subtitle}`
        : `${plan.subtitle} Workout`;
    const name =
      mode === "single" && input.name ? String(input.name) : defaultName;
    return {
      name: name.slice(0, 100),
      muscleGroups: plan.muscles,
      exercises: picked.map(({ entry, muscle }, i) => ({
        id: `gen-${stamp}-${sessionIndex}-${i}`,
        name: entry.name,
        muscleGroup: MUSCLE_LABELS[muscle] ?? muscle,
        equipment: entry.equipment || "body weight",
        sets,
        reps: scheme.reps,
        restSeconds: scheme.restSeconds,
        instructions: entry.instructions,
      })),
    };
  });

  const nonEmpty = sessions.filter((s) => s.exercises.length > 0);
  if (nonEmpty.length === 0) {
    return {
      ok: false,
      status: 422,
      error:
        "No exercises matched your filters. Try removing equipment restrictions or choosing different muscle groups.",
    };
  }

  return { ok: true, mode, sessions: nonEmpty, difficulty, partialMuscles };
}
