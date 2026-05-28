import React, { useEffect, useRef, useState } from "react";
import { Platform, View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

// Chrome / Android / desktop Chrome / Edge fire this when the site
// becomes installable (manifest + service worker + engagement heuristic).
// iOS Safari does not — install is manual via the Share menu, so we
// detect the platform and show a one-line tooltip instead.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "gbolo_install_prompt_dismissed";

type Variant = "chrome" | "ios" | null;

export function WebInstallPrompt() {
  const { theme } = useTheme();
  const [variant, setVariant] = useState<Variant>(null);
  const deferredEventRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // localStorage may be unavailable (private mode) — proceed without it.
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredEventRef.current = e as BeforeInstallPromptEvent;
      setVariant("chrome");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS Safari path. Exclude Chrome/Firefox/Edge on iOS (those use
    // Safari's engine but ship their own UA strings and don't expose
    // Add-to-Home-Screen anyway).
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIOS && isSafari) setVariant("ios");

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setVariant(null);
  };

  const install = async () => {
    const ev = deferredEventRef.current;
    if (!ev) return;
    deferredEventRef.current = null;
    try {
      await ev.prompt();
    } catch {
      // user already dismissed the native prompt or the event was stale
    }
    setVariant(null);
  };

  if (variant === null) return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.backgroundCard, borderColor: theme.cardBorder },
        ]}
      >
        <View style={styles.row}>
          <Feather
            name="download"
            size={20}
            color={Colors.light.primary}
            style={{ marginRight: Spacing.sm, marginTop: 2 }}
          />
          <View style={{ flex: 1 }}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              Install Gbolo
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginTop: 2 }}
            >
              {variant === "chrome"
                ? "Add the app to your home screen for quick access."
                : 'Tap the Share button, then "Add to Home Screen".'}
            </ThemedText>
          </View>
          <Pressable onPress={dismiss} hitSlop={8} style={styles.dismiss}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
        {variant === "chrome" ? (
          <Pressable
            onPress={install}
            style={[styles.installBtn, { backgroundColor: Colors.light.primary }]}
          >
            <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Install
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    padding: Spacing.lg,
    alignItems: "center",
  },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    maxWidth: 480,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  dismiss: {
    padding: 4,
    marginLeft: Spacing.sm,
  },
  installBtn: {
    alignSelf: "flex-end",
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
});
