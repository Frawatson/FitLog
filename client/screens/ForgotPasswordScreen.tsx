import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
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

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(new URL("/api/auth/forgot-password", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setSent(true);
    } catch (err: any) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    navigation.navigate("ResetPassword", { email: email.trim() });
  };

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
            <View style={[styles.iconContainer, { backgroundColor: Colors.light.primary + "15" }]}>
              <Feather name="lock" size={36} color={Colors.light.primary} />
            </View>
            <ThemedText type="h1" style={styles.title}>Reset Password</ThemedText>
            <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
              {sent
                ? "We sent a 6-digit code to your email. Enter it on the next screen to set a new password."
                : "Enter the email address linked to your account and we'll send you a reset code."}
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

            {sent ? (
              <View style={[styles.successBox, { backgroundColor: Colors.light.success + "20" }]}>
                <Feather name="check-circle" size={20} color={Colors.light.success} />
                <ThemedText type="small" style={{ color: Colors.light.success, marginLeft: Spacing.sm, flex: 1 }}>
                  Check your email for the reset code
                </ThemedText>
              </View>
            ) : null}

            {!sent ? (
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                testID="input-email"
              />
            ) : null}

            {sent ? (
              <Button onPress={handleContinue} style={styles.actionButton}>
                Enter Reset Code
              </Button>
            ) : (
              <Button
                onPress={handleSubmit}
                disabled={loading}
                style={styles.actionButton}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  "Send Reset Code"
                )}
              </Button>
            )}

            {sent ? (
              <Pressable onPress={() => { setSent(false); setError(""); }} style={styles.resendLink}>
                <ThemedText type="small" style={{ color: Colors.light.primary }}>
                  Didn't get it? Send again
                </ThemedText>
              </Pressable>
            ) : null}

            <View style={styles.footer}>
              <Pressable onPress={() => navigation.goBack()} testID="button-back-login">
                <ThemedText type="body" style={{ color: Colors.light.primary, fontWeight: "600" }}>
                  Back to Log In
                </ThemedText>
              </Pressable>
            </View>
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  form: {
    gap: Spacing.lg,
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  successBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    marginTop: Spacing.sm,
  },
  resendLink: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  footer: {
    alignItems: "center",
    marginTop: Spacing.xl,
  },
});
