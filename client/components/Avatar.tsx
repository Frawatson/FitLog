import React from "react";
import { View, Image, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";

// One place to render a user avatar across the social surface. Either
// displays the uploaded image (`uri` set, typically a data: URI from
// /api/social/avatar) or falls back to the first letter of `name` on a
// neutral background. Size drives width/height/borderRadius so the same
// component works at 32px (comment row) up to 80px (profile header).
//
// Note: never load `uri` as a raw http(s) URL from a third party — the
// CSP imgSrc only allows our own origin + data:/blob: + the leaflet/
// cartocdn hosts; an arbitrary URL would be blocked by the browser.

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size: number;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
}

export function Avatar({ uri, name, size, style, backgroundColor }: AvatarProps) {
  const { theme } = useTheme();
  const bg = backgroundColor ?? theme.backgroundSecondary;
  const initial = (name?.charAt(0) || "?").toUpperCase();

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: bg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  const a11yLabel = name ? `${name}'s profile picture` : "Profile picture";

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
      style={[containerStyle, style]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFillObject} accessibilityIgnoresInvertColors />
      ) : (
        <ThemedText
          style={{
            fontSize: Math.max(12, Math.round(size * 0.4)),
            fontWeight: "700",
            color: theme.text,
          }}
        >
          {initial}
        </ThemedText>
      )}
    </View>
  );
}
