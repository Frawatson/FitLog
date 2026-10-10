// Training streak, computed from the days the user actually trained
// (local calendar days, YYYY-MM-DD). Shared by the server (dashboard,
// community profile) and the app (streak achievements) so both agree.
//
// - a day with a workout or run extends the streak
// - a planned rest day without training is neutral: it neither breaks
//   nor extends the streak
// - any other day without training breaks it
// - today doesn't count against the streak until it's over

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

function toUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function weekdayOf(ymd: string): number {
  return toUtcDate(ymd).getUTCDay();
}

export function shiftYmd(ymd: string, days: number): string {
  const d = toUtcDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return toYmd(d);
}

const MAX_DAYS = 3660;

export function computeStreak(
  activityDays: Iterable<string>,
  today: string,
  isRestDay: (weekday: number) => boolean = () => false,
): StreakResult {
  const days = new Set(
    [...activityDays].filter(
      (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today,
    ),
  );
  if (days.size === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
  }
  const sorted = [...days].sort();
  const lastActivityDate = sorted[sorted.length - 1];

  // Walk forward from the first training day (bounded) to today.
  let cursor = sorted[0];
  const earliest = shiftYmd(today, -MAX_DAYS);
  if (cursor < earliest) cursor = earliest;

  let run = 0;
  let longest = 0;
  while (cursor <= today) {
    if (days.has(cursor)) {
      run++;
      if (run > longest) longest = run;
    } else if (cursor === today || isRestDay(weekdayOf(cursor))) {
      // Today isn't over yet; planned rest days are neutral.
    } else {
      run = 0;
    }
    cursor = shiftYmd(cursor, 1);
  }

  return { currentStreak: run, longestStreak: longest, lastActivityDate };
}
