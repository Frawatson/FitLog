import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Centralized input limits. Adjust here, not at call sites.
export const LIMITS = {
  POST_CONTENT: 2000,
  COMMENT_CONTENT: 1000,
  BIO: 500,
  AVATAR_URL: 2048,
  REPORT_DETAILS: 1000,
  CLIENT_ID: 128,
  REFERENCE_ID: 128,
  SEARCH_QUERY: 200,
  // Base64-encoded image caps. base64 inflates raw bytes by ~33%, so the
  // underlying JPEG is roughly (cap * 0.75).
  POST_IMAGE_BASE64: 700_000, // ~525 KB JPEG
  ANALYZE_PHOTO_BASE64: 3_000_000, // ~2.25 MB JPEG
} as const;

export const POST_TYPES = new Set([
  "workout",
  "run",
  "meal",
  "achievement",
  "text",
]);

export const POST_VISIBILITIES = new Set(["followers", "public"]);

export const REPORT_TYPES = new Set(["post", "comment", "user"]);

export const REPORT_REASONS = new Set([
  "spam",
  "harassment",
  "inappropriate",
  "other",
]);

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function requireString(
  value: unknown,
  field: string,
  maxLen: number,
  opts: { allowEmpty?: boolean } = {},
): ValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a string` };
  }
  if (value.length > maxLen) {
    return { ok: false, error: `${field} must be ${maxLen} characters or fewer` };
  }
  if (!opts.allowEmpty && value.trim().length === 0) {
    return { ok: false, error: `${field} is required` };
  }
  return { ok: true, value };
}

export function optionalString(
  value: unknown,
  field: string,
  maxLen: number,
): ValidationResult<string | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  return requireString(value, field, maxLen, { allowEmpty: true });
}

export function requireEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: Set<T>,
): ValidationResult<T> {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    return { ok: false, error: `${field} must be one of: ${[...allowed].join(", ")}` };
  }
  return { ok: true, value: value as T };
}

export function optionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: Set<T>,
): ValidationResult<T | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  return requireEnum(value, field, allowed);
}

export function requirePositiveInt(
  value: unknown,
  field: string,
): ValidationResult<number> {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > 2_147_483_647 // postgres int4 max
  ) {
    return { ok: false, error: `${field} must be a positive integer` };
  }
  return { ok: true, value };
}

// Accepts raw base64 (no data: prefix). Strips a leading data URL if present
// so the caller always receives clean base64 bytes. Validates the byte count
// against the size cap BEFORE any decoding so we never allocate a giant
// buffer for an oversized payload.
export function requireBase64Image(
  value: unknown,
  field: string,
  maxBytes: number,
): ValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: `${field} must be a base64 string` };
  }
  if (value.length === 0) {
    return { ok: false, error: `${field} is required` };
  }
  if (value.length > maxBytes) {
    return {
      ok: false,
      error: `${field} exceeds ${Math.floor(maxBytes / 1024)}KB limit`,
    };
  }
  const stripped = value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(stripped)) {
    return { ok: false, error: `${field} is not valid base64` };
  }
  return { ok: true, value: stripped };
}

// Validates a URL string. Production avatar URLs must be https; in
// development http is also accepted for local testing.
export function requireImageUrl(
  value: unknown,
  field: string,
  maxLen: number,
): ValidationResult<string> {
  if (typeof value !== "string" || value.length === 0) {
    return { ok: false, error: `${field} is required` };
  }
  if (value.length > maxLen) {
    return { ok: false, error: `${field} is too long` };
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: `${field} must be a valid URL` };
  }
  const isProduction = process.env.NODE_ENV === "production";
  const allowedProtocols = isProduction
    ? new Set(["https:"])
    : new Set(["https:", "http:"]);
  if (!allowedProtocols.has(parsed.protocol)) {
    return {
      ok: false,
      error: isProduction
        ? `${field} must be an https URL`
        : `${field} must use http or https`,
    };
  }
  return { ok: true, value };
}

export function requireBoolean(
  value: unknown,
  field: string,
): ValidationResult<boolean> {
  if (typeof value !== "boolean") {
    return { ok: false, error: `${field} must be a boolean` };
  }
  return { ok: true, value };
}

export function optionalBoolean(
  value: unknown,
  field: string,
): ValidationResult<boolean | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  return requireBoolean(value, field);
}

// Per-authenticated-user rate limiter. Falls back to IP for unauthenticated
// requests (which shouldn't hit AI endpoints anyway thanks to requireAuth,
// but keep a safe default). The IP fallback uses express-rate-limit's
// ipKeyGenerator helper so IPv6 addresses are normalized to a /64 prefix —
// otherwise an attacker on IPv6 could rotate addresses within their subnet
// to bypass per-IP limits.
export function userRateLimiter(opts: {
  windowMs: number;
  max: number;
  message: string;
}) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    message: { error: opts.message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const userId = (req as Request & { userId?: number }).userId;
      if (userId !== undefined) return `u:${userId}`;
      return ipKeyGenerator(req.ip ?? "");
    },
  });
}

// Wraps user-controlled text for inclusion in an LLM prompt so model
// instructions and user content cannot be confused. Strips the delimiter
// tag from input to prevent the user from closing the wrapper themselves.
export function delimitUserContent(tag: string, text: string): string {
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  const cleaned = text.split(openTag).join("").split(closeTag).join("");
  return `${openTag}${cleaned}${closeTag}`;
}

