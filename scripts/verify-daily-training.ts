// Checks the dashboard's workout ring states. Pure logic, no database.
//   npx tsx scripts/verify-daily-training.ts
import {
  routineWeekday,
  todayTraining,
  trainingRingFraction,
} from "../client/lib/dailyTraining";
import type { Routine, Workout } from "../client/types";
import {
  formatRoutineDays,
  isPlannedRestDay,
  isValidScheduledDays,
  routineDays,
} from "../shared/trainingSchedule";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
}

const routine = (name: string, exercises = 5): Routine => ({
  id: name,
  name,
  createdAt: "2026-01-01T00:00:00Z",
  exercises: Array.from({ length: exercises }, (_, i) => ({
    exerciseId: `e${i}`,
    exerciseName: `E${i}`,
    order: i,
  })),
});
const week = [
  "Monday-Chest+Tricep",
  "Tuesday-Back+Biceps",
  "Wednesday-legs+calves",
  "Thursday-Shoulder+Chest",
  "Friday-Back+Arms",
  "Saturday-Abs+Cardio",
  "Sunday-Recovery",
].map((n) => routine(n));

// Local dates in October 2026: the 8th is a Thursday.
const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 0);

check(routineWeekday("Thursday-Shoulder+Chest") === 4, "full weekday name");
check(routineWeekday("Mon - Legs") === 1, "abbreviated weekday");
check(routineWeekday("Thurs push") === 4, "Thurs abbreviation");
check(
  routineWeekday("Monster Arms") === null,
  "word starting with a weekday prefix",
);
check(routineWeekday("Push Day") === null, "unscheduled routine");

const thu = todayTraining({
  workouts: [],
  runs: [],
  routines: week,
  now: at(8, 9),
});
check(
  thu.kind === "planned" && thu.routine.name === "Thursday-Shoulder+Chest",
  "Thursday morning: today's routine is planned",
);

const sun = todayTraining({
  workouts: [],
  runs: [],
  routines: week,
  now: at(11, 9),
});
check(
  sun.kind === "rest" && sun.routine?.name === "Sunday-Recovery",
  "Sunday: recovery routine is a rest day",
);

const partial = week.slice(0, 5);
const sat = todayTraining({
  workouts: [],
  runs: [],
  routines: partial,
  now: at(10, 9),
});
check(sat.kind === "rest" && !sat.routine, "day not in the plan is a rest day");

const none = todayTraining({
  workouts: [],
  runs: [],
  routines: [routine("Push Day")],
  now: at(8, 9),
});
check(none.kind === "open", "no weekday routines: no plan");

// The late Thursday session (11:05 PM to 12:19 AM), 4 of 7 exercises done.
const set = (completed: boolean) => ({
  id: "s",
  weight: 50,
  reps: 10,
  completed,
});
const lateThursday: Workout = {
  id: "w1",
  routineId: "Thursday-Shoulder+Chest",
  routineName: "Thursday-Shoulder+Chest",
  startedAt: at(8, 23).toISOString(),
  completedAt: new Date(at(8, 23).getTime() + 74 * 60000).toISOString(),
  exercises: [
    ...Array.from({ length: 4 }, (_, i) => ({
      exerciseId: `d${i}`,
      exerciseName: `D${i}`,
      sets: [set(true), set(true), set(true)],
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      exerciseId: `s${i}`,
      exerciseName: `S${i}`,
      sets: [set(false), set(false), set(false)],
    })),
  ],
};
const thuNight = todayTraining({
  workouts: [lateThursday],
  runs: [],
  routines: week,
  now: at(8, 23),
});
check(
  thuNight.kind === "done" &&
    thuNight.completedSets === 12 &&
    thuNight.totalSets === 21,
  "Thursday: done, 12 of 21 sets",
);
check(
  Math.abs(trainingRingFraction(thuNight) - 12 / 21) < 1e-9,
  "ring is partly filled for skipped sets",
);

const friMorning = todayTraining({
  workouts: [lateThursday],
  runs: [],
  routines: week,
  now: at(9, 8),
});
check(
  friMorning.kind === "planned" &&
    friMorning.routine.name === "Friday-Back+Arms",
  "Friday morning: Thursday's late session doesn't fill Friday's ring",
);

const runDay = todayTraining({
  workouts: [],
  runs: [
    {
      id: "r1",
      distanceKm: 5,
      durationSeconds: 1500,
      paceMinPerKm: 5,
      startedAt: at(11, 7).toISOString(),
      completedAt: at(11, 8).toISOString(),
    } as any,
  ],
  routines: week,
  now: at(11, 12),
});
check(
  runDay.kind === "done" && trainingRingFraction(runDay) === 1,
  "a run counts as training, ring full",
);

// Explicit training days (the routine editor's picker).
const pushDay = { ...routine("Push Day"), scheduledDays: [1, 4] };
const legDay = { ...routine("Leg Day"), scheduledDays: [3] };
const renamed = { ...routine("Thursday-Shoulder+Chest"), scheduledDays: [] };
const explicit = [pushDay, legDay, renamed];
const mon = todayTraining({
  workouts: [],
  runs: [],
  routines: explicit,
  now: at(5, 9),
});
check(
  mon.kind === "planned" && mon.routine.name === "Push Day",
  "explicit days: Monday plans Push Day (no weekday in the name)",
);
const thuExplicit = todayTraining({
  workouts: [],
  runs: [],
  routines: explicit,
  now: at(8, 9),
});
check(
  thuExplicit.kind === "planned" && thuExplicit.routine.name === "Push Day",
  "a routine can be scheduled on several days",
);
const tueExplicit = todayTraining({
  workouts: [],
  runs: [],
  routines: explicit,
  now: at(6, 9),
});
check(tueExplicit.kind === "rest", "unscheduled weekday is a rest day");
check(
  routineDays(renamed).length === 0,
  "an empty schedule turns off weekday-name inference",
);
check(
  routineDays({ ...routine("Friday-Back+Arms") }).join() === "5",
  "no explicit days: inferred from the name",
);
check(
  isPlannedRestDay(week, 0) && !isPlannedRestDay(week, 4),
  "Sunday-Recovery week: Sunday is a planned rest day, Thursday isn't",
);
check(!isPlannedRestDay([routine("Push Day")], 2), "no plan: no rest days");
check(isValidScheduledDays([0, 6]), "valid days accepted");
check(
  !isValidScheduledDays([7]) &&
    !isValidScheduledDays([1, 1]) &&
    !isValidScheduledDays("1"),
  "invalid days rejected",
);
check(formatRoutineDays(pushDay) === "Mon · Thu", "days label");

console.log(failures ? `${failures} FAILURE(S)` : "ALL PASS");
process.exit(failures ? 1 : 0);
