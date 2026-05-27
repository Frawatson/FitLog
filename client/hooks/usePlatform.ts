import { Platform } from "react-native";
import { useBreakpoint, type Breakpoint } from "./useBreakpoint";

export interface PlatformInfo {
  isWeb: boolean;
  isNative: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  // Convenience: most UI decisions branch on these combos.
  isDesktopWeb: boolean;
  isMobileWeb: boolean;
  isNativeMobile: boolean;
}

// Single place to decide "is this a phone, a tablet, or a desktop browser?"
// UI code should consume this hook instead of inlining `Platform.OS === 'web'`
// checks — that keeps platform branching out of components and concentrated
// behind one testable hook.
export function usePlatform(): PlatformInfo {
  const breakpoint = useBreakpoint();
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const isAndroid = Platform.OS === "android";
  return {
    isWeb,
    isNative: !isWeb,
    isIOS,
    isAndroid,
    breakpoint,
    isMobile: breakpoint === "mobile",
    isTablet: breakpoint === "tablet",
    isDesktop: breakpoint === "desktop",
    isDesktopWeb: isWeb && breakpoint === "desktop",
    isMobileWeb: isWeb && breakpoint === "mobile",
    isNativeMobile: !isWeb,
  };
}
