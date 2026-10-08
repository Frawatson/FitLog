// In-memory handoff for navigation payloads that must NOT go through
// route params. React Navigation serializes params into the web URL:
// objects become the literal string "[object Object]" (crashing the
// target screen on refresh/deep link), and PhotoReview's base64 image
// used to be pushed into the address bar and browser history wholesale
// (multi-MB URLs). Big or structured payloads go here; the route carries
// at most a primitive key.
//
// Semantics: take() consumes the value. After a page refresh the store
// is empty, so target screens must handle "no payload" gracefully
// (show an expired/fallback state) instead of crashing.

const store = new Map<string, unknown>();

export function stashTransient(key: string, value: unknown): void {
  store.set(key, value);
}

export function takeTransient<T>(key: string): T | undefined {
  const value = store.get(key) as T | undefined;
  store.delete(key);
  return value;
}
