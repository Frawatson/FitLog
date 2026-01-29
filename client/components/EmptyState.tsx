import React from "react";
import { View, StyleSheet, Image, ImageSourcePropType } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing } from "@/constants/theme";

interface EmptyStateProps {
  image: ImageSourcePropType;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  image,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Image source={image} style={styles.image} resizeMode="contain" />
      <ThemedText type="h3" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText type="body" style={styles.message}>
        {message}
      </ThemedText>
      {actionLabel && onAction ? (
        <Button onPress={onAction} style={styles.button}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing["4xl"],
  },
  image: {
    width: 180,
    height: 180,
    marginBottom: Spacing["2xl"],
    opacity: 0.9,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  message: {
    textAlign: "center",
    opacity: 0.7,
    marginBottom: Spacing["2xl"],
  },
  button: {
    paddingHorizontal: Spacing["3xl"],
  },
});
