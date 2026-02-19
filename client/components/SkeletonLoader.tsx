import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SkeletonProps {
  variant?: "line" | "card" | "circle" | "list";
  width?: number | string;
  height?: number;
  lines?: number;
  style?: ViewStyle;
}

function SkeletonPulse({ style }: { style?: ViewStyle }) {
  const { theme, isDark } = useTheme();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 150 }),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(opacity.value, [0, 1], [0.3, 0.7]),
  }));

  const baseColor = isDark ? "#3A3A3A" : "#E0E0E0";

  return (
    <Animated.View
      style={[
        { backgroundColor: baseColor, borderRadius: BorderRadius.xs },
        style,
        animatedStyle,
      ]}
    />
  );
}

export function SkeletonLoader({
  variant = "line",
  width,
  height,
  lines = 3,
  style,
}: SkeletonProps) {
  switch (variant) {
    case "circle":
      return (
        <SkeletonPulse
          style={{
            width: (height || 48) as number,
            height: height || 48,
            borderRadius: (height || 48) / 2,
            ...style,
          }}
        />
      );

    case "card":
      return (
        <View style={[styles.card, style]}>
          <SkeletonPulse style={{ width: "60%", height: 16, marginBottom: Spacing.md }} />
          <SkeletonPulse style={{ width: "100%", height: 12, marginBottom: Spacing.sm }} />
          <SkeletonPulse style={{ width: "80%", height: 12 }} />
        </View>
      );

    case "list":
      return (
        <View style={[styles.list, style]}>
          {Array.from({ length: lines }).map((_, i) => (
            <View key={i} style={styles.listItem}>
              <SkeletonPulse style={{ width: 40, height: 40, borderRadius: 20 }} />
              <View style={styles.listContent}>
                <SkeletonPulse style={{ width: "70%", height: 14, marginBottom: Spacing.xs }} />
                <SkeletonPulse style={{ width: "50%", height: 12 }} />
              </View>
            </View>
          ))}
        </View>
      );

    case "line":
    default:
      return (
        <SkeletonPulse
          style={{
            width: (width as number) || "100%",
            height: height || 14,
            ...style,
          }}
        />
      );
  }
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.xl,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.md,
  },
  list: {
    gap: Spacing.md,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  listContent: {
    flex: 1,
  },
});
