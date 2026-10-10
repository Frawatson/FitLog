import { v4 as uuidv4 } from "uuid";

import type { Post, Routine } from "@/types";
import * as storage from "@/lib/storage";
import { exerciseSlug } from "@/lib/exerciseSlug";
import { visibleWorkoutExercises } from "@/lib/workoutPosts";
import { normalizeExerciseName } from "../../shared/exerciseNames";

// The routines API rejects more than 30 exercises per routine.
const MAX_EXERCISES = 30;

// Post payload for sharing a workout plan ("routine" post).
export function routineReferenceData(routine: Routine) {
  const exercises = [...routine.exercises]
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_EXERCISES)
    .map((e) => ({ name: e.exerciseName }));
  return {
    routineName: routine.name,
    exerciseCount: exercises.length,
    exercises,
  };
}

// Exercises a post can be saved as: a shared plan ("routine") or a
// logged workout ("workout"). Null when the post carries no exercises.
export function savableRoutineFromPost(
  post: Pick<Post, "postType" | "referenceData">,
): { name: string; exerciseNames: string[] } | null {
  if (post.postType !== "workout" && post.postType !== "routine") return null;
  const ref = post.referenceData;
  // A logged workout saves what was actually done (exercises with
  // completed sets); a shared plan saves every exercise.
  const names: string[] = visibleWorkoutExercises(ref)
    .map((e) => (typeof e?.name === "string" ? e.name.trim() : ""))
    .filter(Boolean);
  if (names.length === 0) return null;
  const name =
    typeof ref?.routineName === "string" && ref.routineName.trim()
      ? ref.routineName.trim()
      : "Shared Workout";
  return { name, exerciseNames: names.slice(0, MAX_EXERCISES) };
}

export type SaveResult = "saved" | "already_saved" | "not_savable";

// Save a shared workout/plan from someone's post as the viewer's own
// routine. Saving the same post twice is detected (same name + same
// exercises). A different routine that happens to share the name gets
// the author's name appended so the two stay distinguishable.
export async function saveRoutineFromPost(
  post: Pick<Post, "postType" | "referenceData" | "authorName">,
): Promise<{ result: SaveResult; routineName?: string }> {
  const source = savableRoutineFromPost(post);
  if (!source) return { result: "not_savable" };

  const exerciseKey = source.exerciseNames
    .map((n) => normalizeExerciseName(n))
    .join("|");
  const existing = await storage.getRoutines();
  const sameExercises = (r: Routine) =>
    [...r.exercises]
      .sort((a, b) => a.order - b.order)
      .map((e) => normalizeExerciseName(e.exerciseName))
      .join("|") === exerciseKey;

  const baseName = source.name.slice(0, 100);
  const authored = `${source.name} (${post.authorName || "shared"})`.slice(
    0,
    100,
  );
  const duplicate = existing.find(
    (r) => (r.name === baseName || r.name === authored) && sameExercises(r),
  );
  if (duplicate)
    return { result: "already_saved", routineName: duplicate.name };

  const nameTaken = existing.some((r) => r.name === baseName);
  const routine: Routine = {
    id: uuidv4(),
    name: nameTaken ? authored : baseName,
    exercises: source.exerciseNames.map((exerciseName, order) => ({
      // Slug ids keep this lift's history shared with the same exercise
      // added from templates, the library, or generated routines.
      exerciseId: exerciseSlug(exerciseName),
      exerciseName,
      order,
    })),
    createdAt: new Date().toISOString(),
  };
  await storage.saveRoutine(routine);
  return { result: "saved", routineName: routine.name };
}
