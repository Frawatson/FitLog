import { useWindowDimensions } from "react-native";

// Single source of truth for layout breakpoints. Match these in any media
// query / per-screen conditional. Keep tight: three buckets is enough.
export const BREAKPOINTS = {
  mobile: 0, // < 768
  tablet: 768, // 768 — 1023
  desktop: 1024, // ≥ 1024
} as const;

export type Breakpoint = "mobile" | "tablet" | "desktop";

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= BREAKPOINTS.desktop) return "desktop";
  if (width >= BREAKPOINTS.tablet) return "tablet";
  return "mobile";
}
