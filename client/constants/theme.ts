import { Platform } from "react-native";

// Gbolo Design System - Bold Athletic Theme
// Brand palette: dark forest green + gold accent
// No `as const` here — that would narrow each value to its literal-string
// type, which makes the light/dark Colors objects type-incompatible (because
// e.g. light.link === "#1B3A27" but dark.link === "#D4AF37" become different
// types). Plain string lets the existing ThemeContext typeof-Colors.light
// pattern work unchanged.
export const Brand = {
  green: "#1B3A27" as string,        // Primary brand color (CTAs, links, active tabs)
  greenDeep: "#0A1612" as string,    // Darkest tone — dark-mode root background
  greenSurface: "#11241A" as string, // Dark-mode default surface
  greenCard: "#162B1F" as string,    // Dark-mode card background
  greenElevated: "#1E382A" as string,// Dark-mode raised surface
  greenBorder: "#2D4D38" as string,  // Dark-mode divider
  gold: "#D4AF37" as string,         // Accent — used for dark-mode links/highlights
};

const successGreen = "#00D084"; // Semantic — kept distinct from brand green
const errorRed = "#D32F2F";     // Semantic
// Macro accent colors — same on light + dark so the carbs/fat numbers
// stay recognizable across the app (rings, food rows, edit forms,
// onboarding, profile). Calories use Brand.green via Colors.X.primary;
// protein uses successGreen via Colors.X.success.
const macroCarbsOrange = "#FFA500";
const macroFatPurple = "#9B59B6";

export const Colors = {
  light: {
    text: "#1A1A1A",
    textSecondary: "#666666",
    buttonText: "#FFFFFF",
    tabIconDefault: "#687076",
    tabIconSelected: Brand.green,
    link: Brand.green,
    primary: Brand.green,
    success: successGreen,
    error: errorRed,
    macroCarbs: macroCarbsOrange,
    macroFat: macroFatPurple,
    border: "#E0E0E0",
    backgroundRoot: "#FFFFFF",
    backgroundDefault: "#F5F5F5",
    backgroundSecondary: "#EBEBEB",
    backgroundTertiary: "#E0E0E0",
    backgroundCard: "#FFFFFF",
    backgroundElevated: "#F5F5F5",
    cardBorder: "#E0E0E0",
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: Brand.gold,
    link: Brand.gold,
    primary: Brand.green,
    success: successGreen,
    error: errorRed,
    macroCarbs: macroCarbsOrange,
    macroFat: macroFatPurple,
    border: Brand.greenBorder,
    backgroundRoot: Brand.greenDeep,
    backgroundDefault: Brand.greenSurface,
    backgroundSecondary: Brand.greenCard,
    backgroundTertiary: Brand.greenElevated,
    backgroundCard: Brand.greenCard,
    backgroundElevated: Brand.greenElevated,
    cardBorder: Brand.greenBorder,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: 9999,
};

export const Typography = {
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
    fontFamily: "Montserrat_700Bold",
  },
  h1: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700" as const,
    fontFamily: "Montserrat_700Bold",
  },
  h2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
    fontFamily: "Montserrat_600SemiBold",
  },
  h3: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600" as const,
    fontFamily: "Montserrat_600SemiBold",
  },
  h4: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600" as const,
    fontFamily: "Montserrat_600SemiBold",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
    fontFamily: "Montserrat_400Regular",
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
    fontFamily: "Montserrat_400Regular",
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
    fontFamily: "Montserrat_400Regular",
  },
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700" as const,
    fontFamily: "Montserrat_700Bold",
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
    fontFamily: "Montserrat_400Regular",
  },
};

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  fab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
