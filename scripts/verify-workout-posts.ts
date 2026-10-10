// Checks that workout posts show/save only what was actually done.
// Read-only against the configured database. Run:
//   npx tsx scripts/verify-workout-posts.ts
import "dotenv/config";
import { pool } from "../server/db";
import {
  completedWorkoutSummary,
  visibleWorkoutExercises,
  visibleWorkoutCounts,
} from "../client/lib/workoutPosts";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
}

(async () => {
  // 1. Creating a post from a session where 4 of 7 exercises were done.
  const set = (completed: boolean) => ({
    id: "x",
    weight: 50,
    reps: 10,
    completed,
  });
  const session = [
    {
      exerciseId: "a",
      exerciseName: "A",
      sets: [set(true), set(true), set(true)],
    },
    { exerciseId: "b", exerciseName: "B", sets: [set(false), set(false)] },
    {
      exerciseId: "c",
      exerciseName: "C",
      sets: [set(true), set(false), set(true)],
    },
    { exerciseId: "d", exerciseName: "D", sets: [set(false)] },
  ];
  const summary = completedWorkoutSummary(session as any);
  check(
    summary.exerciseCount === 2,
    "post includes only exercises with completed sets (2 of 4)",
  );
  check(
    summary.exercises.map((e) => e.name).join(",") === "A,C",
    "skipped exercises left out, order kept",
  );
  check(summary.totalSets === 5, "only completed sets counted (5)");
  check(
    summary.exercises[1].sets.length === 2,
    "incomplete sets dropped within an exercise",
  );

  // 2. Shared plans (no set detail) are shown unchanged.
  const plan = { exercises: [{ name: "X" }, { name: "Y" }], exerciseCount: 2 };
  check(
    visibleWorkoutExercises(plan).length === 2,
    "plan posts show every exercise",
  );
  check(visibleWorkoutCounts(plan).exerciseCount === 2, "plan count unchanged");

  // 3. The real Friday post (stored with all 7 planned exercises).
  const r = await pool.query(
    "SELECT reference_data FROM posts WHERE post_type = 'workout' AND reference_data->>'routineName' = 'Friday-Back+Arms' ORDER BY created_at DESC LIMIT 1",
  );
  if (r.rows.length) {
    const ref = r.rows[0].reference_data;
    const shown = visibleWorkoutExercises(ref);
    const counts = visibleWorkoutCounts(ref);
    console.log(
      `  stored: ${ref.exercises.length} exercises; shown: ${shown.map((e) => e.name).join(" | ")}`,
    );
    check(
      ref.exercises.length === 7 && shown.length === 4,
      "Friday post: 7 stored, 4 shown",
    );
    check(
      counts.exerciseCount === 4 && counts.totalSets === 12,
      "Friday post: shows 4 exercises / 12 sets",
    );
  } else {
    console.log("  (Friday post not found; skipped)");
  }

  console.log(failures ? `${failures} FAILURE(S)` : "ALL PASS");
  await pool.end();
  process.exit(failures ? 1 : 0);
})();
