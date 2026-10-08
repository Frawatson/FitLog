import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import { getCachedAuthToken } from "@/lib/authStorage";

// Builds an <Image source> for media the API serves from authenticated
// endpoints (avatars, post photos). The server returns server-relative
// paths like "/api/social/users/5/avatar"; data: URIs and absolute URLs
// pass through untouched.
//
// Auth: on web, the <img> request is same-origin so the session cookie
// rides along automatically (headers can't be attached to an <img>). On
// native, RN Image supports per-request headers, so the Bearer token is
// attached explicitly.
export function apiImageSource(
  pathOrUri?: string | null,
): { uri: string; headers?: Record<string, string> } | undefined {
  if (!pathOrUri) return undefined;
  if (!pathOrUri.startsWith("/")) {
    return { uri: pathOrUri };
  }
  const uri = new URL(pathOrUri, getApiUrl()).toString();
  if (Platform.OS === "web") {
    return { uri };
  }
  const token = getCachedAuthToken();
  return token
    ? { uri, headers: { Authorization: `Bearer ${token}` } }
    : { uri };
}
