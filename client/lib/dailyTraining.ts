import type { Routine, RunEntry, Workout } from "@/types";
import { activityDay, getLocalDateString } from "@/lib/dateUtils";

import {
  hasWeeklyPlan,
  isRestRoutine,
  routinesForWeekday,
} from "../../shared/trainingSchedule";

// What today's training looks like, for the dashboard's workout ring.
// Today's plan comes from the routines scheduled for this weekday (see
// shared/trainingSchedule); rest/recovery routines mark a rest day.

export { routineWeekday } from "../../shared/trainingSchedule";

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

  if (!hasWeeklyPlan(routines)) return { kind: "open" };

  const forToday = routinesForWeekday(routines, now.getDay());
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
