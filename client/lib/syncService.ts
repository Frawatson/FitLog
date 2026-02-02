import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

const AUTH_TOKEN_KEY = "@fitlog_auth_token";
const SYNC_QUEUE_KEY = "@fitlog_sync_queue";
const RETRY_INTERVAL_MS = 3 * 60 * 1000;

interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  data: any;
  timestamp: number;
  retryCount: number;
}

let retryTimer: ReturnType<typeof setInterval> | null = null;

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
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      return { success: false, error: "Not authenticated" };
    }

    const url = new URL(endpoint, getApiUrl()).toString();
    const options: RequestInit = {
      method,
      headers: await getAuthHeaders(),
    };

    if (data && method !== "GET") {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || `HTTP ${response.status}` };
    }

    const responseData = await response.json().catch(() => ({}));
    return { success: true, data: responseData };
  } catch (error) {
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
    const queue = await getSyncQueue();
    const item: SyncQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      endpoint,
      method,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };
    queue.push(item);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    startRetryTimer();
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
    
    if (!result.success) {
      item.retryCount++;
      if (item.retryCount < 10) {
        remainingItems.push(item);
      } else {
        console.log(`Giving up on sync for ${item.endpoint} after 10 retries`);
      }
    }
  }

  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingItems));
  
  if (remainingItems.length === 0) {
    stopRetryTimer();
  }
}

function startRetryTimer(): void {
  if (retryTimer) return;
  retryTimer = setInterval(() => {
    processSyncQueue();
  }, RETRY_INTERVAL_MS);
}

function stopRetryTimer(): void {
  if (retryTimer) {
    clearInterval(retryTimer);
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
