// The user's weekly training plan, shared by the app (dashboard ring)
// and the server (streak). A routine's days come from its explicit
// `scheduledDays` (0 = Sunday … 6 = Saturday) when set — an empty array
// means "not scheduled" — and otherwise from a weekday at the start of
// its name ("Thursday-Shoulder+Chest", "Mon - Legs").

export interface ScheduleRoutine {
  name: string;
  exercises?: unknown[];
  scheduledDays?: number[] | null;
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export function isValidScheduledDays(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length <= 7 &&
    value.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    new Set(value).size === value.length
  );
}

export function routineDays(routine: ScheduleRoutine): number[] {
  if (Array.isArray(routine.scheduledDays)) {
    return [...routine.scheduledDays].sort((a, b) => a - b);
  }
  const inferred = routineWeekday(routine.name);
  return inferred === null ? [] : [inferred];
}

export function isRestRoutine(routine: ScheduleRoutine): boolean {
  return (
    /\b(rest|recovery|off)\b/i.test(routine.name) ||
    (Array.isArray(routine.exercises) && routine.exercises.length === 0)
  );
}

export function hasWeeklyPlan(routines: ScheduleRoutine[]): boolean {
  return routines.some((r) => routineDays(r).length > 0);
}

export function routinesForWeekday<T extends ScheduleRoutine>(
  routines: T[],
  weekday: number,
): T[] {
  return routines.filter((r) => routineDays(r).includes(weekday));
}

// A planned rest day: there is a weekly plan and nothing to train that
// weekday (no routine, or only rest/recovery ones).
export function isPlannedRestDay(
  routines: ScheduleRoutine[],
  weekday: number,
): boolean {
  if (!hasWeeklyPlan(routines)) return false;
  return !routinesForWeekday(routines, weekday).some((r) => !isRestRoutine(r));
}

// "Mon · Thu", or "" when unscheduled.
export function formatRoutineDays(routine: ScheduleRoutine): string {
  return routineDays(routine)
    .map((d) => WEEKDAY_SHORT[d])
    .join(" · ");
}
