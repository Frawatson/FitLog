import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { UserProfile, MacroTargets, Routine, Workout } from "@/types";
import * as storage from "@/lib/storage";

interface AppContextType {
  profile: UserProfile | null;
  macroTargets: MacroTargets | null;
  routines: Routine[];
  workouts: Workout[];
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  refreshMacros: () => Promise<void>;
  refreshRoutines: () => Promise<void>;
  refreshWorkouts: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [macroTargets, setMacroTargets] = useState<MacroTargets | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async () => {
    const data = await storage.getUserProfile();
    setProfile(data);
  };

  const refreshMacros = async () => {
    const data = await storage.getMacroTargets();
    setMacroTargets(data);
  };

  const refreshRoutines = async () => {
    const data = await storage.getRoutines();
    setRoutines(data);
  };

  const refreshWorkouts = async () => {
    const data = await storage.getWorkouts();
    setWorkouts(data);
  };

  const refreshAll = async () => {
    setIsLoading(true);
    await Promise.all([
      refreshProfile(),
      refreshMacros(),
      refreshRoutines(),
      refreshWorkouts(),
    ]);
    setIsLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  return (
    <AppContext.Provider
      value={{
        profile,
        macroTargets,
        routines,
        workouts,
        isLoading,
        refreshProfile,
        refreshMacros,
        refreshRoutines,
        refreshWorkouts,
        refreshAll,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
