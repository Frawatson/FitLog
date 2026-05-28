import React from "react";
import { Image, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { RETRACTABLE_HEADER_HEIGHT } from "@/hooks/useRetractableHeader";

interface RightAction {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
}

interface RetractableHeaderProps {
  // Either a text title or an image source for the logo variant. If both
  // are supplied, `logoSource` wins.
  title?: string;
  logoSource?: number; // require()'d image
  logoHeight?: number;
  rightAction?: RightAction;
  // Animated style produced by useRetractableHeader(); when omitted the
  // header is static (still uses absolute positioning, no slide).
  animatedStyle?: any;
}

export function RetractableHeader({
  title,
  logoSource,
  logoHeight = 32,
  rightAction,
  animatedStyle,
}: RetractableHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const totalHeight = RETRACTABLE_HEADER_HEIGHT + insets.top;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          height: totalHeight,
          paddingTop: insets.top,
          backgroundColor: theme.backgroundRoot,
          // Subtle bottom divider only on non-iOS — iOS users expect a
          // borderless translucent header.
          borderBottomColor: theme.border,
          borderBottomWidth: Platform.OS === "ios" ? 0 : StyleSheet.hairlineWidth,
        },
        animatedStyle,
      ]}
    >
      <View style={styles.inner}>
        <View style={styles.center}>
          {logoSource ? (
            <Image
              source={logoSource}
              style={{ height: logoHeight, width: logoHeight, resizeMode: "contain" }}
              accessibilityLabel="Gbolo"
            />
          ) : title ? (
            <ThemedText type="h3" style={styles.title} numberOfLines={1}>
              {title}
            </ThemedText>
          ) : null}
        </View>
        {rightAction ? (
          <Pressable
            onPress={rightAction.onPress}
            hitSlop={8}
            accessibilityLabel={rightAction.accessibilityLabel}
            style={styles.rightAction}
          >
            <Feather name={rightAction.icon} size={24} color={theme.text} />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "600",
  },
  rightAction: {
    position: "absolute",
    right: Spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});
