// Checks the dashboard's workout ring states. Pure logic, no database.
//   npx tsx scripts/verify-daily-training.ts
import {
  routineWeekday,
  todayTraining,
  trainingRingFraction,
} from "../client/lib/dailyTraining";
import type { Routine, Workout } from "../client/types";

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

console.log(failures ? `${failures} FAILURE(S)` : "ALL PASS");
process.exit(failures ? 1 : 0);
