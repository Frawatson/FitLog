import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

const AUTH_TOKEN_KEY = "@merge_auth_token";
const SYNC_QUEUE_KEY = "@merge_sync_queue";
const MAX_QUEUE_SIZE = 100;
const BASE_RETRY_DELAY_MS = 3000; // 3 seconds
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 10;
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  data: any;
  timestamp: number;
  retryCount: number;
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  return token
    ? { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  return !!token;
}

export async function syncToServer<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  data?: any
): Promise<{ success: boolean; data?: T; error?: string; status?: number }> {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      return { success: false, error: "Not authenticated" };
    }

    const url = new URL(endpoint, getApiUrl()).toString();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const options: RequestInit = {
      method,
      headers: await getAuthHeaders(),
      signal: controller.signal,
    };

    if (data && method !== "GET") {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || `HTTP ${response.status}`, status: response.status };
      }

      const responseData = await response.json().catch(() => ({}));
      return { success: true, data: responseData };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.log(`Sync timeout for ${endpoint} after ${REQUEST_TIMEOUT_MS}ms`);
      return { success: false, error: "Request timeout" };
    }
    console.log(`Sync failed for ${endpoint}:`, error);
    return { success: false, error: "Network error" };
  }
}

export async function addToSyncQueue(
  endpoint: string,
  method: "POST" | "PUT" | "DELETE",
  data: any
): Promise<void> {
  try {
    let queue = await getSyncQueue();
    const item: SyncQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      endpoint,
      method,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };
    queue.push(item);

    // Enforce max queue size — drop oldest items
    if (queue.length > MAX_QUEUE_SIZE) {
      queue = queue.slice(queue.length - MAX_QUEUE_SIZE);
    }

    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    scheduleRetry();
  } catch (error) {
    console.error("Failed to add to sync queue:", error);
  }
}

async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function isRetryableError(status?: number): boolean {
  // Only retry on server errors and network issues, not client errors
  if (!status) return true; // Network error — retryable
  return status >= 500 || status === 429;
}

async function processSyncQueue(): Promise<void> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return;

  const queue = await getSyncQueue();
  if (queue.length === 0) {
    stopRetryTimer();
    return;
  }

  const remainingItems: SyncQueueItem[] = [];

  for (const item of queue) {
    const result = await syncToServer(item.endpoint, item.method, item.data);

    if (result.success) {
      continue; // Successfully synced
    }

    if (!isRetryableError(result.status)) {
      // Client error (4xx except 429) — don't retry
      console.log(`Dropping sync for ${item.endpoint}: ${result.error} (non-retryable)`);
      continue;
    }

    item.retryCount++;
    if (item.retryCount < MAX_RETRIES) {
      remainingItems.push(item);
    } else {
      console.log(`Giving up on sync for ${item.endpoint} after ${MAX_RETRIES} retries`);
    }
  }

  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingItems));

  if (remainingItems.length > 0) {
    // Schedule next retry with exponential backoff based on max retry count in queue
    const maxRetryCount = Math.max(...remainingItems.map(i => i.retryCount));
    scheduleRetry(maxRetryCount);
  } else {
    stopRetryTimer();
  }
}

function getBackoffDelay(retryCount: number): number {
  // Exponential backoff: 3s, 9s, 27s, 81s, ... capped at 5 minutes
  const delay = BASE_RETRY_DELAY_MS * Math.pow(3, retryCount);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

function scheduleRetry(retryCount = 0): void {
  stopRetryTimer();
  const delay = getBackoffDelay(retryCount);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    processSyncQueue();
  }, delay);
}

function stopRetryTimer(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

export function initSyncService(): void {
  processSyncQueue();
}

export async function syncWithRetry<T>(
  endpoint: string,
  method: "POST" | "PUT" | "DELETE",
  data: any,
  onLocalFallback?: () => Promise<void>
): Promise<boolean> {
  const result = await syncToServer<T>(endpoint, method, data);

  if (result.success) {
    return true;
  }

  if (onLocalFallback) {
    await onLocalFallback();
  }

  await addToSyncQueue(endpoint, method, data);
  return false;
}
