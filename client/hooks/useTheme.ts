import { useThemeContext } from "@/contexts/ThemeContext";

export function useTheme() {
  const { theme, isDark, themePreference, setThemePreference } = useThemeContext();

  return {
    theme,
    isDark,
    themePreference,
    setThemePreference,
  };
}
