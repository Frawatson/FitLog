import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { syncToServer } from "@/lib/syncService";
import { getApiUrl } from "@/lib/query-client";

interface ExerciseInfoModalProps {
  visible: boolean;
  exerciseName: string;
  onClose: () => void;
}

interface ExerciseInfo {
  exerciseName: string;
  gifUrl: string | null;
  bodyPart: string | null;
  equipment: string | null;
  targetMuscle: string | null;
  instructions: string | null;
}

const clientCache = new Map<string, ExerciseInfo>();
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function ExerciseInfoModal({ visible, exerciseName, onClose }: ExerciseInfoModalProps) {
  const { theme } = useTheme();
  const [info, setInfo] = useState<ExerciseInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (visible && exerciseName) {
      setImageLoaded(false);
      setImageError(false);

      const cached = clientCache.get(exerciseName.toLowerCase());
      if (cached) {
        setInfo(cached);
        setLoading(false);
        return;
      }

      fetchExerciseInfo();
    }
    if (!visible) {
      setInfo(null);
    }
  }, [visible, exerciseName]);

  const fetchExerciseInfo = async () => {
    setLoading(true);
    try {
      const result = await syncToServer<ExerciseInfo>(
        `/api/exercises/gif?name=${encodeURIComponent(exerciseName)}`,
        "GET"
      );
      if (result.success && result.data) {
        const data = result.data;
        // Convert relative gifUrl to absolute URL for Image component
        if (data.gifUrl && data.gifUrl.startsWith("/")) {
          data.gifUrl = new URL(data.gifUrl, getApiUrl()).toString();
        }
        setInfo(data);
        if (data.gifUrl) {
          clientCache.set(exerciseName.toLowerCase(), data);
        }
      }
    } catch (err) {
      console.error("Error fetching exercise info:", err);
    } finally {
      setLoading(false);
    }
  };

  const chips = [
    info?.bodyPart,
    info?.equipment,
    info?.targetMuscle && info.targetMuscle !== info.bodyPart ? info.targetMuscle : null,
  ].filter(Boolean) as string[];

  const instructionLines = info?.instructions
    ? info.instructions.split("\n").filter((l) => l.trim())
    : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.backgroundCard }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* GIF Area */}
            {loading ? (
              <View style={[styles.gifPlaceholder, { backgroundColor: theme.backgroundDefault }]}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
              </View>
            ) : info?.gifUrl && !imageError ? (
              <View style={[styles.gifContainer, { backgroundColor: theme.backgroundDefault }]}>
                {!imageLoaded && (
                  <View style={[styles.gifPlaceholder, { backgroundColor: theme.backgroundDefault, position: "absolute" }]}>
                    <ActivityIndicator size="large" color={Colors.light.primary} />
                  </View>
                )}
                <Image
                  source={{ uri: info.gifUrl }}
                  style={styles.gifImage}
                  resizeMode="contain"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
              </View>
            ) : (
              <View style={[styles.gifPlaceholder, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="play-circle" size={48} color={theme.textSecondary} style={{ opacity: 0.4 }} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                  No demo available
                </ThemedText>
              </View>
            )}

            {/* Exercise Name */}
            <ThemedText type="h2" style={styles.exerciseName}>
              {exerciseName}
            </ThemedText>

            {/* Metadata Chips */}
            {chips.length > 0 && (
              <View style={styles.chipRow}>
                {chips.map((chip) => (
                  <View key={chip} style={[styles.chip, { backgroundColor: Colors.light.primary + "15" }]}>
                    <ThemedText type="caption" style={{ color: Colors.light.primary, textTransform: "capitalize" }}>
                      {chip}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}

            {/* Instructions */}
            {instructionLines.length > 0 && (
              <View style={styles.instructionsSection}>
                <ThemedText type="h4" style={styles.instructionsTitle}>
                  How to perform
                </ThemedText>
                {instructionLines.map((line, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={[styles.stepNumber, { backgroundColor: Colors.light.primary + "20" }]}>
                      <ThemedText type="caption" style={{ color: Colors.light.primary, fontWeight: "700" }}>
                        {i + 1}
                      </ThemedText>
                    </View>
                    <ThemedText type="body" style={styles.stepText}>
                      {line.trim()}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Close button */}
          <Pressable
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: theme.backgroundDefault }]}
          >
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              Close
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing["3xl"],
  },
  handleRow: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    flexGrow: 0,
  },
  scrollInner: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  gifContainer: {
    height: 280,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  gifImage: {
    width: "100%",
    height: 280,
  },
  gifPlaceholder: {
    height: 200,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  exerciseName: {
    marginBottom: Spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  instructionsSection: {
    marginBottom: Spacing.md,
  },
  instructionsTitle: {
    marginBottom: Spacing.md,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepText: {
    flex: 1,
  },
  closeButton: {
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
});
