// Checks that workouts and runs count toward the local day they started.
// Pure logic, no database. Run in a non-UTC zone to exercise it:
//   TZ=America/Chicago npx tsx scripts/verify-activity-day.ts
import { activityDay } from "../client/lib/dateUtils";
import { resolveActivityDay } from "../server/db";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
}

const offsetMin = new Date("2026-10-09T12:00:00Z").getTimezoneOffset();
console.log(
  `  timezone offset: UTC${offsetMin > 0 ? "-" : "+"}${Math.abs(offsetMin) / 60}`,
);

if (offsetMin === 300) {
  // The real session: started 11:05 PM Thursday, finished 12:19 AM Friday.
  const thursday = {
    startedAt: "2026-10-09T04:05:08.464Z",
    completedAt: "2026-10-09T05:19:27.965Z",
  };
  check(
    activityDay(thursday) === "2026-10-08",
    "late Thursday session counts on Thursday",
  );
  check(
    activityDay({ completedAt: thursday.completedAt }) === "2026-10-09",
    "missing start falls back to completion day",
  );
} else {
  console.log("  (set TZ=America/Chicago for the Thursday case)");
}

const now = new Date();
const start = new Date(now);
start.setHours(0, 0, 0, 0);
start.setMinutes(-30); // 11:30 PM yesterday, local
const end = new Date(start.getTime() + 75 * 60 * 1000);
const yesterdayLocal = new Date(now);
yesterdayLocal.setDate(now.getDate() - 1);
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
check(
  activityDay({
    startedAt: start.toISOString(),
    completedAt: end.toISOString(),
  }) === ymd(yesterdayLocal),
  "session crossing midnight counts on the start day",
);

// Server: accepts the client's local day only within a sane window.
const utcToday = now.toISOString().split("T")[0];
const shift = (n: number) => {
  const d = new Date(`${utcToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
};
check(
  resolveActivityDay(shift(-1)) === shift(-1),
  "server accepts yesterday's local day",
);
check(
  resolveActivityDay(shift(1)) === shift(1),
  "server accepts tomorrow (UTC+ zones)",
);
check(resolveActivityDay(shift(-5)) === utcToday, "server rejects a stale day");
check(resolveActivityDay(shift(3)) === utcToday, "server rejects a future day");
check(
  resolveActivityDay("2026-02-31") === utcToday,
  "server rejects an impossible date",
);
check(
  resolveActivityDay(undefined) === utcToday,
  "older clients fall back to UTC today",
);

console.log(failures ? `${failures} FAILURE(S)` : "ALL PASS");
process.exit(failures ? 1 : 0);
