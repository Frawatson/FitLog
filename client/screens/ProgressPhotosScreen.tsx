import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Alert,
  Platform,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { isAuthenticated } from "@/lib/syncService";

interface ProgressPhoto {
  id: string;
  imageData: string;
  date: string;
  weightKg: number | null;
  notes: string | null;
  createdAt: string;
}

export default function ProgressPhotosScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newImageData, setNewImageData] = useState<string | null>(null);
  const [newWeight, setNewWeight] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

  const loadPhotos = async () => {
    if (!hasLoadedRef.current) setIsLoading(true);
    try {
      if (await isAuthenticated()) {
        const url = new URL("/api/progress-photos", getApiUrl());
        const response = await fetch(url.toString(), { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          setPhotos(data);
        }
      }
    } catch (error) {
      console.error("Error loading progress photos:", error);
    } finally {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        setIsLoading(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [])
  );

  const takePhoto = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (manipulated.base64) {
        setNewImageData(`data:image/jpeg;base64,${manipulated.base64}`);
        setShowAddModal(true);
      }
    }
  };

  const pickPhoto = async () => {
    if (!mediaPermission?.granted) {
      const result = await requestMediaPermission();
      if (!result.granted) return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (manipulated.base64) {
        setNewImageData(`data:image/jpeg;base64,${manipulated.base64}`);
        setShowAddModal(true);
      }
    }
  };

  const savePhoto = async () => {
    if (!newImageData) return;
    try {
      const clientId = uuidv4();
      const date = new Date().toISOString().split("T")[0];
      const url = new URL("/api/progress-photos", getApiUrl());
      await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clientId,
          imageData: newImageData,
          date,
          weightKg: newWeight ? parseFloat(newWeight) : null,
          notes: newNotes || null,
        }),
      });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setShowAddModal(false);
      setNewImageData(null);
      setNewWeight("");
      setNewNotes("");
      loadPhotos();
    } catch (error) {
      console.error("Error saving progress photo:", error);
      Alert.alert("Error", "Failed to save photo. Please try again.");
    }
  };

  const deletePhoto = (photo: ProgressPhoto) => {
    Alert.alert("Delete Photo", "Are you sure you want to delete this progress photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const url = new URL(`/api/progress-photos/${photo.id}`, getApiUrl());
            await fetch(url.toString(), { method: "DELETE", credentials: "include" });
            loadPhotos();
          } catch (error) {
            console.error("Error deleting photo:", error);
          }
        },
      },
    ]);
  };

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos((prev) => {
      if (prev.includes(photoId)) {
        return prev.filter((id) => id !== photoId);
      }
      if (prev.length >= 2) return prev;
      return [...prev, photoId];
    });
  };

  const comparePhotos = photos.filter((p) => selectedPhotos.includes(p.id));

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["3xl"],
          paddingHorizontal: Spacing.lg,
        }}
      >
        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={takePhoto}
            style={[styles.actionButton, { backgroundColor: Colors.light.primary }]}
          >
            <Feather name="camera" size={20} color="#FFFFFF" />
            <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Take Photo
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={pickPhoto}
            style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="image" size={20} color={theme.text} />
            <ThemedText type="small" style={{ fontWeight: "600" }}>Gallery</ThemedText>
          </Pressable>
          {photos.length >= 2 ? (
            <Pressable
              onPress={() => {
                setCompareMode(!compareMode);
                setSelectedPhotos([]);
              }}
              style={[
                styles.actionButton,
                {
                  backgroundColor: compareMode ? Colors.light.primary : theme.backgroundSecondary,
                },
              ]}
            >
              <Feather name="columns" size={20} color={compareMode ? "#FFFFFF" : theme.text} />
              <ThemedText
                type="small"
                style={{ fontWeight: "600", color: compareMode ? "#FFFFFF" : theme.text }}
              >
                Compare
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {compareMode ? (
          <ThemedText type="caption" style={{ textAlign: "center", opacity: 0.5, marginBottom: Spacing.md }}>
            Select 2 photos to compare side by side
          </ThemedText>
        ) : null}

        {compareMode && selectedPhotos.length === 2 ? (
          <Button
            onPress={() => setShowCompare(true)}
            style={{ marginBottom: Spacing.lg }}
          >
            View Comparison
          </Button>
        ) : null}

        {isLoading ? (
          <View style={{ gap: Spacing.md }}>
            <SkeletonLoader variant="card" />
            <SkeletonLoader variant="card" />
          </View>
        ) : photos.length === 0 ? (
          <EmptyState
            image={require("../../assets/images/empty-foods.png")}
            title="No progress photos"
            message="Take photos to track your physical transformation over time"
          />
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((photo) => {
              const isSelected = selectedPhotos.includes(photo.id);
              return (
                <Pressable
                  key={photo.id}
                  onPress={() => {
                    if (compareMode) {
                      togglePhotoSelection(photo.id);
                    }
                  }}
                  onLongPress={() => deletePhoto(photo)}
                  style={[
                    styles.photoCard,
                    compareMode && isSelected && { borderWidth: 3, borderColor: Colors.light.primary },
                  ]}
                >
                  <Image source={{ uri: photo.imageData }} style={styles.photoImage} />
                  <View style={[styles.photoInfo, { backgroundColor: theme.backgroundDefault }]}>
                    <ThemedText type="small" style={{ fontWeight: "600" }}>
                      {new Date(photo.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </ThemedText>
                    {photo.weightKg ? (
                      <ThemedText type="caption" style={{ opacity: 0.6 }}>
                        {photo.weightKg} kg
                      </ThemedText>
                    ) : null}
                    {photo.notes ? (
                      <ThemedText type="caption" style={{ opacity: 0.5 }} numberOfLines={1}>
                        {photo.notes}
                      </ThemedText>
                    ) : null}
                  </View>
                  {compareMode && isSelected ? (
                    <View style={styles.selectedBadge}>
                      <Feather name="check" size={16} color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Photo Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Add Progress Photo</ThemedText>
              <Pressable onPress={() => { setShowAddModal(false); setNewImageData(null); }}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {newImageData ? (
              <Image source={{ uri: newImageData }} style={styles.previewImage} />
            ) : null}

            <View style={styles.modalField}>
              <ThemedText type="small" style={{ fontWeight: "600", marginBottom: 4 }}>
                Weight (optional)
              </ThemedText>
              <TextInput
                style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
                placeholder="e.g., 75"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                value={newWeight}
                onChangeText={setNewWeight}
              />
            </View>

            <View style={styles.modalField}>
              <ThemedText type="small" style={{ fontWeight: "600", marginBottom: 4 }}>
                Notes (optional)
              </ThemedText>
              <TextInput
                style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
                placeholder="e.g., Front pose, 4 weeks in"
                placeholderTextColor={theme.textSecondary}
                value={newNotes}
                onChangeText={setNewNotes}
              />
            </View>

            <Button onPress={savePhoto}>Save Photo</Button>
          </View>
        </View>
      </Modal>

      {/* Compare Modal */}
      <Modal visible={showCompare} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Before & After</ThemedText>
              <Pressable onPress={() => setShowCompare(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            {comparePhotos.length === 2 ? (
              <>
                <View style={styles.compareRow}>
                  <View style={styles.compareItem}>
                    <Image source={{ uri: comparePhotos[0].imageData }} style={styles.compareImage} />
                    <ThemedText type="small" style={{ textAlign: "center", marginTop: 4, fontWeight: "600" }}>
                      {new Date(comparePhotos[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </ThemedText>
                    {comparePhotos[0].weightKg ? (
                      <ThemedText type="caption" style={{ textAlign: "center", opacity: 0.6 }}>
                        {comparePhotos[0].weightKg} kg
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.compareItem}>
                    <Image source={{ uri: comparePhotos[1].imageData }} style={styles.compareImage} />
                    <ThemedText type="small" style={{ textAlign: "center", marginTop: 4, fontWeight: "600" }}>
                      {new Date(comparePhotos[1].date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </ThemedText>
                    {comparePhotos[1].weightKg ? (
                      <ThemedText type="caption" style={{ textAlign: "center", opacity: 0.6 }}>
                        {comparePhotos[1].weightKg} kg
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  photoCard: {
    width: "47%",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    aspectRatio: 3 / 4,
  },
  photoInfo: {
    padding: Spacing.sm,
    gap: 2,
  },
  selectedBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  modalField: {
    marginBottom: Spacing.lg,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
  },
  compareRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  compareItem: {
    flex: 1,
  },
  compareImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
  },
});
