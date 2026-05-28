import React, { useEffect, useState } from "react";
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

// Cross-platform options menu — imperative API like Alert.alert, but
// works on web (where Alert.alert is a no-op). On native it delegates
// to Alert.alert. On web it renders a single Modal mounted at the app
// root (<SystemMenuRoot />) and updated via a module-scoped setter.
//
// Usage:
//   showSystemMenu({
//     title: "Post options",
//     options: [
//       { label: "Report", onPress: handleReport },
//       { label: "Block user", destructive: true, onPress: handleBlock },
//       { label: "Cancel", cancel: true },
//     ],
//   });

export interface SystemMenuOption {
  label: string;
  destructive?: boolean;
  cancel?: boolean;
  onPress?: () => void;
}

export interface SystemMenuConfig {
  title: string;
  message?: string;
  options: SystemMenuOption[];
}

type Setter = (cfg: SystemMenuConfig | null) => void;

let setActiveMenu: Setter | null = null;

export function showSystemMenu(config: SystemMenuConfig): void {
  if (Platform.OS !== "web") {
    // Native path: delegate to Alert.alert. Cancel option maps to RN's
    // built-in cancel style, destructive to destructive, others default.
    Alert.alert(
      config.title,
      config.message,
      config.options.map((o) => ({
        text: o.label,
        style: o.cancel ? "cancel" : o.destructive ? "destructive" : "default",
        onPress: o.onPress,
      })),
    );
    return;
  }
  if (!setActiveMenu) {
    // Root hasn't mounted yet (very early render or test). Fall back to
    // a sequential window.confirm chain so we never silently drop the
    // user's intent.
    fallbackChain(config);
    return;
  }
  setActiveMenu(config);
}

function fallbackChain(config: SystemMenuConfig): void {
  if (typeof window === "undefined") return;
  const actionable = config.options.filter((o) => !o.cancel);
  for (const opt of actionable) {
    if (window.confirm(`${config.title}\n\n${opt.label}?`)) {
      opt.onPress?.();
      return;
    }
  }
}

// Mount once near the app root. Listens for showSystemMenu calls and
// renders the modal. Auto-dismisses after the chosen option fires.
export function SystemMenuRoot(): React.ReactElement | null {
  const { theme, isDark } = useTheme();
  const [menu, setMenu] = useState<SystemMenuConfig | null>(null);

  useEffect(() => {
    setActiveMenu = setMenu;
    return () => {
      setActiveMenu = null;
    };
  }, []);

  if (!menu) return null;

  const dismiss = () => setMenu(null);
  const pick = (opt: SystemMenuOption) => {
    // Close FIRST, then fire the action — keeps the modal from sitting
    // open while the handler does heavy work (e.g. an API call).
    setMenu(null);
    opt.onPress?.();
  };

  // Sheet was hardcoded #FFFFFF — invisible against the dark-mode
  // text color and made the "Add photo" / avatar picker unreadable.
  // Option bg also needs a lighter overlay on dark to stay visible.
  const optionBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      visible
    >
      <Pressable style={styles.backdrop} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close menu">
        {/* Stop click-through on the sheet itself */}
        <Pressable style={[styles.sheet, { backgroundColor: theme.backgroundCard }]} onPress={() => {}}>
          <ThemedText type="h3" style={styles.title}>{menu.title}</ThemedText>
          {menu.message ? (
            <ThemedText type="small" style={[styles.message, { color: theme.textSecondary }]}>{menu.message}</ThemedText>
          ) : null}
          <View style={styles.options}>
            {menu.options.map((opt, i) => (
              <Pressable
                key={`${opt.label}-${i}`}
                onPress={() => pick(opt)}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: optionBg },
                  pressed && { opacity: 0.7 },
                  opt.cancel && styles.optionCancel,
                ]}
              >
                <ThemedText
                  type="body"
                  style={{
                    fontWeight: opt.cancel ? "400" : "600",
                    color: opt.destructive ? Colors.light.error : undefined,
                    textAlign: "center",
                  }}
                >
                  {opt.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  options: {
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  option: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  optionCancel: {
    marginTop: Spacing.sm,
    backgroundColor: "transparent",
  },
});
