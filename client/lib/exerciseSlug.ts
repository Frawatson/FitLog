// Stable, name-derived id for exercises. Used so the same exercise added
// from a template, the routine generator, or the exercise library all end
// up with the same exerciseId — which is what `getLastWorkoutForExercise`
// (storage.ts) and `ExerciseHistoryScreen` match on. Without this, the
// same lift coming from three sources looked like three different
// exercises and per-exercise history / last-session lookups never carried
// over across sources.
//
// We collapse any run of non-alphanumeric characters to a single hyphen
// and strip leading/trailing hyphens so e.g. "Cable rear delt row (with
// rope)" → "cable-rear-delt-row-with-rope".
export function exerciseSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
