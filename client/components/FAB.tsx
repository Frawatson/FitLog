import React from "react";
import { StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface FABProps {
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FAB({ onPress, icon = "play" }: FABProps) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const handlePressIn = () => {
    scale.value = withSpring(0.92);
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1);
  };
  
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };
  
  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.fab, animatedStyle]}
    >
      <Feather name={icon} size={28} color="#FFFFFF" />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 90,
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
});
