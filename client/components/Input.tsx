import React, { forwardRef } from "react";
import { TextInput, View, StyleSheet, TextInputProps } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

// forwardRef so screens can chain fields (email → password) with
// onSubmitEditing + ref.focus(). Without it, Enter/Next had nowhere
// to go and keyboard flow between fields was impossible.
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, style, ...props },
  ref,
) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText
          type="small"
          style={styles.label}
          // Announce the label with the field for screen readers.
          nativeID={props.accessibilityLabel ? undefined : label}
        >
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={props.accessibilityLabel ?? label}
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
});

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
