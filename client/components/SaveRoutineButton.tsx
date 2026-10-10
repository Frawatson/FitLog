import React, { useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";

import { AnimatedPress } from "@/components/AnimatedPress";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import type { Post } from "@/types";
import {
  saveRoutineFromPost,
  savableRoutineFromPost,
} from "@/lib/sharedRoutines";
import { webSafeAlert } from "@/lib/webSafeAlert";

// "Save to my workouts" for a workout or workout-plan post. Renders
// nothing for posts without exercises.
export function SaveRoutineButton({
  post,
  compact = false,
}: {
  post: Pick<Post, "postType" | "referenceData" | "authorName">;
  compact?: boolean;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  if (!savableRoutineFromPost(post)) return null;

  const onPress = async () => {
    if (state !== "idle") return;
    setState("saving");
    try {
      const { result, routineName } = await saveRoutineFromPost(post);
      if (result === "saved") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setState("saved");
        webSafeAlert(
          "Saved",
          `"${routineName}" is now in your workouts. Find it on the Workouts tab.`,
        );
      } else if (result === "already_saved") {
        setState("saved");
        webSafeAlert(
          "Already saved",
          `You already have "${routineName}" in your workouts.`,
        );
      } else {
        setState("idle");
      }
    } catch (e) {
      console.error("Failed to save shared workout:", e);
      setState("idle");
      webSafeAlert("Couldn't save", "Please try again.");
    }
  };

  const saved = state === "saved";
  return (
    <AnimatedPress
      onPress={onPress}
      disabled={state === "saving"}
      accessibilityLabel={
        saved ? "Saved to your workouts" : "Save to my workouts"
      }
      style={[
        styles.button,
        compact && styles.compact,
        {
          borderColor: Colors.light.primary,
          backgroundColor: saved ? Colors.light.primary : "transparent",
        },
      ]}
    >
      {state === "saving" ? (
        <ActivityIndicator size="small" color={Colors.light.primary} />
      ) : (
        <Feather
          name={saved ? "check" : "bookmark"}
          size={14}
          color={saved ? "#FFFFFF" : Colors.light.primary}
        />
      )}
      <ThemedText
        type="small"
        style={{
          color: saved ? "#FFFFFF" : Colors.light.primary,
          fontWeight: "600",
        }}
      >
        {saved ? "Saved" : "Save to my workouts"}
      </ThemedText>
    </AnimatedPress>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: Spacing.xs,
    borderWidth: 1.5,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
  },
  compact: {
    marginTop: Spacing.xs,
  },
});
