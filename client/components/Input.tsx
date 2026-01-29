import React from "react";
import { TextInput, View, StyleSheet, TextInputProps } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText type="small" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundDefault,
            color: theme.text,
            borderColor: error ? theme.error : "transparent",
          },
          style,
        ]}
        placeholderTextColor={theme.textSecondary}
        {...props}
      />
      {error ? (
        <ThemedText type="small" style={[styles.error, { color: theme.error }]}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 2,
  },
  error: {
    marginTop: Spacing.xs,
  },
});
