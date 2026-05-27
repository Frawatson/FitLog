import { useEffect } from "react";
import { Platform } from "react-native";

// Web-only Escape-key handler. Native modals close via gesture or the OS
// back button; on web, users expect Escape to dismiss any modal or
// drawer. Mount this hook inside a screen/component that wants Escape to
// trigger a close action. No-op on native (the listener is never
// registered there), so it's safe to call unconditionally.
//
// Pass `enabled: false` to temporarily suspend the listener (e.g. when
// a nested modal is open and shouldn't be dismissed alongside the parent).
export function useEscapeKey(onEscape: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (Platform.OS !== "web" || !enabled) return;
    // window is guaranteed to exist when Platform.OS === "web" at runtime.
    // Guard with typeof in case a future SSR layer renders this on the server.
    if (typeof window === "undefined") return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Don't stop propagation — other higher-priority handlers (e.g. an
        // open <select> dropdown) should still see the key first. Just run
        // our close callback as the last step.
        onEscape();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape, enabled]);
}
