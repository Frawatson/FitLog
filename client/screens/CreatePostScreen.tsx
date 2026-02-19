import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TextInput, Pressable, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { v4 as uuid } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { PostType, PostVisibility, Workout, RunEntry } from "@/types";
import { createSocialPost } from "@/lib/socialStorage";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type CreatePostRoute = RouteProp<RootStackParamList, "CreatePost">;

const POST_TYPES: { type: PostType; icon: keyof typeof Feather.glyphMap; label: string; color: string }[] = [
  { type: "text", icon: "edit-3", label: "Text", color: "#9BA1A6" },
  { type: "workout", icon: "activity", label: "Workout", color: "#FF4500" },
  { type: "run", icon: "map-pin", label: "Run", color: "#00D084" },
  { type: "meal", icon: "pie-chart", label: "Meal", color: "#818cf8" },
  { type: "achievement", icon: "award", label: "Achievement", color: "#facc15" },
];

export default function CreatePostScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CreatePostRoute>();
  const { theme } = useTheme();

  const prefill = route.params?.prefill;

  const [postType, setPostType] = useState<PostType>(prefill?.postType || "text");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("followers");
  const [referenceData, setReferenceData] = useState<any>(prefill?.referenceData || null);
  const [referenceId, setReferenceId] = useState<string | undefined>(prefill?.referenceId);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunEntry[]>([]);
  const [selectedRefIndex, setSelectedRefIndex] = useState<number | null>(prefill ? 0 : null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadRecent();
  }, []);

  const loadRecent = async () => {
    const [workouts, runs] = await Promise.all([
      storage.getWorkouts(),
      storage.getRunHistory(),
    ]);
    setRecentWorkouts(workouts.slice(0, 5));
    setRecentRuns(runs.slice(0, 5));
  };

  const selectWorkout = (w: Workout, idx: number) => {
    setSelectedRefIndex(idx);
    setReferenceId(w.id);
    setReferenceData({
      routineName: w.routineName,
      durationMinutes: w.durationMinutes,
      totalSets: w.exercises.reduce((acc, e) => acc + e.sets.length, 0),
      exerciseCount: w.exercises.length,
      totalVolumeKg: w.totalVolumeKg,
    });
  };

  const selectRun = (r: RunEntry, idx: number) => {
    setSelectedRefIndex(idx);
    setReferenceId(r.id);
    const durMin = Math.round(r.durationSeconds / 60);
    setReferenceData({
      distanceKm: r.distanceKm,
      durationMinutes: durMin,
      pace: `${Math.floor(r.paceMinPerKm)}:${String(Math.round((r.paceMinPerKm % 1) * 60)).padStart(2, "0")} /km`,
      calories: r.calories,
    });
  };

  const handlePost = async () => {
    if (!content.trim() && !referenceData) {
      Alert.alert("Add content", "Write something or select an activity to share.");
      return;
    }
    setPosting(true);
    const result = await createSocialPost({
      clientId: uuid(),
      postType,
      content: content.trim() || undefined,
      referenceId,
      referenceData,
      visibility,
    });
    setPosting(false);
    if (result.success) {
      navigation.goBack();
    } else {
      Alert.alert("Error", "Failed to create post. Try again.");
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: Spacing["5xl"] }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Post Type Selector */}
      <View style={styles.typeRow}>
        {POST_TYPES.map((pt) => (
          <AnimatedPress
            key={pt.type}
            onPress={() => { setPostType(pt.type); setSelectedRefIndex(null); setReferenceData(null); setReferenceId(undefined); }}
            style={[
              styles.typeChip,
              { backgroundColor: postType === pt.type ? pt.color + "20" : theme.backgroundDefault, borderColor: postType === pt.type ? pt.color : theme.border },
            ]}
          >
            <Feather name={pt.icon} size={14} color={postType === pt.type ? pt.color : theme.textSecondary} />
            <ThemedText type="caption" style={{ color: postType === pt.type ? pt.color : theme.textSecondary }}>{pt.label}</ThemedText>
          </AnimatedPress>
        ))}
      </View>

      {/* Caption */}
      <TextInput
        style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
        placeholder="What's on your mind?"
        placeholderTextColor={theme.textSecondary}
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={500}
        textAlignVertical="top"
      />

      {/* Reference Picker */}
      {postType === "workout" && recentWorkouts.length > 0 && (
        <View style={{ marginBottom: Spacing.xl }}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Select Workout</ThemedText>
          {recentWorkouts.map((w, i) => (
            <AnimatedPress
              key={w.id}
              onPress={() => selectWorkout(w, i)}
              style={[styles.refItem, { backgroundColor: selectedRefIndex === i ? Colors.light.primary + "15" : theme.backgroundDefault, borderColor: selectedRefIndex === i ? Colors.light.primary : theme.border }]}
            >
              <ThemedText type="body" style={{ fontWeight: "600" }}>{w.routineName}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {w.durationMinutes}min &middot; {w.exercises.length} exercises
              </ThemedText>
            </AnimatedPress>
          ))}
        </View>
      )}

      {postType === "run" && recentRuns.length > 0 && (
        <View style={{ marginBottom: Spacing.xl }}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Select Run</ThemedText>
          {recentRuns.map((r, i) => (
            <AnimatedPress
              key={r.id}
              onPress={() => selectRun(r, i)}
              style={[styles.refItem, { backgroundColor: selectedRefIndex === i ? Colors.light.primary + "15" : theme.backgroundDefault, borderColor: selectedRefIndex === i ? Colors.light.primary : theme.border }]}
            >
              <ThemedText type="body" style={{ fontWeight: "600" }}>{r.distanceKm.toFixed(2)} km</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {Math.round(r.durationSeconds / 60)}min
              </ThemedText>
            </AnimatedPress>
          ))}
        </View>
      )}

      {/* Visibility */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing["2xl"] }}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>Visible to:</ThemedText>
        <Pressable onPress={() => setVisibility(visibility === "followers" ? "public" : "followers")}>
          <View style={[styles.visChip, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name={visibility === "public" ? "globe" : "users"} size={14} color={theme.textSecondary} />
            <ThemedText type="caption">{visibility === "public" ? "Everyone" : "Followers"}</ThemedText>
          </View>
        </Pressable>
      </View>

      <Button onPress={handlePost} disabled={posting}>
        {posting ? "Posting..." : "Post"}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    fontSize: 16,
    minHeight: 100,
    marginBottom: Spacing.xl,
  },
  refItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  visChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
});
