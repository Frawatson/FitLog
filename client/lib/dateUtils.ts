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
