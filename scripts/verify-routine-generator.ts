// Read-only verification of routine generation against the live catalog.
// Run: npx tsx scripts/verify-routine-generator.ts
import "dotenv/config";
import {
  generateRoutine,
  STAPLES,
  type GenerateInput,
} from "../server/routineGenerator";
import { getCatalog } from "../server/exerciseCatalog";
import { pool } from "../server/db";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) failures++;
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${msg}`);
}

// Precise target muscles per chip (mirrors routineGenerator; used to
// assert each picked exercise really trains the requested muscle).
const TARGETS: Record<string, string[]> = {
  chest: ["pectorals", "chest"],
  triceps: ["triceps", "upper arms"],
  biceps: ["biceps", "upper arms"],
  lats: ["lats", "back"],
  quadriceps: ["quads", "upper legs"],
  hamstrings: ["hamstrings", "upper legs"],
  abdominals: ["abs", "waist"],
  shoulders: ["delts", "shoulders"],
};

async function run(label: string, input: GenerateInput) {
  console.log(`\n${label}`);
  const result = await generateRoutine(input);
  if (!result.ok) {
    console.log(`  -> error ${result.status}: ${result.error}`);
    return result;
  }
  for (const s of result.sessions) {
    console.log(`  [${s.name}] (${s.exercises.length})`);
    for (const ex of s.exercises) {
      console.log(`     - ${ex.name}  [${ex.muscleGroup}, ${ex.equipment}]`);
    }
  }
  return result;
}

(async () => {
  const catalog = await getCatalog();
  const byName = new Map(catalog.entries.map((e) => [e.name, e]));
  const targetOf = (n: string) =>
    [byName.get(n)?.targetMuscle, byName.get(n)?.bodyPart].map((x) =>
      (x || "").toLowerCase(),
    );

  // 0. Every staple name must exist, or it silently never gets picked.
  console.log("\nStaples exist in catalog");
  const lowerNames = new Set(catalog.entries.map((e) => e.lowerName));
  const missing = [...new Set(Object.values(STAPLES).flat())].filter(
    (n) => !lowerNames.has(n),
  );
  check(
    missing.length === 0,
    `all staples exist${missing.length ? ": missing " + missing.join(", ") : ""}`,
  );

  // 1. Single muscle -> one focused session
  const chest = await run("Chest only", { muscleGroups: ["chest"] });
  if (chest.ok) {
    check(chest.sessions.length === 1, "one session");
    check(
      chest.sessions[0].exercises.length === 5,
      "5 exercises for a lone large muscle",
    );
    check(
      chest.sessions[0].exercises.every((e) =>
        targetOf(e.name).some((t) => TARGETS.chest.includes(t)),
      ),
      "every exercise targets chest",
    );
  }

  // 2. Abs used to return nothing (chip id mismatch)
  const abs = await run("Abs only", { muscleGroups: ["abdominals"] });
  check(
    abs.ok && abs.sessions[0].exercises.length > 0,
    "abs returns exercises",
  );

  // 3. Six muscles across push/pull/legs, split mode
  const six = [
    "chest",
    "triceps",
    "lats",
    "biceps",
    "quadriceps",
    "hamstrings",
  ];
  const split = await run("Six muscles - split", {
    muscleGroups: six,
    mode: "split",
  });
  if (split.ok) {
    check(split.sessions.length === 3, "three sessions (push / pull / legs)");
    const names = split.sessions.map((s) => s.name).join(" | ");
    check(
      /Push Day/.test(names) && /Pull Day/.test(names) && /Leg Day/.test(names),
      "sessions named Push/Pull/Leg Day",
    );
    for (const s of split.sessions) {
      check(
        s.exercises.every((e) =>
          s.muscleGroups.some((m) =>
            targetOf(e.name).some((t) => (TARGETS[m] ?? []).includes(t)),
          ),
        ),
        `${s.name}: every exercise belongs to the session's muscles`,
      );
    }
    const ids = split.sessions.flatMap((s) =>
      s.exercises.map((e) => byName.get(e.name)?.exerciseDbId),
    );
    check(
      new Set(ids).size === ids.length,
      "no movement repeated across sessions",
    );
  }

  // 4. Same six muscles in ONE session stays a sane size
  const single = await run("Six muscles - single", { muscleGroups: six });
  if (single.ok) {
    check(single.sessions.length === 1, "one session");
    check(
      single.sessions[0].exercises.length <= 8,
      "capped at 8 exercises (was 18)",
    );
    const covered = new Set(
      single.sessions[0].exercises.map((e) => e.muscleGroup),
    );
    check(covered.size === 6, "still covers all six muscles");
  }

  // 5. Equipment filters that used to match nothing
  const machines = await run("Chest + lats, machines only", {
    muscleGroups: ["chest", "lats"],
    equipment: ["machines"],
  });
  check(
    machines.ok &&
      machines.sessions[0].exercises.every(
        (e) => byName.get(e.name)?.equipmentCategory === "machine",
      ),
    "machines filter returns only machine exercises",
  );
  const bodyweight = await run("Chest, bodyweight only", {
    muscleGroups: ["chest"],
    equipment: ["bodyweight"],
  });
  check(
    bodyweight.ok &&
      bodyweight.sessions[0].exercises.length > 0 &&
      bodyweight.sessions[0].exercises.every(
        (e) => byName.get(e.name)?.equipmentCategory === "bodyweight",
      ),
    "bodyweight filter works",
  );
  const bar = await run("Lats, pull-up bar only", {
    muscleGroups: ["lats"],
    equipment: ["pull_up_bar"],
  });
  check(
    bar.ok &&
      bar.sessions[0].exercises.length > 0 &&
      bar.sessions[0].exercises.every((e) => byName.get(e.name)?.usesPullUpBar),
    "pull-up bar filter returns bar exercises",
  );

  check(
    byName.get("Plank")?.equipmentCategory === "bodyweight",
    "Plank is tagged bodyweight",
  );
  if (split.ok) {
    const legDay = split.sessions.find((s) => /Leg Day/.test(s.name));
    check(
      !!legDay && /squat|leg press|lunge/i.test(legDay.exercises[0].name),
      "Leg Day opens with a squat / leg press / lunge",
    );
    const advancedPicked = split.sessions
      .flatMap((s) => s.exercises.map((e) => e.name))
      .filter((n) =>
        /muscle-up|pistol|handstand|sissy|clean and press/i.test(n),
      );
    check(
      advancedPicked.length === 0,
      `no advanced skill moves for intermediate${advancedPicked.length ? ": " + advancedPicked.join(", ") : ""}`,
    );
  }

  // 6. Quality: no stretches anywhere, staples present for big muscles
  const all = [chest, abs, split, single, machines, bodyweight, bar].flatMap(
    (r) =>
      r.ok ? r.sessions.flatMap((s) => s.exercises.map((e) => e.name)) : [],
  );
  check(
    !all.some((n) => /stretch/i.test(n)),
    "no stretches in generated workouts",
  );
  const popularShare =
    all.filter((n) => byName.get(n)?.popular).length / Math.max(1, all.length);
  console.log(
    `\n  popular/curated share of picks: ${(popularShare * 100).toFixed(0)}%`,
  );
  check(popularShare >= 0.4, "at least 40% of picks are well-known exercises");

  console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
  await pool.end();
  process.exit(failures ? 1 : 0);
})();
