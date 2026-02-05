import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import * as storage from "@/lib/storage";
import { initSyncService } from "@/lib/storage";

const AUTH_TOKEN_KEY = "@merge_auth_token";

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
  register: (email: string, password: string, name: string) => Promise<void>;
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
      // Load stored token
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (storedToken) {
        setAuthToken(storedToken);
      }
      // Check auth using token or session
      await checkAuth(storedToken);
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
      const response = await fetch(new URL("/api/auth/me", getApiUrl()).toString(), {
        credentials: "include",
        headers,
      });
      if (response.ok) {
        const userData = await response.json();
        console.log("[AuthContext] Received user data:", JSON.stringify(userData, null, 2));
        setUser(userData);
        // Initialize sync service for authenticated user
        initSyncService();
      } else {
        console.log("[AuthContext] Auth check failed, status:", response.status);
        // Clear invalid token
        if (token) {
          await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
          setAuthToken(null);
        }
      }
    } catch (error) {
      console.log("[AuthContext] Not authenticated, error:", error);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(new URL("/api/auth/login", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Login failed");
    }

    const userData = await response.json();
    // Store token for mobile clients
    if (userData.token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, userData.token);
      setAuthToken(userData.token);
    }
    setUser(userData);
    // Initialize sync service for authenticated user
    initSyncService();
  };

  const register = async (email: string, password: string, name: string) => {
    // Clear any existing local data from previous users
    await storage.clearAllData();
    
    const response = await fetch(new URL("/api/auth/register", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Registration failed");
    }

    const userData = await response.json();
    // Store token for mobile clients
    if (userData.token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, userData.token);
      setAuthToken(userData.token);
    }
    setUser(userData);
    // Initialize sync service for authenticated user
    initSyncService();
  };

  const logout = async () => {
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
    // Clear stored token
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    const response = await fetch(new URL("/api/auth/profile", getApiUrl()).toString(), {
      method: "PUT",
      headers,
      credentials: "include",
      body: JSON.stringify(data),
    });

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
    
    const response = await fetch(new URL("/api/auth/account", getApiUrl()).toString(), {
      method: "DELETE",
      headers,
      credentials: "include",
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to delete account");
    }
    
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile, refreshUser, deleteAccount }}>
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
