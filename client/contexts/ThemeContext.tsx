import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/theme";

type ColorScheme = "light" | "dark";
type ThemePreference = "system" | "light" | "dark";

interface ThemeContextValue {
  theme: typeof Colors.light;
  isDark: boolean;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = "@fitlog_theme_preference";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored && (stored === "system" || stored === "light" || stored === "dark")) {
        setThemePreferenceState(stored);
      }
    } catch (error) {
      console.log("Error loading theme preference:", error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setThemePreference = async (preference: ThemePreference) => {
    setThemePreferenceState(preference);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch (error) {
      console.log("Error saving theme preference:", error);
    }
  };

  const getActiveColorScheme = (): ColorScheme => {
    if (themePreference === "system") {
      return systemColorScheme ?? "light";
    }
    return themePreference;
  };

  const activeScheme = getActiveColorScheme();
  const isDark = activeScheme === "dark";
  const theme = Colors[activeScheme];

  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, themePreference, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useThemeContext must be used within a ThemeProvider");
  }
  return context;
}
