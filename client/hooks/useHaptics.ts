import { useMemo } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// Stable, web-safe API for haptic feedback. The codebase has ~90 direct
// Haptics.* calls scattered across 25 files; many are wrapped in
// `Platform.OS !== "web"` checks because expo-haptics throws on web.
// Migrating call sites to this hook is a follow-up — for now it
// establishes the adapter pattern alongside usePlatform/useEscapeKey.
//
// Usage:
//   const haptics = useHaptics();
//   haptics.selection();
//   haptics.impact("medium");
//   haptics.notification("success");

export type HapticImpactStyle = "light" | "medium" | "heavy";
export type HapticNotificationType = "success" | "warning" | "error";

export interface HapticsAdapter {
  selection: () => void;
  impact: (style?: HapticImpactStyle) => void;
  notification: (type: HapticNotificationType) => void;
}

const NOOP_ADAPTER: HapticsAdapter = {
  selection: () => {},
  impact: () => {},
  notification: () => {},
};

export function useHaptics(): HapticsAdapter {
  return useMemo<HapticsAdapter>(() => {
    if (Platform.OS === "web") return NOOP_ADAPTER;
    return {
      selection: () => {
        // Catch is intentional — never let a haptic-pulse failure surface
        // to the caller. On a device with haptic disabled or a rare driver
        // error, we want the UI action to still succeed silently.
        Haptics.selectionAsync().catch(() => {});
      },
      impact: (style: HapticImpactStyle = "light") => {
        const map = {
          light: Haptics.ImpactFeedbackStyle.Light,
          medium: Haptics.ImpactFeedbackStyle.Medium,
          heavy: Haptics.ImpactFeedbackStyle.Heavy,
        };
        Haptics.impactAsync(map[style]).catch(() => {});
      },
      notification: (type: HapticNotificationType) => {
        const map = {
          success: Haptics.NotificationFeedbackType.Success,
          warning: Haptics.NotificationFeedbackType.Warning,
          error: Haptics.NotificationFeedbackType.Error,
        };
        Haptics.notificationAsync(map[type]).catch(() => {});
      },
    };
  }, []);
}
