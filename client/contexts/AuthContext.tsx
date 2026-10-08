import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import * as storage from "@/lib/storage";
import { initSyncService } from "@/lib/storage";
import { flushSyncQueue } from "@/lib/syncService";
import { AUTH_TOKEN_KEY, setCachedAuthToken } from "@/lib/authStorage";

// Last server-confirmed user object, kept so an app start WITHOUT network
// (subway, airplane mode) restores the signed-in state instead of bouncing
// a token-holding user to the Login screen.
const AUTH_USER_CACHE_KEY = "@merge_auth_user";

// Startup probe fired at module import time. The provider can't mount
// until fonts finish loading (App returns null until then), so starting
// the /api/auth/me round-trip here lets it run concurrently with the
// font download instead of after it — shaving that latency off every
// cold start. Consumed exactly once by the provider's first check.
let initialAuthProbe: Promise<{
  token: string | null;
  response: Response | null;
}> | null = (async () => {
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    // Storage unreadable — proceed unauthenticated.
  }
  try {
    const headers: HeadersInit = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    const response = await fetch(
      new URL("/api/auth/me", getApiUrl()).toString(),
      { credentials: "include", headers },
    );
    return { token, response };
  } catch {
    return { token, response: null };
  }
})();

export interface User {
  id: number;
  email: string;
  name: string;
  age?: number;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  weightGoalKg?: number;
  experience?: string;
  goal?: string;
  activityLevel?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ confirmationRequired: true; message: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    loadTokenAndCheckAuth();
  }, []);

  const loadTokenAndCheckAuth = async () => {
    try {
      // First mount reuses the module-load probe (already in flight or
      // done); later calls fall back to a fresh fetch.
      const probe = initialAuthProbe;
      initialAuthProbe = null;
      let storedToken: string | null;
      let probeResponse: Response | null | undefined;
      if (probe) {
        const result = await probe;
        storedToken = result.token;
        probeResponse = result.response;
      } else {
        storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      }
      if (storedToken) {
        setAuthToken(storedToken);
        setCachedAuthToken(storedToken);
      }
      if (probeResponse !== undefined) {
        await handleAuthResponse(probeResponse, storedToken);
      } else {
        await checkAuth(storedToken);
      }
    } catch (error) {
      console.log("Error loading auth:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkAuth = async (token?: string | null) => {
    try {
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(
        new URL("/api/auth/me", getApiUrl()).toString(),
        {
          credentials: "include",
          headers,
        },
      );
      await handleAuthResponse(response, token);
    } catch (error) {
      // Network failure. With a stored token, restore the cached user so
      // the app opens into the (locally cached) data instead of Login.
      console.log("[AuthContext] Auth check unreachable:", error);
      await restoreCachedUser(token);
    }
  };

  const handleAuthResponse = async (
    response: Response | null,
    token?: string | null,
  ) => {
    try {
      if (!response) {
        await restoreCachedUser(token);
        return;
      }
      if (response.ok) {
        // NOTE: never log the user object — it carries health PII.
        const userData = await response.json();
        setUser(userData);
        await AsyncStorage.setItem(
          AUTH_USER_CACHE_KEY,
          JSON.stringify(userData),
        );
        // Initialize sync service for authenticated user
        initSyncService();
      } else if (response.status === 401 || response.status === 403) {
        // The token itself was rejected — clear it.
        console.log(
          "[AuthContext] Auth check failed, status:",
          response.status,
        );
        if (token) {
          await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
          setAuthToken(null);
          setCachedAuthToken(null);
        }
        await AsyncStorage.removeItem(AUTH_USER_CACHE_KEY);
      } else {
        // Server error (5xx / 502 from a mid-deploy proxy): NOT evidence
        // the token is bad. Fall back to the cached signed-in state.
        await restoreCachedUser(token);
      }
    } catch (error) {
      console.log("[AuthContext] Auth response handling failed:", error);
      await restoreCachedUser(token);
    }
  };

  const restoreCachedUser = async (token?: string | null) => {
    if (!token) return;
    try {
      const cached = await AsyncStorage.getItem(AUTH_USER_CACHE_KEY);
      if (cached) {
        setUser(JSON.parse(cached));
      }
    } catch {
      // Cache unreadable — leave signed out.
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(
      new URL("/api/auth/login", getApiUrl()).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    const userData = await response.json();

    // If the previously-stored profile belonged to a different user, wipe
    // local app data so the freshly-signed-in user doesn't see leftover
    // workouts/food logs/etc. Previously this was implicit in register's
    // auto-login flow; now that register requires email confirmation, we
    // have to do it at sign-in time.
    const existingProfile = await storage.getUserProfile();
    if (
      existingProfile?.email &&
      existingProfile.email.toLowerCase() !== userData.email?.toLowerCase()
    ) {
      await storage.clearAllData();
    }

    // Store token for mobile clients
    if (userData.token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, userData.token);
      setAuthToken(userData.token);
      setCachedAuthToken(userData.token);
    }
    setUser(userData);
    await AsyncStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(userData));
    // Initialize sync service for authenticated user
    initSyncService();
  };

  const register = async (email: string, password: string, name: string) => {
    // Don't clear local data here — register no longer auto-logs in. We'll
    // clear it on the next successful login if it doesn't match the user.
    const response = await fetch(
      new URL("/api/auth/register", getApiUrl()).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, name }),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Registration failed");
    }

    const data = await response.json();
    // Server now responds with { confirmationRequired: true } and does NOT
    // return a session token — the user becomes authenticated only after
    // clicking the email link and then signing in.
    return {
      confirmationRequired: true as const,
      message: data.message || "Check your email to confirm your account.",
    };
  };

  const logout = async () => {
    // Push any still-queued offline writes up under the CURRENT token
    // before it goes away — clearAllData below drops whatever remains.
    try {
      await flushSyncQueue();
    } catch {
      // Best effort only.
    }
    try {
      const headers: HeadersInit = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
      await fetch(new URL("/api/auth/logout", getApiUrl()).toString(), {
        method: "POST",
        credentials: "include",
        headers,
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    // Wipe local health data AND the sync queue. Leaving either behind
    // on a shared computer exposes this user's data to the next account
    // (and replays this user's queued writes into that account). Server
    // data is untouched — everything re-syncs on next login.
    await storage.clearAllData();
    await AsyncStorage.removeItem(AUTH_USER_CACHE_KEY);
    // Clear stored token
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setCachedAuthToken(null);
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    const response = await fetch(
      new URL("/api/auth/profile", getApiUrl()).toString(),
      {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Update failed");
    }

    const userData = await response.json();
    setUser(userData);

    // Also update AsyncStorage so profile data persists across app restarts
    const existingProfile = await storage.getUserProfile();
    await storage.saveUserProfile({
      ...existingProfile,
      id: existingProfile?.id || `user-${userData.id}`,
      name: userData.name,
      email: userData.email,
      age: userData.age,
      sex: userData.sex,
      heightCm: userData.heightCm,
      weightKg: userData.weightKg,
      weightGoalKg: userData.weightGoalKg,
      experience: userData.experience,
      goal: userData.goal,
      activityLevel: userData.activityLevel,
      unitSystem: existingProfile?.unitSystem || "imperial",
      onboardingCompleted: existingProfile?.onboardingCompleted ?? true,
      createdAt: existingProfile?.createdAt || new Date().toISOString(),
    });
  };

  const refreshUser = async () => {
    await checkAuth(authToken);
  };

  const deleteAccount = async () => {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(
      new URL("/api/auth/account", getApiUrl()).toString(),
      {
        method: "DELETE",
        headers,
        credentials: "include",
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to delete account");
    }

    // Account is gone server-side; remove every local trace too.
    await storage.clearAllData();
    await AsyncStorage.removeItem(AUTH_USER_CACHE_KEY);
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setCachedAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        refreshUser,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
