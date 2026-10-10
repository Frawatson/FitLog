import type { Routine, RunEntry, Workout } from "@/types";
import { activityDay, getLocalDateString } from "@/lib/dateUtils";

// What today's training looks like, for the dashboard's workout ring.
// There is no explicit schedule; a routine named for a weekday
// ("Thursday-Shoulder+Chest", "Mon - Legs") is the plan for that day,
// and one named rest/recovery/off marks a planned rest day.

const WEEKDAY_PATTERN =
  /^\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)(?![a-z])/i;
const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export function routineWeekday(name: string): number | null {
  const m = WEEKDAY_PATTERN.exec(name);
  return m ? WEEKDAY_INDEX[m[1].slice(0, 3).toLowerCase()] : null;
}

export function isRestRoutine(routine: Routine): boolean {
  return (
    /\b(rest|recovery|off)\b/i.test(routine.name) ||
    routine.exercises.length === 0
  );
}

export interface TrainingSession {
  type: "workout" | "run";
  id: string;
  name: string;
}

export type TodayTraining =
  | {
      kind: "done";
      sessions: TrainingSession[];
      completedSets: number;
      totalSets: number;
    }
  | { kind: "planned"; routine: Routine }
  | { kind: "rest"; routine?: Routine }
  | { kind: "open" };

export function todayTraining({
  workouts,
  runs,
  routines,
  now = new Date(),
}: {
  workouts: Workout[];
  runs: RunEntry[];
  routines: Routine[];
  now?: Date;
}): TodayTraining {
  const today = getLocalDateString(now);

  const todaysWorkouts = workouts.filter(
    (w) => w.completedAt && activityDay(w) === today,
  );
  const todaysRuns = runs.filter((r) => activityDay(r) === today);
  if (todaysWorkouts.length || todaysRuns.length) {
    let completedSets = 0;
    let totalSets = 0;
    for (const w of todaysWorkouts) {
      for (const ex of w.exercises) {
        totalSets += ex.sets.length;
        completedSets += ex.sets.filter((s) => s.completed).length;
      }
    }
    return {
      kind: "done",
      sessions: [
        ...todaysWorkouts.map((w) => ({
          type: "workout" as const,
          id: w.id,
          name: w.routineName,
        })),
        ...todaysRuns.map((r) => ({
          type: "run" as const,
          id: r.id,
          name: "Run",
        })),
      ],
      completedSets,
      totalSets,
    };
  }

  const scheduled = routines.filter((r) => routineWeekday(r.name) !== null);
  if (scheduled.length === 0) return { kind: "open" };

  const forToday = scheduled.filter(
    (r) => routineWeekday(r.name) === now.getDay(),
  );
  const training = forToday.find((r) => !isRestRoutine(r));
  if (training) return { kind: "planned", routine: training };
  // A rest/recovery routine for today, or today simply isn't in the plan.
  return { kind: "rest", routine: forToday[0] };
}

// How full the ring is. A finished session with skipped sets shows a
// partial ring; runs and sessions without set detail count as complete.
export function trainingRingFraction(t: TodayTraining): number {
  if (t.kind !== "done") return 0;
  if (t.totalSets === 0) return 1;
  return Math.max(t.completedSets / t.totalSets, 0.05);
}
