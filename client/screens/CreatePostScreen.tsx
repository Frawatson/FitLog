import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TextInput, Pressable, Image, Platform, Linking, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { v4 as uuid } from "uuid";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { showSystemMenu } from "@/components/SystemMenu";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { PostType, PostVisibility, Workout, RunEntry } from "@/types";
import { createSocialPost } from "@/lib/socialStorage";
import * as storage from "@/lib/storage";
import { simplifyRoute } from "@/lib/units";
import { webSafeAlert } from "@/lib/webSafeAlert";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type CreatePostRoute = RouteProp<RootStackParamList, "CreatePost">;

const POST_TYPES: { type: PostType; icon: keyof typeof Feather.glyphMap; label: string; color: string }[] = [
  { type: "text", icon: "edit-3", label: "Text", color: "#9BA1A6" },
  { type: "workout", icon: "activity", label: "Workout", color: "#1B3A27" },
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
  const hasPrefill = !!(prefill?.referenceId && prefill?.referenceData);

  const [postType, setPostType] = useState<PostType>(prefill?.postType || "text");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("followers");
  const [referenceData, setReferenceData] = useState<any>(prefill?.referenceData || null);
  const [referenceId, setReferenceId] = useState<string | undefined>(prefill?.referenceId);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunEntry[]>([]);
  // selectedRefIndex was previously `prefill ? 0 : null`, but the
  // reference picker is only rendered when !hasPrefill, so the 0 was
  // dead state that highlighted a row no user could see. Always init
  // to null and let the user click to select.
  const [selectedRefIndex, setSelectedRefIndex] = useState<number | null>(null);
  const [posting, setPosting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  // Surfaces "Couldn't load recent activities" so the reference picker
  // doesn't silently show as empty when storage.getWorkouts/getRunHistory
  // throw — previously the catch only logged to the console.
  const [recentLoadError, setRecentLoadError] = useState(false);

  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

  useEffect(() => {
    if (!hasPrefill) {
      loadRecent();
      // Restore an in-progress draft from a previous session. Skipped
      // for prefill flows so "Share my workout" doesn't overwrite the
      // saved draft text the user might still want.
      storage.getPostDraft().then((draft) => {
        if (!draft) return;
        if (draft.content) setContent(draft.content);
        if (draft.postType) setPostType(draft.postType);
        if (draft.visibility) setVisibility(draft.visibility);
      });
    }
  }, []);

  // Debounced auto-save. Only fires while the user is composing a fresh
  // post — prefill mode owns its own content + type and shouldn't
  // overwrite their saved draft.
  useEffect(() => {
    if (hasPrefill) return;
    const timeoutId = setTimeout(() => {
      if (content || postType !== "text" || visibility !== "followers") {
        storage.savePostDraft({ content, postType, visibility });
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [content, postType, visibility, hasPrefill]);

  const loadRecent = async () => {
    try {
      const [workouts, runs] = await Promise.all([
        storage.getWorkouts(),
        storage.getRunHistory(),
      ]);
      setRecentWorkouts(workouts.slice(0, 5));
      setRecentRuns(runs.slice(0, 5));
      setRecentLoadError(false);
    } catch (e) {
      console.log("Failed to load recent activities:", e);
      setRecentLoadError(true);
    }
  };

  const compressImage = async (uri: string): Promise<string | null> => {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1536 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      return manipulated.base64 || null;
    } catch (error) {
      console.error("Image compression failed:", error);
      return null;
    }
  };

  const takePhoto = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        if (!result.canAskAgain && Platform.OS !== "web") {
          try { await Linking.openSettings(); } catch {}
        }
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      const base64 = await compressImage(uri);
      setImageBase64(base64);
    }
  };

  const pickImage = async () => {
    if (!mediaPermission?.granted) {
      const result = await requestMediaPermission();
      if (!result.granted) {
        if (!result.canAskAgain && Platform.OS !== "web") {
          try { await Linking.openSettings(); } catch {}
        }
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      const base64 = await compressImage(uri);
      setImageBase64(base64);
    }
  };

  const handleAddPhoto = () => {
    // showSystemMenu delegates to Alert.alert on native and renders a
    // modal sheet on web. Previously web users couldn't reach the camera
    // path because Alert.alert is a no-op there and the code shortcut
    // straight to pickImage().
    showSystemMenu({
      title: "Add Photo",
      message: "Choose a source",
      options: [
        { label: "Camera", onPress: takePhoto },
        { label: "Photo Library", onPress: pickImage },
        { label: "Cancel", cancel: true },
      ],
    });
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
      exercises: w.exercises.map(e => ({
        name: e.exerciseName,
        sets: e.sets.map(s => ({ weight: s.weight, reps: s.reps, completed: s.completed })),
      })),
    });
  };

  const selectRun = (r: RunEntry, idx: number) => {
    setSelectedRefIndex(idx);
    setReferenceId(r.id);
    const durMin = Math.round(r.durationSeconds / 60);
    setReferenceData({
      distanceKm: r.distanceKm,
      durationMinutes: durMin,
      // Numeric so viewers can format in their own unit system. The
      // legacy `pace` string is kept for backward compat with posts
      // created before this change.
      paceMinPerKm: r.paceMinPerKm,
      pace: `${Math.floor(r.paceMinPerKm)}:${String(Math.round((r.paceMinPerKm % 1) * 60)).padStart(2, "0")} /km`,
      calories: r.calories,
      route: r.route ? simplifyRoute(r.route) : undefined,
    });
  };

  const handlePost = async () => {
    if (!content.trim() && !referenceData && !imageBase64) {
      // webSafeAlert (not Alert.alert) — the latter is a no-op on web,
      // which left web users without any "must add content" feedback.
      webSafeAlert("Add content", "Write something, select an activity, or add a photo.");
      return;
    }
    setPosting(true);
    try {
      const result = await createSocialPost({
        clientId: uuid(),
        postType,
        content: content.trim() || undefined,
        referenceId,
        referenceData,
        imageData: imageBase64 || undefined,
        visibility,
      });
      if (result.success) {
        // Don't leave the draft behind once the post is live.
        await storage.clearPostDraft();
        navigation.goBack();
      } else {
        webSafeAlert("Error", "Failed to create post. Try again.");
      }
    } catch (err) {
      // Without this try/catch the previous code would throw past
      // setPosting(false), stranding the Post button in "Posting..."
      // disabled state for the rest of the screen's lifetime.
      console.error("Create post failed:", err);
      webSafeAlert("Error", "Network error. Please try again.");
    } finally {
      setPosting(false);
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
            onPress={() => {
              if (hasPrefill) return;
              setPostType(pt.type); setSelectedRefIndex(null); setReferenceData(null); setReferenceId(undefined);
            }}
            style={[
              styles.typeChip,
              {
                backgroundColor: postType === pt.type ? pt.color + "20" : theme.backgroundDefault,
                borderColor: postType === pt.type ? pt.color : theme.border,
                opacity: hasPrefill && postType !== pt.type ? 0.4 : 1,
              },
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
      <ThemedText
        type="caption"
        style={[
          styles.charCount,
          { color: content.length > 450 ? Colors.light.error : theme.textSecondary },
        ]}
      >
        {content.length} / 500
      </ThemedText>

      {/* Photo Attachment */}
      {imageUri ? (
        <View style={{ marginBottom: Spacing.xl }}>
          <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
          <Pressable
            onPress={() => { setImageUri(null); setImageBase64(null); }}
            style={[styles.removeImageBtn, { backgroundColor: theme.backgroundDefault }]}
            hitSlop={8}
          >
            <Feather name="x" size={16} color={theme.text} />
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={handleAddPhoto} style={[styles.addPhotoBtn, { borderColor: theme.border }]}>
          <Feather name="image" size={20} color={theme.textSecondary} />
          <ThemedText type="body" style={{ color: theme.textSecondary }}>Add Photo</ThemedText>
        </Pressable>
      )}

      {/* Prefilled Activity Preview */}
      {hasPrefill && referenceData && (
        <View style={[styles.refItem, { backgroundColor: Colors.light.primary + "15", borderColor: Colors.light.primary, marginBottom: Spacing.xl }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: 4 }}>
            <Feather name="check-circle" size={14} color={Colors.light.primary} />
            <ThemedText type="body" style={{ fontWeight: "600", color: Colors.light.primary }}>
              {postType === "workout" ? (referenceData.routineName || "Workout") : `${referenceData.distanceKm?.toFixed(2)} km Run`}
            </ThemedText>
          </View>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {postType === "workout"
              ? `${referenceData.durationMinutes}min \u00B7 ${referenceData.exerciseCount} exercises`
              : `${referenceData.durationMinutes}min${referenceData.pace ? ` \u00B7 ${referenceData.pace}` : ""}`}
          </ThemedText>
        </View>
      )}

      {/* Reference Picker error — only shown if the recent loader
          threw and the user has selected a type that needs a picker. */}
      {!hasPrefill && recentLoadError && (postType === "workout" || postType === "run") && (
        <View style={[styles.refLoadError, { backgroundColor: Colors.light.error + "15" }]}>
          <Feather name="alert-circle" size={16} color={Colors.light.error} />
          <ThemedText type="small" style={{ color: Colors.light.error, flex: 1 }}>
            Couldn't load recent {postType === "workout" ? "workouts" : "runs"}. You can still write a caption.
          </ThemedText>
        </View>
      )}

      {/* Reference Picker (only when not prefilled) */}
      {!hasPrefill && postType === "workout" && recentWorkouts.length > 0 && (
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
                {w.durationMinutes}min {"\u00B7"} {w.exercises.length} exercises
              </ThemedText>
            </AnimatedPress>
          ))}
        </View>
      )}

      {!hasPrefill && postType === "run" && recentRuns.length > 0 && (
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
        {posting ? (
          <View style={styles.postBtnRow}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
              Posting...
            </ThemedText>
          </View>
        ) : (
          "Post"
        )}
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
    marginBottom: Spacing.xs,
  },
  charCount: {
    textAlign: "right",
    marginBottom: Spacing.xl,
  },
  postBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  refLoadError: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.md,
  },
  removeImageBtn: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
