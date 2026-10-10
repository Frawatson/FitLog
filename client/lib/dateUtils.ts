/**
 * Returns a YYYY-MM-DD string using local timezone (not UTC).
 * Replaces the common `new Date().toISOString().split("T")[0]` pattern
 * which incorrectly returns UTC dates.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string as a local-tz Date (not UTC midnight).
 * `new Date("2026-05-27")` interprets the string as UTC midnight, which
 * in negative-UTC zones lands on the previous day's evening — corrupting
 * any subsequent local-tz arithmetic (getDay, setDate, toLocaleDateString).
 * Use this whenever the input is a date-only YYYY-MM-DD produced by
 * `getLocalDateString` or any storage layer that stripped the time.
 */
export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// The local day a workout or run counts toward: the day it started. A
// session begun at 11 PM Thursday and finished after midnight belongs to
// Thursday, not Friday.
export function activityDate(session: {
  startedAt?: string | null;
  completedAt?: string | null;
}): Date {
  return new Date(session.startedAt || session.completedAt || 0);
}

export function activityDay(session: {
  startedAt?: string | null;
  completedAt?: string | null;
}): string {
  return getLocalDateString(activityDate(session));
}

// A duration for display: "45 min" under an hour, "1h 14m" from an hour.
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
