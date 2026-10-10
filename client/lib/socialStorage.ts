import { syncToServer } from "@/lib/syncService";
import type {
  Post,
  PostComment,
  SocialProfile,
  FollowUser,
  PostType,
  PostVisibility,
  Notification,
  BlockedUser,
} from "@/types";

// READ functions THROW on failure instead of returning empty results.
// The old behavior turned every network failure into "No posts yet" /
// "No followers" empty states and silently killed pagination — screens
// could never distinguish an outage from genuinely empty data. Callers
// catch and surface a retryable error state.
class SocialApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "SocialApiError";
    this.status = status;
  }
}

// ========== Feed ==========

export async function getFeed(
  cursor?: string,
): Promise<{ posts: Post[]; nextCursor?: string; serverTime?: string }> {
  const endpoint = cursor
    ? `/api/social/feed?cursor=${encodeURIComponent(cursor)}`
    : "/api/social/feed";
  const result = await syncToServer<{
    posts: Post[];
    nextCursor?: string;
    serverTime?: string;
  }>(endpoint, "GET");
  if (result.success && result.data) return result.data;
  throw new SocialApiError(
    result.error || "Failed to load feed",
    result.status,
  );
}

export async function getUserPostsFeed(
  userId: number,
  cursor?: string,
): Promise<{ posts: Post[]; nextCursor?: string; serverTime?: string }> {
  const endpoint = cursor
    ? `/api/social/posts/user/${userId}?cursor=${encodeURIComponent(cursor)}`
    : `/api/social/posts/user/${userId}`;
  const result = await syncToServer<{
    posts: Post[];
    nextCursor?: string;
    serverTime?: string;
  }>(endpoint, "GET");
  if (result.success && result.data) return result.data;
  throw new SocialApiError(
    result.error || "Failed to load posts",
    result.status,
  );
}

// ========== Posts ==========

export async function createSocialPost(post: {
  clientId: string;
  postType: PostType;
  content?: string;
  referenceId?: string;
  referenceData?: any;
  imageData?: string;
  visibility?: PostVisibility;
}): Promise<{ success: boolean; postId?: number; error?: string }> {
  const result = await syncToServer<{ success: boolean; postId: number }>(
    "/api/social/posts",
    "POST",
    post,
  );
  if (result.success && result.data) return result.data;
  // Pass the server's reason through (e.g. a rejected photo) instead of
  // leaving the screen to show a generic failure.
  return { success: false, error: result.error };
}

export async function getPostById(
  postId: number,
): Promise<(Post & { serverTime?: string }) | null> {
  const result = await syncToServer<Post & { serverTime?: string }>(
    `/api/social/posts/${postId}`,
    "GET",
  );
  if (result.success && result.data) return result.data;
  // A 404 is a real answer (deleted/invisible post), not a failure.
  if (result.status === 404) return null;
  throw new SocialApiError(
    result.error || "Failed to load post",
    result.status,
  );
}

export async function deleteSocialPost(postId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    `/api/social/posts/${postId}`,
    "DELETE",
  );
  return result.success && !!result.data?.success;
}

// ========== Likes ==========

export async function likePostApi(postId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    `/api/social/posts/${postId}/like`,
    "POST",
  );
  return result.success && !!result.data?.success;
}

export async function unlikePostApi(postId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    `/api/social/posts/${postId}/like`,
    "DELETE",
  );
  return result.success && !!result.data?.success;
}

// ========== Comments ==========

export async function getComments(
  postId: number,
  page = 0,
): Promise<{ comments: PostComment[]; serverTime?: string }> {
  const result = await syncToServer<{
    comments: PostComment[];
    serverTime?: string;
  }>(`/api/social/posts/${postId}/comments?page=${page}`, "GET");
  if (result.success && result.data) return result.data;
  throw new SocialApiError(
    result.error || "Failed to load comments",
    result.status,
  );
}

export async function addCommentApi(
  postId: number,
  clientId: string,
  content: string,
): Promise<PostComment | null> {
  const result = await syncToServer<PostComment>(
    `/api/social/posts/${postId}/comments`,
    "POST",
    { clientId, content },
  );
  if (result.success && result.data) return result.data;
  return null;
}

export async function deleteCommentApi(commentId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    `/api/social/comments/${commentId}`,
    "DELETE",
  );
  return result.success && !!result.data?.success;
}

// ========== Follows ==========

export async function followUserApi(userId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    `/api/social/follow/${userId}`,
    "POST",
  );
  return result.success && !!result.data?.success;
}

