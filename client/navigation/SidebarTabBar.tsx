import React from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export const SIDEBAR_WIDTH = 240;

// Vertical sidebar that replaces the bottom tab bar on desktop web. Receives
// the same BottomTabBarProps the default bar gets, so navigation state and
// dispatch flow through unchanged — only the visual is different.
export function SidebarTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();

  return (
    <View
      accessibilityRole={"tablist" as any}
      style={[
        styles.container,
        { backgroundColor: theme.backgroundCard, borderRightColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <ThemedText type="h2" style={{ color: Colors.light.primary }}>
          Merge
        </ThemedText>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
          const isActive = state.index === index;
          const iconColor = isActive ? Colors.light.primary : theme.tabIconDefault;

          // Mirror the default bottom-tabs behavior for "press while active":
          // emit a tabPress event so nested stacks can pop to top.
          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isActive && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={isActive ? { selected: true } : {}}
              style={({ hovered, pressed }: any) => [
                styles.item,
                {
                  backgroundColor: isActive
                    ? Colors.light.primary + "1A"
                    : hovered || pressed
                    ? theme.backgroundDefault
                    : "transparent",
                },
              ]}
            >
              {options.tabBarIcon
                ? options.tabBarIcon({ focused: isActive, color: iconColor, size: 22 })
                : <Feather name="circle" size={22} color={iconColor} />}
              <ThemedText
                type="body"
                style={{
                  color: isActive ? Colors.light.primary : theme.text,
                  fontWeight: isActive ? "600" : "400",
                  marginLeft: Spacing.md,
                }}
              >
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    height: "100%",
    borderRightWidth: 1,
    paddingTop: Spacing.xl,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
