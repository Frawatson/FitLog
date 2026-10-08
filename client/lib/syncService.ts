import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import { AUTH_TOKEN_KEY } from "@/lib/authStorage";

const SYNC_QUEUE_KEY = "@merge_sync_queue";
const MAX_QUEUE_SIZE = 500;
const BASE_RETRY_DELAY_MS = 3000; // 3 seconds
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 10;
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

export interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  data: any;
  timestamp: number;
  retryCount: number;
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;

// Single-flight lock around queue processing. Without it, initSyncService
// (called from checkAuth AND login) and the retry timer could run two
// passes concurrently and send the same queued item twice. The in-flight
// promise is kept so flushSyncQueue (logout) can await a pass that was
// already running, not just one it started.
let currentRun: Promise<void> | null = null;
let runAgain = false;

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  return !!token;
}

export async function syncToServer<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  data?: any,
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
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}`,
          status: response.status,
        };
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
  data: any,
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

    // Hard safety cap. 500 pending writes means something is deeply wrong
    // (weeks offline); dropping the oldest is the least-bad bound.
    if (queue.length > MAX_QUEUE_SIZE) {
      console.warn(
        `Sync queue over ${MAX_QUEUE_SIZE} items — dropping ${queue.length - MAX_QUEUE_SIZE} oldest`,
      );
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

// Read-only view of the pending queue, used by storage.ts to merge
// not-yet-synced local writes into server list responses (otherwise a
// server fetch visually "deletes" anything still waiting to upload).
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return getSyncQueue();
}

// True when the queue already holds a write for the same record. Used by
// syncWithRetry to keep writes ordered: if edit #1 is queued and edit #2
// were sent directly, the queue flush would later replay the OLDER edit
// over the newer one.
function conflictsWithQueued(
  queue: SyncQueueItem[],
  endpoint: string,
  data: any,
): boolean {
  return queue.some((item) => {
    if (item.endpoint === endpoint) {
      // Upsert endpoints (POST /api/routines etc.) target a record via
      // data.clientId; id-in-path endpoints match on the path itself.
      const a = item.data?.clientId;
      const b = data?.clientId;
      return a !== undefined && b !== undefined ? a === b : true;
    }
    // A queued DELETE/PUT like /api/routines/<id> conflicts with an
    // upsert POST /api/routines carrying that same id (and vice versa).
    const itemBase = item.endpoint.split("/").slice(0, -1).join("/");
    const itemId = item.endpoint.split("/").pop();
    if (itemBase === endpoint && data?.clientId === itemId) return true;
    const base = endpoint.split("/").slice(0, -1).join("/");
    const id = endpoint.split("/").pop();
    return base === item.endpoint && item.data?.clientId === id;
  });
}

function isRetryableError(status?: number): boolean {
  // Network errors, server errors, timeouts, and rate limits are
  // retryable. Other 4xx responses are permanent rejections.
  if (!status) return true;
  return status >= 500 || status === 429 || status === 408;
}

function processSyncQueue(): Promise<void> {
  if (currentRun) {
    // A pass is already running; ask it to loop once more so items that
    // arrived mid-pass are picked up, and hand back ITS promise so
    // awaiting callers wait for real completion.
    runAgain = true;
    return currentRun;
  }
  currentRun = (async () => {
    try {
      do {
        runAgain = false;
        await processSyncQueueOnce();
      } while (runAgain);
    } finally {
      currentRun = null;
    }
  })();
  return currentRun;
}

async function processSyncQueueOnce(): Promise<void> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return;

  const queue = await getSyncQueue();
  if (queue.length === 0) {
    stopRetryTimer();
    return;
  }

  // Items fully handled this pass (synced or permanently rejected). The
  // final write filters the FRESH queue against this set, so anything
  // enqueued while requests were in flight survives instead of being
  // clobbered by a stale snapshot.
  const handledIds = new Set<string>();
  const retryCounts = new Map<string, number>();
  let authPaused = false;

  for (const item of queue) {
    const result = await syncToServer(item.endpoint, item.method, item.data);

    if (result.success) {
      handledIds.add(item.id);
      continue;
    }

    if (result.status === 401 || result.status === 403) {
      // The token is expired/revoked, NOT the data being bad. Keep every
      // queued write untouched and stop — the queue resumes after the
      // next successful login re-runs initSyncService. (The old behavior
      // deleted the entire queue here: every workout logged offline was
      // permanently lost if the token lapsed.)
      authPaused = true;
      break;
    }

    if (!isRetryableError(result.status)) {
      console.warn(
        `Dropping sync for ${item.endpoint}: ${result.error} (status ${result.status}, non-retryable)`,
      );
      handledIds.add(item.id);
      continue;
    }

    const nextCount = item.retryCount + 1;
    if (nextCount >= MAX_RETRIES) {
      console.warn(
        `Giving up on sync for ${item.endpoint} after ${MAX_RETRIES} retries`,
      );
      handledIds.add(item.id);
    } else {
      retryCounts.set(item.id, nextCount);
    }
  }

  // Re-read before writing: the queue may have grown while we awaited.
  const fresh = await getSyncQueue();
  const remaining = fresh
    .filter((i) => !handledIds.has(i.id))
    .map((i) =>
      retryCounts.has(i.id) ? { ...i, retryCount: retryCounts.get(i.id)! } : i,
    );
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));

  if (authPaused) {
    stopRetryTimer();
    return;
  }

  if (remaining.length > 0) {
    const maxRetryCount = Math.max(...remaining.map((i) => i.retryCount));
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

// Best-effort immediate flush (used right before logout so pending writes
// reach the server before local state is wiped).
export async function flushSyncQueue(): Promise<void> {
  await processSyncQueue();
}

// Drops all pending writes and stops retrying. Called on logout/account
// switch: replaying one user's queued writes under another user's token
// would push workouts and food logs into the wrong account.
export async function clearSyncQueue(): Promise<void> {
  stopRetryTimer();
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

export async function syncWithRetry<T>(
  endpoint: string,
  method: "POST" | "PUT" | "DELETE",
  data: any,
  onLocalFallback?: () => Promise<void>,
): Promise<boolean> {
  // Preserve write order per record: if an earlier write to this record
  // is still queued, queue this one behind it instead of racing past it.
  const queue = await getSyncQueue();
  if (queue.length > 0 && conflictsWithQueued(queue, endpoint, data)) {
    if (onLocalFallback) {
      await onLocalFallback();
    }
    await addToSyncQueue(endpoint, method, data);
    return false;
  }

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
