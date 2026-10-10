import type { WorkoutExercise } from "@/types";

// What a shared workout shows: the exercises the user actually did.
// Only completed sets count, and an exercise with none is left out — a
// session where 4 of 7 exercises were done used to post all 7.

export interface PostedSet {
  weight: number;
  reps: number;
  completed: boolean;
}

export interface PostedExercise {
  name: string;
  sets?: PostedSet[];
}

// Build the exercise summary for a workout post from a logged workout.
export function completedWorkoutSummary(exercises: WorkoutExercise[]): {
  exercises: { name: string; sets: PostedSet[] }[];
  exerciseCount: number;
  totalSets: number;
} {
  const done = exercises
    .map((e) => ({
      name: e.exerciseName,
      sets: e.sets
        .filter((s) => s.completed)
        .map((s) => ({ weight: s.weight, reps: s.reps, completed: true })),
    }))
    .filter((e) => e.sets.length > 0);
  return {
    exercises: done,
    exerciseCount: done.length,
    totalSets: done.reduce((acc, e) => acc + e.sets.length, 0),
  };
}

// Exercises to display (or save) for a post's referenceData. Posts made
// before this rule stored every planned exercise with per-set
// `completed` flags, so they're filtered here too; exercises without set
// detail (shared plans) are shown as-is.
export function visibleWorkoutExercises(
  ref: { exercises?: PostedExercise[] } | null | undefined,
): PostedExercise[] {
  const list = Array.isArray(ref?.exercises) ? ref!.exercises! : [];
  return list
    .map((e) =>
      Array.isArray(e?.sets)
        ? { ...e, sets: e.sets.filter((s) => s?.completed) }
        : e,
    )
    .filter((e) => !Array.isArray(e.sets) || e.sets.length > 0);
}

// Counts that match what's displayed.
export function visibleWorkoutCounts(
  ref:
    | {
        exercises?: PostedExercise[];
        totalSets?: number;
        exerciseCount?: number;
      }
    | null
    | undefined,
): { exerciseCount: number; totalSets?: number } {
  const visible = visibleWorkoutExercises(ref);
  const hasSetDetail = (ref?.exercises ?? []).some((e) =>
    Array.isArray(e?.sets),
  );
  return {
    // With set detail the visible list is authoritative (even if empty);
    // otherwise fall back to the stored count.
    exerciseCount: hasSetDetail
      ? visible.length
      : visible.length || ref?.exerciseCount || 0,
    totalSets: hasSetDetail
      ? visible.reduce((acc, e) => acc + (e.sets?.length ?? 0), 0)
      : ref?.totalSets,
  };
}
