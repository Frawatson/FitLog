import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, TextInput, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { MapDisplay } from "@/components/MapDisplay";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { RunEntry, UnitSystem, HeartRateZone } from "@/types";
import * as storage from "@/lib/storage";
import {
  formatDistanceValue,
  formatDistanceUnit,
  formatPace,
  formatPaceUnit,
  simplifyRoute,
} from "@/lib/units";
import { getZoneForHeartRate } from "@/lib/heartRateZones";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RootStackParamList, "RunComplete">;

export default function RunCompleteScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { theme } = useTheme();

  const [run, setRun] = useState<RunEntry | null>(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  const [showHR, setShowHR] = useState(false);
  const [avgHRInput, setAvgHRInput] = useState("");
  const [maxHRInput, setMaxHRInput] = useState("");
  const [userAge, setUserAge] = useState(30);
  const [hrSaved, setHrSaved] = useState(false);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    loadRun();

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    scale.value = withSpring(1, { damping: 12 });
    opacity.value = withDelay(300, withSpring(1));
  }, []);

  const loadRun = async () => {
    const profile = await storage.getUserProfile();
    if (profile?.age) setUserAge(profile.age);
    if (profile?.unitSystem) setUnitSystem(profile.unitSystem);

    const runs = await storage.getRunHistory();
    const found = runs.find((r) => r.id === route.params.runId);
    if (found) setRun(found);
  };

  const handleSaveHeartRate = async () => {
    if (!run) return;
    const avgHR = parseInt(avgHRInput) || undefined;
    const maxHR = parseInt(maxHRInput) || undefined;
    if (avgHR || maxHR) {
      const runs = await storage.getRunHistory();
      const updatedRuns = runs.map((r) => {
        if (r.id === run.id) {
          let hrZone: HeartRateZone | undefined;
          if (avgHR) {
            const zoneInfo = getZoneForHeartRate(avgHR, userAge);
            hrZone = zoneInfo?.zone;
          }
          const updated = {
            ...r,
            avgHeartRate: avgHR,
            maxHeartRate: maxHR,
            heartRateZone: hrZone,
          };
          setRun(updated);
          return updated;
        }
        return r;
      });
      await storage.saveRunHistory(updatedRuns);
    }
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setHrSaved(true);
    setShowHR(false);
  };

  const handlePost = () => {
    if (!run) return;
    navigation.navigate("CreatePost", {
      prefill: {
        postType: "run",
        referenceId: run.id,
        referenceData: {
          distanceKm: run.distanceKm,
          durationMinutes: Math.round(run.durationSeconds / 60),
          pace: formatPace(run.paceMinPerKm, unitSystem),
          calories: run.calories,
          route: run.route ? simplifyRoute(run.route) : undefined,
        },
      },
    });
  };

  const handleDone = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
  };

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!run) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
        <ThemedText type="body" style={{ textAlign: "center", marginTop: Spacing.xl }}>
          Loading run...
        </ThemedText>
      </ThemedView>
    );
  }

  const distanceDisplay = formatDistanceValue(run.distanceKm, unitSystem).toFixed(2);
  const distUnit = formatDistanceUnit(unitSystem);
  const paceDisplay = formatPace(run.paceMinPerKm, unitSystem);
  const paceUnit = formatPaceUnit(unitSystem);
  const calories = run.calories || Math.round(run.distanceKm * 0.621371 * 100);

  const zoneInfo = avgHRInput
    ? getZoneForHeartRate(parseInt(avgHRInput) || 0, userAge)
    : null;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.checkmarkContainer, checkmarkStyle]}>
          <View style={[styles.checkmark, { backgroundColor: Colors.light.success }]}>
            <Feather name="check" size={48} color="#FFFFFF" />
          </View>
        </Animated.View>

        <Animated.View style={[contentStyle, { width: "100%" }]}>
          <ThemedText type="h1" style={styles.title}>
            Run Complete!
          </ThemedText>

          <ThemedText type="body" style={styles.subtitle}>
            {distanceDisplay} {distUnit} · {formatDuration(run.durationSeconds)}
          </ThemedText>

          {/* Route Map */}
          {Platform.OS === "web" && run.route && run.route.length > 1 && (
            <View style={styles.mapContainer}>
              <MapDisplay
                currentLocation={run.route[run.route.length - 1]}
                route={run.route}
              />
            </View>
          )}

          {/* Stats */}
          <Card style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { color: Colors.light.primary }]}>
                  {distanceDisplay}
                </ThemedText>
                <ThemedText type="small" style={{ opacity: 0.6 }}>{distUnit}</ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.stat}>
                <ThemedText style={[styles.statValue, { color: theme.text }]}>
                  {formatDuration(run.durationSeconds)}
                </ThemedText>
                <ThemedText type="small" style={{ opacity: 0.6 }}>duration</ThemedText>
              </View>
            </View>
            <View style={[styles.secondaryStatsRow, { borderTopColor: theme.border }]}>
              <View style={styles.stat}>
                <ThemedText style={[styles.secondaryValue, { color: theme.text }]}>
                  {paceDisplay}
                </ThemedText>
                <ThemedText type="small" style={{ opacity: 0.6 }}>pace {paceUnit}</ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.stat}>
                <ThemedText style={[styles.secondaryValue, { color: theme.text }]}>
                  {calories}
                </ThemedText>
                <ThemedText type="small" style={{ opacity: 0.6 }}>calories</ThemedText>
              </View>
            </View>
          </Card>

          {/* Heart Rate Section */}
          {!hrSaved && !run.avgHeartRate && (
            <>
              {!showHR ? (
                <AnimatedPress
                  onPress={() => setShowHR(true)}
                  style={[styles.hrToggle, { backgroundColor: theme.backgroundDefault }]}
                >
                  <Feather name="heart" size={18} color={Colors.light.primary} />
                  <ThemedText type="body" style={{ color: Colors.light.primary, marginLeft: Spacing.sm }}>
                    Add Heart Rate
                  </ThemedText>
                </AnimatedPress>
              ) : (
                <Card style={styles.hrCard}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.lg }}>
                    <Feather name="heart" size={20} color={Colors.light.primary} />
                    <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Heart Rate</ThemedText>
                  </View>

                  <View style={styles.hrInputRow}>
                    <View style={styles.hrInputGroup}>
                      <ThemedText type="small" style={{ marginBottom: Spacing.xs }}>Avg HR (bpm)</ThemedText>
                      <TextInput
                        style={[styles.hrInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                        value={avgHRInput}
                        onChangeText={setAvgHRInput}
                        keyboardType="number-pad"
                        placeholder="145"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                    <View style={styles.hrInputGroup}>
                      <ThemedText type="small" style={{ marginBottom: Spacing.xs }}>Max HR (bpm)</ThemedText>
                      <TextInput
                        style={[styles.hrInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                        value={maxHRInput}
                        onChangeText={setMaxHRInput}
                        keyboardType="number-pad"
                        placeholder="175"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                  </View>

                  {zoneInfo && (
                    <View style={[styles.zoneBadge, { backgroundColor: zoneInfo.color + "20" }]}>
                      <View style={[styles.zoneDot, { backgroundColor: zoneInfo.color }]} />
                      <ThemedText type="body" style={{ color: zoneInfo.color }}>
                        {zoneInfo.name} Zone
                      </ThemedText>
                    </View>
                  )}

                  <View style={styles.hrButtons}>
                    <AnimatedPress
                      onPress={() => setShowHR(false)}
                      style={[styles.hrButton, { borderColor: theme.border, borderWidth: 1 }]}
                    >
                      <ThemedText type="body">Cancel</ThemedText>
                    </AnimatedPress>
                    <AnimatedPress
                      onPress={handleSaveHeartRate}
                      style={[styles.hrButton, { backgroundColor: Colors.light.primary }]}
                    >
                      <ThemedText type="body" style={{ color: "#fff" }}>Save</ThemedText>
                    </AnimatedPress>
                  </View>
                </Card>
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg, backgroundColor: theme.backgroundDefault, borderTopWidth: 1, borderTopColor: theme.border }]}>
        <View style={styles.footerButtons}>
          <Button onPress={handlePost} variant="outline" style={styles.postButton}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
              <Feather name="users" size={18} color={Colors.light.primary} />
              <ThemedText type="body" style={{ color: Colors.light.primary, fontWeight: "600" }}>
                Post
              </ThemedText>
            </View>
          </Button>
          <Button onPress={handleDone} style={styles.doneButton}>
            Done
          </Button>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  checkmarkContainer: {
    marginBottom: Spacing["2xl"],
  },
  checkmark: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
    marginBottom: Spacing["2xl"],
  },
  mapContainer: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.xl,
    backgroundColor: "#1a1a2e",
  },
  statsCard: {
    width: "100%",
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 40,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  secondaryStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  secondaryValue: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 30,
  },
  hrToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  hrCard: {
    width: "100%",
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  hrInputRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  hrInputGroup: {
    flex: 1,
  },
  hrInput: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  zoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hrButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  hrButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  footerButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  postButton: {
    flex: 1,
  },
  doneButton: {
    flex: 2,
  },
});
