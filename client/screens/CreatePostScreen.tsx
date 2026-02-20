import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TextInput, Pressable, Alert, Image, Platform, Linking } from "react-native";
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
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { PostType, PostVisibility, Workout, RunEntry } from "@/types";
import { createSocialPost } from "@/lib/socialStorage";
import * as storage from "@/lib/storage";
import { simplifyRoute } from "@/lib/units";
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
  const hasPrefill = !!(prefill?.referenceId && prefill?.referenceData);

  const [postType, setPostType] = useState<PostType>(prefill?.postType || "text");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("followers");
  const [referenceData, setReferenceData] = useState<any>(prefill?.referenceData || null);
  const [referenceId, setReferenceId] = useState<string | undefined>(prefill?.referenceId);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [recentRuns, setRecentRuns] = useState<RunEntry[]>([]);
  const [selectedRefIndex, setSelectedRefIndex] = useState<number | null>(prefill ? 0 : null);
  const [posting, setPosting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

  useEffect(() => {
    if (!hasPrefill) {
      loadRecent();
    }
  }, []);

  const loadRecent = async () => {
    try {
      const [workouts, runs] = await Promise.all([
        storage.getWorkouts(),
        storage.getRunHistory(),
      ]);
      setRecentWorkouts(workouts.slice(0, 5));
      setRecentRuns(runs.slice(0, 5));
    } catch (e) {
      console.log("Failed to load recent activities:", e);
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
    Alert.alert("Add Photo", "Choose a source", [
      { text: "Camera", onPress: takePhoto },
      { text: "Photo Library", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
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
      pace: `${Math.floor(r.paceMinPerKm)}:${String(Math.round((r.paceMinPerKm % 1) * 60)).padStart(2, "0")} /km`,
      calories: r.calories,
      route: r.route ? simplifyRoute(r.route) : undefined,
    });
  };

  const handlePost = async () => {
    if (!content.trim() && !referenceData && !imageBase64) {
      Alert.alert("Add content", "Write something, select an activity, or add a photo.");
      return;
    }
    setPosting(true);
    const result = await createSocialPost({
      clientId: uuid(),
      postType,
      content: content.trim() || undefined,
      referenceId,
      referenceData,
      imageData: imageBase64 || undefined,
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
