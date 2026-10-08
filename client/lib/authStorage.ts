import AsyncStorage from "@react-native-async-storage/async-storage";

// Single source of truth for the auth-token storage key. Previously this
// constant was redeclared in three different modules (AuthContext, storage,
// syncService) — if anyone changed one and missed the others, users would
// silently log out. Import from here everywhere.
export const AUTH_TOKEN_KEY = "@merge_auth_token";

// Synchronous in-memory mirror of the stored token, for call sites that
// can't await (e.g. building an Image source with an Authorization header
// during render). Primed at module load and kept fresh by AuthContext on
// login/logout.
let cachedToken: string | null = null;

AsyncStorage.getItem(AUTH_TOKEN_KEY)
  .then((t) => {
    // A setCachedAuthToken call may have landed first; don't clobber it.
    if (cachedToken === null && t) cachedToken = t;
  })
  .catch(() => {});

export function getCachedAuthToken(): string | null {
  return cachedToken;
}

export function setCachedAuthToken(token: string | null): void {
  cachedToken = token;
}