export async function unfollowUserApi(userId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    `/api/social/follow/${userId}`,
    "DELETE",
  );
  return result.success && !!result.data?.success;
}

export async function getFollowersList(
  userId: number,
  page = 0,
): Promise<FollowUser[]> {
  const result = await syncToServer<FollowUser[]>(
    `/api/social/followers/${userId}?page=${page}`,
    "GET",
  );
  if (result.success && result.data) return result.data;
  throw new SocialApiError(
    result.error || "Failed to load followers",
    result.status,
  );
}

export async function getFollowingList(
  userId: number,
  page = 0,
): Promise<FollowUser[]> {
  const result = await syncToServer<FollowUser[]>(
    `/api/social/following/${userId}?page=${page}`,
    "GET",
  );
  if (result.success && result.data) return result.data;
  throw new SocialApiError(
    result.error || "Failed to load following",
    result.status,
  );
}

// ========== User Discovery & Profile ==========

export async function searchUsersApi(query: string): Promise<FollowUser[]> {
  const result = await syncToServer<FollowUser[]>(
    `/api/social/users/search?q=${encodeURIComponent(query)}`,
    "GET",
  );
  if (result.success && result.data) return result.data;
  throw new SocialApiError(result.error || "Search failed", result.status);
}

export async function getSocialProfileApi(
  userId: number,
): Promise<SocialProfile | null> {
  const result = await syncToServer<SocialProfile>(
    `/api/social/users/${userId}/profile`,
    "GET",
  );
  if (result.success && result.data) return result.data;
  if (result.status === 404) return null;
  throw new SocialApiError(
    result.error || "Failed to load profile",
    result.status,
  );
}

export async function updateSocialProfileApi(data: {
  bio?: string;
  avatarUrl?: string;
  isPublic?: boolean;
}): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    "/api/social/profile",
    "PUT",
    data,
  );
  return result.success && !!result.data?.success;
}

// Avatar upload returns the new avatar URL (a data: URI) on success, null
// on failure. Caller is responsible for compressing the image before
// sending; the server resizes again as a safety net but smaller input
// means faster upload + lower memory pressure.
export async function uploadAvatarApi(
  imageBase64: string,
): Promise<string | null> {
  const result = await syncToServer<{ success: boolean; avatarUrl: string }>(
    "/api/social/avatar",
    "POST",
    { imageBase64 },
  );
  if (result.success && result.data?.success && result.data.avatarUrl) {
    return result.data.avatarUrl;
  }
  return null;
}

// ========== Block & Report ==========

export async function blockUserApi(userId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    `/api/social/block/${userId}`,
    "POST",
  );
  return result.success && !!result.data?.success;
}

export async function unblockUserApi(userId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    `/api/social/block/${userId}`,
    "DELETE",
  );
  return result.success && !!result.data?.success;
}

export async function getBlockedUsersApi(): Promise<BlockedUser[]> {
  const result = await syncToServer<BlockedUser[]>(
    "/api/social/blocked",
    "GET",
  );
  if (result.success && result.data) return result.data;
  throw new SocialApiError(
    result.error || "Failed to load blocked users",
    result.status,
  );
}

export async function reportContentApi(
  reportType: "post" | "comment" | "user",
  targetId: number,
  reason: string,
  details?: string,
): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    "/api/social/report",
    "POST",
    { reportType, targetId, reason, details },
  );
  return result.success && !!result.data?.success;
}

// ========== Notifications ==========

export async function getNotificationsApi(
  page = 0,
): Promise<{ notifications: Notification[] }> {
  const result = await syncToServer<{ notifications: Notification[] }>(
    `/api/notifications?page=${page}`,
    "GET",
  );
  if (result.success && result.data) return result.data;
  throw new SocialApiError(
    result.error || "Failed to load notifications",
    result.status,
  );
}

export async function markNotificationsReadApi(): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    "/api/notifications/read",
    "POST",
  );
  return result.success && !!result.data?.success;
}

export async function getUnreadCountApi(): Promise<number> {
  const result = await syncToServer<{ count: number }>(
    "/api/notifications/unread-count",
    "GET",
  );
  if (result.success && result.data) return result.data.count;
  return 0;
}

// ========== Edit Post & Comment ==========

export async function editPostApi(
  postId: number,
  content: string,
): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    `/api/social/posts/${postId}`,
    "PUT",
    { content },
  );
  return result.success && !!result.data?.success;
}

export async function editCommentApi(
  commentId: number,
  content: string,
): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(
    `/api/social/comments/${commentId}`,
    "PUT",
    { content },
  );
  return result.success && !!result.data?.success;
}
