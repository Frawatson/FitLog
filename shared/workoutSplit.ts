// How a multi-muscle selection becomes workouts. Shared so the client
// can show the user the proposed split BEFORE generating (and ask
// whether they want it), and the server builds exactly that split.

export type MuscleCategory = "push" | "pull" | "legs" | "core";

export const MUSCLE_CATEGORY: Record<string, MuscleCategory> = {
  chest: "push",
  shoulders: "push",
  triceps: "push",
  lats: "pull",
  middle_back: "pull",
  lower_back: "pull",
  traps: "pull",
  biceps: "pull",
  forearms: "pull",
  quadriceps: "legs",
  hamstrings: "legs",
  glutes: "legs",
  calves: "legs",
  abdominals: "core",
};

// Muscles that can carry more volume in one session.
export const LARGE_MUSCLES = new Set([
  "chest",
  "shoulders",
  "lats",
  "middle_back",
  "quadriceps",
  "hamstrings",
  "glutes",
]);

export const MUSCLE_LABELS: Record<string, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  triceps: "Triceps",
  biceps: "Biceps",
  forearms: "Forearms",
  lats: "Lats",
  middle_back: "Middle Back",
  lower_back: "Lower Back",
  traps: "Traps",
  abdominals: "Abs",
  quadriceps: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
};

const CATEGORY_TITLES: Record<MuscleCategory, string> = {
  push: "Push Day",
  pull: "Pull Day",
  legs: "Leg Day",
  core: "Core",
};

const CATEGORY_ORDER: MuscleCategory[] = ["push", "pull", "legs", "core"];

export interface PlannedSession {
  title: string; // "Push Day"
  muscles: string[]; // ["chest", "triceps"]
  subtitle: string; // "Chest & Triceps"
}

export function muscleListLabel(muscles: string[]): string {
  const labels = muscles.map((m) => MUSCLE_LABELS[m] ?? m);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}

// Group the selection into push / pull / legs sessions. Core rides along
// with the smallest session rather than becoming a workout of its own
// (unless core is all that was picked).
export function proposeSplit(muscles: string[]): PlannedSession[] {
  const byCategory = new Map<MuscleCategory, string[]>();
  for (const m of muscles) {
    const cat = MUSCLE_CATEGORY[m] ?? "core";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(m);
  }

  const core = byCategory.get("core");
  if (core && byCategory.size > 1) {
    byCategory.delete("core");
    let smallest: MuscleCategory | null = null;
    for (const [cat, list] of byCategory) {
      if (!smallest || list.length < byCategory.get(smallest)!.length) {
        smallest = cat;
      }
    }
    byCategory.get(smallest!)!.push(...core);
  }

  return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((c) => {
    const list = byCategory.get(c)!;
    return {
      title: CATEGORY_TITLES[c],
      muscles: list,
      subtitle: muscleListLabel(list),
    };
  });
}

// Ask the user only when splitting would actually produce different
// workouts AND a single session would get crowded.
export function shouldOfferSplit(muscles: string[]): boolean {
  return muscles.length >= 3 && proposeSplit(muscles).length >= 2;
}

// Exercises per muscle for one session. A lone muscle gets a full
// session's worth; otherwise large muscles get more than small ones,
// trimmed (largest first, never below 1) to fit the session cap.
export function allocateExercises(
  muscles: string[],
  sessionCap: number,
): Map<string, number> {
  const counts = new Map<string, number>();
  if (muscles.length === 1) {
    counts.set(muscles[0], LARGE_MUSCLES.has(muscles[0]) ? 5 : 4);
    return counts;
  }
  for (const m of muscles) counts.set(m, LARGE_MUSCLES.has(m) ? 3 : 2);
  const total = () => [...counts.values()].reduce((a, b) => a + b, 0);
  while (total() > sessionCap) {
    let maxMuscle: string | null = null;
    for (const [m, c] of counts) {
      if (c > 1 && (!maxMuscle || c > counts.get(maxMuscle)!)) maxMuscle = m;
    }
    if (!maxMuscle) break; // every muscle already at 1
    counts.set(maxMuscle, counts.get(maxMuscle)! - 1);
  }
  return counts;
}

export function sessionCapFor(difficulty: string): number {
  if (difficulty === "beginner") return 6;
  if (difficulty === "advanced") return 9;
  return 8;
}
