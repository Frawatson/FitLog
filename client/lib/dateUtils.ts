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
