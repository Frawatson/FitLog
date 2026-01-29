import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing } from "@/constants/theme";

interface ProgressRingProps {
  progress: number; // 0-1
  size?: number;
  strokeWidth?: number;
  label: string;
  value: string;
  color?: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressRing({
  progress,
  size = 100,
  strokeWidth = 8,
  label,
  value,
  color,
}: ProgressRingProps) {
  const { theme, isDark } = useTheme();
  const progressValue = useSharedValue(0);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const ringColor = color || Colors.light.primary;
  const bgColor = isDark ? theme.backgroundSecondary : theme.backgroundDefault;
  
  useEffect(() => {
    progressValue.value = withTiming(Math.min(progress, 1), {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);
  
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progressValue.value),
  }));
  
  return (
    <View style={styles.container}>
      <View style={[styles.ringContainer, { width: size, height: size }]}>
        <Svg width={size} height={size} style={styles.svg}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={bgColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={styles.valueContainer}>
          <ThemedText type="h4" style={styles.value}>
            {value}
          </ThemedText>
        </View>
      </View>
      <ThemedText type="small" style={styles.label}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  ringContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  svg: {
    position: "absolute",
  },
  valueContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  value: {
    fontWeight: "700",
  },
  label: {
    marginTop: Spacing.sm,
    opacity: 0.7,
  },
});
