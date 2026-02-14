import React, { ReactNode } from "react";
import { Pressable, ViewStyle, StyleProp } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";

interface AnimatedPressProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
  hitSlop?: number;
}

const springConfig: WithSpringConfig = {
  damping: 18,
  mass: 0.4,
  stiffness: 180,
  overshootClamping: false,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnimatedPress({
  onPress,
  children,
  style,
  disabled = false,
  testID,
  hitSlop,
}: AnimatedPressProps) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      translateY.value = withSpring(-4, springConfig);
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      translateY.value = withSpring(0, springConfig);
      scale.value = withSpring(1, springConfig);
    }
  };

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[animatedStyle, style]}
      testID={testID}
      hitSlop={hitSlop}
    >
      {children}
    </AnimatedPressable>
  );
}
