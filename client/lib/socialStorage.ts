import { syncToServer } from "@/lib/syncService";
import type { Post, PostComment, SocialProfile, FollowUser, PostType, PostVisibility } from "@/types";

// ========== Feed ==========

export async function getFeed(cursor?: string): Promise<{ posts: Post[]; nextCursor?: string }> {
  const endpoint = cursor ? `/api/social/feed?cursor=${encodeURIComponent(cursor)}` : "/api/social/feed";
  const result = await syncToServer<{ posts: Post[]; nextCursor?: string }>(endpoint, "GET");
  if (result.success && result.data) return result.data;
  return { posts: [] };
}

export async function getUserPostsFeed(userId: number, cursor?: string): Promise<{ posts: Post[]; nextCursor?: string }> {
  const endpoint = cursor
    ? `/api/social/posts/user/${userId}?cursor=${encodeURIComponent(cursor)}`
    : `/api/social/posts/user/${userId}`;
  const result = await syncToServer<{ posts: Post[]; nextCursor?: string }>(endpoint, "GET");
  if (result.success && result.data) return result.data;
  return { posts: [] };
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
}): Promise<{ success: boolean; postId?: number }> {
  const result = await syncToServer<{ success: boolean; postId: number }>("/api/social/posts", "POST", post);
  if (result.success && result.data) return result.data;
  return { success: false };
}

export async function getPostById(postId: number): Promise<Post | null> {
  const result = await syncToServer<Post>(`/api/social/posts/${postId}`, "GET");
  if (result.success && result.data) return result.data;
  return null;
}

export async function deleteSocialPost(postId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(`/api/social/posts/${postId}`, "DELETE");
  return result.success && !!result.data?.success;
}

// ========== Likes ==========

export async function likePostApi(postId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(`/api/social/posts/${postId}/like`, "POST");
  return result.success && !!result.data?.success;
}

export async function unlikePostApi(postId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(`/api/social/posts/${postId}/like`, "DELETE");
  return result.success && !!result.data?.success;
}

// ========== Comments ==========

export async function getComments(postId: number, page = 0): Promise<PostComment[]> {
  const result = await syncToServer<PostComment[]>(`/api/social/posts/${postId}/comments?page=${page}`, "GET");
  if (result.success && result.data) return result.data;
  return [];
}

export async function addCommentApi(postId: number, clientId: string, content: string): Promise<PostComment | null> {
  const result = await syncToServer<PostComment>(`/api/social/posts/${postId}/comments`, "POST", { clientId, content });
  if (result.success && result.data) return result.data;
  return null;
}

export async function deleteCommentApi(commentId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(`/api/social/comments/${commentId}`, "DELETE");
  return result.success && !!result.data?.success;
}

// ========== Follows ==========

export async function followUserApi(userId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(`/api/social/follow/${userId}`, "POST");
  return result.success && !!result.data?.success;
}

export async function unfollowUserApi(userId: number): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>(`/api/social/follow/${userId}`, "DELETE");
  return result.success && !!result.data?.success;
}

export async function getFollowersList(userId: number, page = 0): Promise<FollowUser[]> {
  const result = await syncToServer<FollowUser[]>(`/api/social/followers/${userId}?page=${page}`, "GET");
  if (result.success && result.data) return result.data;
  return [];
}

export async function getFollowingList(userId: number, page = 0): Promise<FollowUser[]> {
  const result = await syncToServer<FollowUser[]>(`/api/social/following/${userId}?page=${page}`, "GET");
  if (result.success && result.data) return result.data;
  return [];
}

// ========== User Discovery & Profile ==========

export async function searchUsersApi(query: string): Promise<FollowUser[]> {
  const result = await syncToServer<FollowUser[]>(`/api/social/users/search?q=${encodeURIComponent(query)}`, "GET");
  if (result.success && result.data) return result.data;
  return [];
}

export async function getSocialProfileApi(userId: number): Promise<SocialProfile | null> {
  const result = await syncToServer<SocialProfile>(`/api/social/users/${userId}/profile`, "GET");
  if (result.success && result.data) return result.data;
  return null;
}

export async function updateSocialProfileApi(data: { bio?: string; avatarUrl?: string; isPublic?: boolean }): Promise<boolean> {
  const result = await syncToServer<{ success: boolean }>("/api/social/profile", "PUT", data);
  return result.success && !!result.data?.success;
}
