// Verifies library search ranking against the live catalog.
// Run: npx tsx scripts/verify-exercise-search.ts
import "dotenv/config";
import { getCatalog } from "../server/exerciseCatalog";
import { pool } from "../server/db";
import { searchExercises } from "../client/lib/exerciseSearch";

// [query, name that must appear within the top N, N]
const CASES: [string, string, number][] = [
  ["bench press", "Barbell Bench Press", 1],
  ["bench", "Barbell Bench Press", 1],
  ["rdl", "Romanian Deadlift", 1],
  ["ohp", "barbell seated overhead press", 1],
  ["pullup", "Pull-ups", 1],
  ["pull ups", "Pull-ups", 1],
  ["push up", "Push-ups", 1],
  ["skullcrusher", "Skull Crushers", 1],
  ["squat", "Barbell Back Squat", 1],
  ["lat pulldown", "Lat Pulldown", 1],
  ["lat pull", "Lat Pulldown", 3],
  ["curl", "Dumbbell Bicep Curls", 1],
  ["hammer", "Hammer Curls", 1],
  ["kb swing", "Kettlebell Swings", 1],
  ["face pull", "cable rear delt row (with rope)", 1],
  ["incline db press", "Incline Dumbbell Press", 1],
  ["leg curl", "Lying Leg Curls", 2],
  ["calf raises", "Standing Calf Raises", 1],
  ["deadlift", "Deadlift", 1],
  ["front squat", "Front Squats", 1],
];

(async () => {
  const catalog = await getCatalog();
  const items = catalog.entries.map((e) => ({
    name: e.name,
    bodyPart: e.bodyPart,
    equipment: e.equipment,
    targetMuscle: e.targetMuscle,
    popular: e.popular,
  }));
  let failures = 0;
  for (const [q, expected, topN] of CASES) {
    const results = searchExercises(items, q);
    const idx = results.findIndex(
      (r) => r.name.toLowerCase() === expected.toLowerCase(),
    );
    const ok = idx >= 0 && idx < topN;
    if (!ok) failures++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  "${q}" -> #${idx + 1} ${expected}   top3: ${results
        .slice(0, 3)
        .map((r) => r.name)
        .join(" | ")}`,
    );
  }
  // A muscle-word query should surface well-known exercises first.
  const chest = searchExercises(items, "chest").slice(0, 5);
  const popularTop = chest.filter((r) => r.popular).length;
  console.log(`"chest" top5: ${chest.map((r) => r.name).join(" | ")}`);
  if (popularTop < 3) failures++;
  console.log(
    `${popularTop >= 3 ? "PASS" : "FAIL"}  "chest" top 5 mostly well-known`,
  );
  console.log(failures ? `${failures} FAILURE(S)` : "ALL PASS");
  await pool.end();
  process.exit(failures ? 1 : 0);
})();
