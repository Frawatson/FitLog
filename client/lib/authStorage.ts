// Single source of truth for the auth-token storage key. Previously this
// constant was redeclared in three different modules (AuthContext, storage,
// syncService) — if anyone changed one and missed the others, users would
// silently log out. Import from here everywhere.
export const AUTH_TOKEN_KEY = "@merge_auth_token";
