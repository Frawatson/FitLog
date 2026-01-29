import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

interface SegmentedControlProps {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function SegmentedControl({
  options,
  selectedIndex,
  onChange,
}: SegmentedControlProps) {
  const { theme } = useTheme();
  
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundDefault },
      ]}
    >
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(index)}
            style={[
              styles.option,
              isSelected && {
                backgroundColor: Colors.light.primary,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={[
                styles.optionText,
                { color: isSelected ? "#FFFFFF" : theme.text },
              ]}
            >
              {option}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
  },
  option: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    fontWeight: "600",
  },
});
