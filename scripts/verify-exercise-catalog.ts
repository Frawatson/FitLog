// Read-only verification of exercise name resolution against the live
// catalog. Run: npx tsx scripts/verify-exercise-catalog.ts
import "dotenv/config";
import { resolveExercise, getCatalog } from "../server/exerciseCatalog";
import { pool } from "../server/db";

// Expectation: an exercisedb id the input must resolve to, a catalog
// name it must resolve to, or NONE (must not show any image).
type Expect = { id: string } | { name: string } | "NONE";

const CASES: [string, Expect][] = [
  // Corrected curated rows
  ["Push-ups", { id: "0662" }],
  ["Wide Push-ups", { id: "1311" }],
  ["Pull-ups", { id: "0652" }],
  ["Wrist Curls", { id: "0126" }],
  ["Lateral Raises", { id: "0334" }],
  ["Front Squats", { id: "0042" }],
  ["Lat Pulldown", { id: "0198" }],
  ["Chin-ups", { id: "1326" }],
  ["Bicycle Crunches", { id: "0003" }],
  ["Plank", { id: "2135" }],
  // Untouched curated rows keep their image
  ["Barbell Bench Press", { name: "Barbell Bench Press" }],
  ["Dead Bug", { name: "Dead Bug" }],
  // Template / default names resolve to themselves
  ["barbell full squat", { name: "barbell full squat" }],
  ["dumbbell lateral raise", { id: "0334" }],
  ["cable lat pulldown full range of motion", { id: "2330" }],
  // Normalization
  ["push ups", { id: "0662" }],
  ["pushups", { id: "0662" }],
  ["PULL UP", { id: "0652" }],
  ["sled 45 degrees leg press", { name: "sled 45° leg press" }],
  // Common names
  ["RDL", { name: "Romanian Deadlift" }],
  ["bench press", { name: "Barbell Bench Press" }],
  ["skullcrushers", { name: "Skull Crushers" }],
  ["face pull", { name: "cable rear delt row (with rope)" }],
  ["ohp", { name: "barbell seated overhead press" }],
  ["incline dumbbell press", { name: "Incline Dumbbell Press" }],
  // Longer custom names containing a real exercise
  ["my heavy barbell bench press", { name: "Barbell Bench Press" }],
  // Must NOT match anything (no image beats a wrong image)
  ["my secret move", "NONE"],
  ["barbell", "NONE"],
  ["seated", "NONE"],
];

(async () => {
  const catalog = await getCatalog();
  console.log("catalog entries:", catalog.entries.length);
  let failures = 0;
  for (const [input, expect] of CASES) {
    const hit = await resolveExercise(input);
    const got = hit ? `${hit.name} #${hit.exerciseDbId}` : "(no match)";
    const ok =
      expect === "NONE"
        ? !hit
        : "id" in expect
          ? hit?.exerciseDbId === expect.id
          : hit?.name.toLowerCase() === expect.name.toLowerCase();
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${input.padEnd(40)} -> ${got}`);
  }
  console.log(failures ? `${failures} FAILURE(S)` : "ALL PASS");
  await pool.end();
  process.exit(failures ? 1 : 0);
})();
