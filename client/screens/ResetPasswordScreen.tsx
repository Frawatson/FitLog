import React, { useState, useRef } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ResetPasswordRouteProp = RouteProp<RootStackParamList, "ResetPassword">;

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ResetPasswordRouteProp>();
  const { theme } = useTheme();
  const email = route.params.email;

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newCode = [...code];
      digits.forEach((d, i) => {
        if (index + i < 6) newCode[index + i] = d;
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const cleaned = value.replace(/\D/g, "");
    const newCode = [...code];
    newCode[index] = cleaned;
    setCode(newCode);

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = "";
      setCode(newCode);
    }
  };

  const fullCode = code.join("");

  const handleReset = async () => {
    if (fullCode.length !== 6) {
      setError("Please enter the full 6-digit code");
      return;
    }
    if (!newPassword) {
      setError("Please enter a new password");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(new URL("/api/auth/reset-password", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            styles.successContent,
            { paddingTop: insets.top + Spacing["2xl"], paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <View style={[styles.successIcon, { backgroundColor: Colors.light.success + "20" }]}>
            <Feather name="check-circle" size={48} color={Colors.light.success} />
          </View>
          <ThemedText type="h1" style={styles.successTitle}>Password Reset</ThemedText>
          <ThemedText type="body" style={[styles.successSubtitle, { color: theme.textSecondary }]}>
            Your password has been updated. You can now log in with your new password.
          </ThemedText>
          <Button
            onPress={() => navigation.navigate("Login")}
            style={styles.actionButton}
          >
            Go to Log In
          </Button>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + Spacing["2xl"], paddingBottom: insets.bottom + Spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton} testID="button-back">
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>

          <View style={styles.header}>
            <ThemedText type="h1" style={styles.title}>Enter Reset Code</ThemedText>
            <ThemedText type="small" style={[styles.subtitle, { color: theme.textSecondary }]}>
              Enter the 6-digit code sent to {email}
            </ThemedText>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: Colors.light.error + "20" }]}>
                <ThemedText type="small" style={{ color: Colors.light.error }}>
                  {error}
                </ThemedText>
              </View>
            ) : null}

            <View>
              <ThemedText type="small" style={[styles.label, { fontWeight: "600" }]}>Reset Code</ThemedText>
              <View style={styles.codeRow}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { inputRefs.current[index] = ref; }}
                    style={[
                      styles.codeInput,
                      {
                        backgroundColor: theme.backgroundDefault,
                        color: theme.text,
                        borderColor: digit ? Colors.light.primary : "transparent",
                      },
                    ]}
                    value={digit}
                    onChangeText={(val) => handleCodeChange(val, index)}
                    onKeyPress={({ nativeEvent }) => handleCodeKeyPress(nativeEvent.key, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    testID={`input-code-${index}`}
                  />
                ))}
              </View>
            </View>

            <Input
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              secureTextEntry
              autoComplete="new-password"
              testID="input-new-password"
            />

            <Input
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
              autoComplete="new-password"
              testID="input-confirm-password"
            />

            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Must be 8+ characters with uppercase, lowercase, and a number
            </ThemedText>

            <Button
              onPress={handleReset}
              disabled={loading || fullCode.length !== 6}
              style={styles.actionButton}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                "Reset Password"
              )}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: Spacing.lg,
  },
  successContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    marginBottom: Spacing.lg,
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    paddingHorizontal: Spacing.md,
  },
  form: {
    gap: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.sm,
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.sm,
    fontSize: 24,
    fontWeight: "700",
    borderWidth: 2,
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  actionButton: {
    marginTop: Spacing.sm,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  successTitle: {
    marginBottom: Spacing.sm,
  },
  successSubtitle: {
    textAlign: "center",
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing["2xl"],
  },
});
