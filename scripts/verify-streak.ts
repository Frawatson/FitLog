// Checks the streak rules (shared/streak) and the server's computation
// on real history. Read-only against the configured database. Run:
//   npx tsx scripts/verify-streak.ts
import "dotenv/config";
import { computeStreak, shiftYmd } from "../shared/streak";
import { isPlannedRestDay } from "../shared/trainingSchedule";
import { getUserStreak, isValidTimeZone, pool } from "../server/db";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
}

// 2026-10-10 is a Saturday; 2026-10-11 a Sunday.
const SAT = "2026-10-10";
const run = (days: string[], today: string, rest?: (w: number) => boolean) =>
  computeStreak(days, today, rest);

check(run([], SAT).currentStreak === 0, "no history: 0");
check(
  run(["2026-10-08", "2026-10-09", SAT], SAT).currentStreak === 3,
  "three days in a row including today: 3",
);
check(
  run(["2026-10-08", "2026-10-09"], SAT).currentStreak === 2,
  "nothing yet today: the streak isn't broken until the day ends",
);
check(
  run(["2026-10-07", "2026-10-08"], SAT).currentStreak === 0,
  "a missed day (Friday) breaks it",
);
const old = run(["2026-10-01", "2026-10-02", "2026-10-03"], SAT);
check(
  old.currentStreak === 0 && old.longestStreak === 3,
  "stale streak decays to 0; best is kept",
);

// Sunday is a planned rest day.
const sundayRest = (w: number) => w === 0;
check(
  run(["2026-10-10", "2026-10-12"], "2026-10-12", sundayRest).currentStreak ===
    2,
  "Sat, rest Sun, Mon: rest day is neutral (2)",
);
check(
  run(["2026-10-10", "2026-10-11", "2026-10-12"], "2026-10-12", sundayRest)
    .currentStreak === 3,
  "training on a rest day still counts",
);
check(
  run(["2026-10-10", "2026-10-12"], "2026-10-12").currentStreak === 1,
  "without a plan the same gap breaks it",
);
check(
  run(["2026-10-09"], "2026-10-12", sundayRest).currentStreak === 0,
  "a rest day doesn't bridge a real miss (Sat)",
);
check(
  run([shiftYmd(SAT, 1)], SAT).currentStreak === 0,
  "future-dated days are ignored",
);

const plan = [
  { name: "Monday-Chest", exercises: [1] },
  { name: "Sunday-Recovery", exercises: [1] },
];
check(isPlannedRestDay(plan, 0), "Sunday-Recovery makes Sunday a rest day");
check(isValidTimeZone("America/Chicago"), "valid timezone accepted");
check(
  !isValidTimeZone("Mars/Base") && !isValidTimeZone("'; DROP"),
  "invalid timezone rejected",
);

(async () => {
  // Real history (read-only): the account that logged the Thursday session.
  const u = await pool.query(
    "SELECT user_id FROM workouts WHERE routine_name = 'Thursday-Shoulder+Chest' LIMIT 1",
  );
  if (u.rows.length) {
    const userId = u.rows[0].user_id;
    const tz = (
      await pool.query("SELECT timezone FROM users WHERE id = $1", [userId])
    ).rows[0].timezone;
    const days = (
      await pool.query(
        `SELECT DISTINCT to_char((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') AS d
           FROM workouts WHERE user_id = $1 AND completed_at IS NOT NULL ORDER BY d DESC LIMIT 8`,
        [userId],
      )
    ).rows.map((r) => r.d);
    const streak = await getUserStreak(userId);
    console.log(
      `  stored timezone: ${tz ?? "(none yet, UTC)"}; recent Chicago days: ${days.join(", ")}`,
    );
    console.log(`  server streak now: ${JSON.stringify(streak)}`);
    check(
      streak.lastActivityDate !== null && streak.currentStreak >= 0,
      "server computes a streak from history",
    );
  }
  console.log(failures ? `${failures} FAILURE(S)` : "ALL PASS");
  await pool.end();
  process.exit(failures ? 1 : 0);
})();
