import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp, useFocusEffect, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AnimatedPress } from "@/components/AnimatedPress";
import { MapDisplay } from "@/components/MapDisplay";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { RunEntry, UnitSystem } from "@/types";
import * as storage from "@/lib/storage";
import { formatDistanceValue, formatDistanceUnit, formatSpeedValue, formatSpeedUnit } from "@/lib/units";
import { RunStackParamList, RunGoal } from "@/navigation/RunStackNavigator";
import { getZoneColor } from "@/lib/heartRateZones";

type NavigationProp = NativeStackNavigationProp<RunStackParamList>;
type RunTrackerRouteProp = RouteProp<RunStackParamList, "RunTracker">;

const MAP_HEIGHT = 220;

export default function RunTrackerScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route_ = useRoute<RunTrackerRouteProp>();
  const { theme } = useTheme();
  
  const goal = route_.params?.goal;
  
  const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [route, setRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const [runHistory, setRunHistory] = useState<RunEntry[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [splits, setSplits] = useState<number[]>([]);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  const [audioMuted, setAudioMuted] = useState(false);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocation = useRef<Location.LocationObject | null>(null);
  const startTimeRef = useRef<string>("");
  const mapRef = useRef<any>(null);
  const lastSplitDistance = useRef<number>(0);
  const goalReachedRef = useRef(false);
  const lastAnnouncedMile = useRef<number>(0);
  const audioMutedRef = useRef(false);

  const speakCue = (text: string) => {
    if (audioMutedRef.current) return;
    try {
      Speech.speak(text, { rate: 1.0, pitch: 1.0 });
    } catch {
      // Speech not available on this platform
    }
  };

  const toggleMute = () => {
    const newVal = !audioMuted;
    setAudioMuted(newVal);
    audioMutedRef.current = newVal;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  useEffect(() => {
    checkPermission();
    loadRunHistory();
    loadUserAge();
    return () => {
      if (locationSubscription.current) {
        try {
          locationSubscription.current.remove();
        } catch {
          // Ignore errors on subscription removal (web compatibility)
        }
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  const loadUserAge = async () => {
    const profile = await storage.getUserProfile();
    if (profile?.unitSystem) {
      setUnitSystem(profile.unitSystem);
    }
  };
  
  // Reload run history and reset state when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      loadRunHistory();
      if (!isRunning) {
        setDuration(0);
        setDistance(0);
        setRoute([]);
        setSplits([]);
        goalReachedRef.current = false;
      }
    }, [isRunning])
  );
  
  const checkPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setPermission(status);
    if (status === "granted") {
      getCurrentLocation();
    }
  };
  
  const requestPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermission(status);
    if (status === "granted") {
      getCurrentLocation();
    }
  };
  
  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.log("Could not get current location");
    }
  };
  
  const loadRunHistory = async () => {
    const runs = await storage.getRunHistory();
    console.log("[RunTracker] Loaded run history:", runs.length, "runs");
    setRunHistory(runs);
  };
  
  const startRun = async () => {
    if (permission !== "granted") {
      requestPermission();
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRunning(true);
    setIsPaused(false);
    setDuration(0);
    setDistance(0);
    setRoute([]);
    setSplits([]);
    lastLocation.current = null;
    lastSplitDistance.current = 0;
    lastAnnouncedMile.current = 0;
    startTimeRef.current = new Date().toISOString();

    if (goal) {
      const goalDesc = goal.type === "distance" ? `${goal.value} ${unitSystem === "imperial" ? "mile" : "kilometer"} goal` : `${goal.value} minute goal`;
      speakCue(`Run started. ${goalDesc}`);
    } else {
      speakCue("Run started");
    }
    
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
    
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (location) => {
        const { latitude, longitude } = location.coords;
        
        setRoute((prev) => [...prev, { latitude, longitude }]);
        setCurrentLocation({ latitude, longitude });
        
        if (lastLocation.current) {
          const dist = calculateDistance(
            lastLocation.current.coords.latitude,
            lastLocation.current.coords.longitude,
            latitude,
            longitude
          );
          setDistance((d) => {
            const newDistance = d + dist;
            const currentMile = Math.floor(newDistance * 0.621371);
            const lastMile = Math.floor(lastSplitDistance.current * 0.621371);
            if (currentMile > lastMile && currentMile > 0) {
              setSplits((prev) => [...prev, duration]);
              lastSplitDistance.current = newDistance;
            }
            // Audio milestone announcement
            const milestoneUnit = unitSystem === "imperial" ? newDistance * 0.621371 : newDistance;
            const currentMilestone = Math.floor(milestoneUnit);
            if (currentMilestone > lastAnnouncedMile.current && currentMilestone > 0) {
              lastAnnouncedMile.current = currentMilestone;
              const unitLabel = unitSystem === "imperial" ? (currentMilestone === 1 ? "mile" : "miles") : (currentMilestone === 1 ? "kilometer" : "kilometers");
              speakCue(`${currentMilestone} ${unitLabel} completed`);
            }
            return newDistance;
          });
        }
        
        lastLocation.current = location;
      }
    );
  };
  
  const pauseRun = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    speakCue("Paused");
    setIsPaused(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (locationSubscription.current) {
      try {
        locationSubscription.current.remove();
      } catch {
        // Ignore errors on subscription removal (web compatibility)
      }
      locationSubscription.current = null;
    }
  };
  
  const resumeRun = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    speakCue("Resumed");
    setIsPaused(false);
    
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
    
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (location) => {
        const { latitude, longitude } = location.coords;
        
        setRoute((prev) => [...prev, { latitude, longitude }]);
        setCurrentLocation({ latitude, longitude });
        
        if (lastLocation.current) {
          const dist = calculateDistance(
            lastLocation.current.coords.latitude,
            lastLocation.current.coords.longitude,
            latitude,
            longitude
          );
          setDistance((d) => d + dist);
        }
        
        lastLocation.current = location;
      }
    );
  };
  
  const checkGoalReached = (currentDistance: number, currentDuration: number) => {
    if (!goal || goalReachedRef.current) return;

    const currentDisplayDistance = formatDistanceValue(currentDistance, unitSystem);
    const durationMinutes = currentDuration / 60;

    if (goal.type === "distance" && currentDisplayDistance >= goal.value) {
      goalReachedRef.current = true;
      speakCue("Goal reached! Great job!");
      completeRun(true);
    } else if (goal.type === "time" && durationMinutes >= goal.value) {
      goalReachedRef.current = true;
      speakCue("Goal reached! Great job!");
      completeRun(true);
    }
  };
  
  useEffect(() => {
    if (isRunning && !isPaused) {
      checkGoalReached(distance, duration);
    }
  }, [distance, duration, isRunning, isPaused]);
  
  const completeRun = async (goalReached: boolean) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (locationSubscription.current) {
      try {
        locationSubscription.current.remove();
      } catch {
        // Ignore errors on subscription removal (web compatibility)
      }
      locationSubscription.current = null;
    }
    
    const finalDistance = distance;
    const finalDuration = duration;
    
    if (finalDuration > 0 && finalDistance >= 0.01) {
      const pace = finalDuration / 60 / finalDistance;
      const distanceMiles = finalDistance * 0.621371;  // always in miles for calorie estimation
      const runCalories = Math.round(distanceMiles * 100);

      // Voice announcement with run summary
      const distValue = unitSystem === "imperial"
        ? finalDistance * 0.621371
        : finalDistance;
      const distUnit = unitSystem === "imperial"
        ? (distValue >= 2 ? "miles" : "mile")
        : (distValue >= 2 ? "kilometers" : "kilometer");

      const totalMins = Math.floor(finalDuration / 60);
      const totalSecs = finalDuration % 60;
      let timeStr = "";
      if (totalMins > 0) timeStr += `${totalMins} minute${totalMins !== 1 ? "s" : ""}`;
      if (totalSecs > 0) {
        if (totalMins > 0) timeStr += " ";
        timeStr += `${totalSecs} second${totalSecs !== 1 ? "s" : ""}`;
      }

      const paceInUnit = unitSystem === "imperial" ? pace / 0.621371 : pace;
      const paceMins = Math.floor(paceInUnit);
      const paceSecs = Math.round((paceInUnit - paceMins) * 60);
      const paceUnitLabel = unitSystem === "imperial" ? "mile" : "kilometer";
      let paceStr = `${paceMins} minute${paceMins !== 1 ? "s" : ""}`;
      if (paceSecs > 0) paceStr += ` ${paceSecs} second${paceSecs !== 1 ? "s" : ""}`;

      speakCue(
        `Run complete. ${distValue.toFixed(1)} ${distUnit} in ${timeStr}. Average pace: ${paceStr} per ${paceUnitLabel}.`
      );

      const runId = uuidv4();
      const runEntry: RunEntry = {
        id: runId,
        distanceKm: finalDistance,
        durationSeconds: finalDuration,
        paceMinPerKm: pace,
        calories: runCalories,
        startedAt: startTimeRef.current,
        completedAt: new Date().toISOString(),
        route,
      };
      
      await storage.saveRunEntry(runEntry);

      setIsRunning(false);
      setIsPaused(false);

      // Navigate to dedicated completion screen
      navigation.dispatch(
        CommonActions.navigate({ name: "RunComplete", params: { runId } })
      );
      return;
    }

    speakCue("Run too short to save.");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setIsRunning(false);
    setIsPaused(false);
    setDistance(0);
    setDuration(0);
    setRoute([]);
    setSplits([]);
    lastAnnouncedMile.current = 0;
    lastSplitDistance.current = 0;
  };

  const stopRun = async () => {
    const goalReached = goal ? (
      goal.type === "distance"
        ? formatDistanceValue(distance, unitSystem) >= goal.value
        : duration / 60 >= goal.value
    ) : false;
    completeRun(goalReached);
  };
  
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };
  
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  
  const displayDistance = formatDistanceValue(distance, unitSystem);
  const distanceUnit = formatDistanceUnit(unitSystem);
  const currentPace = duration > 0 && distance > 0 ? duration / 60 / distance : 0;
  const speed = formatSpeedValue(distance, duration, unitSystem);
  const speedUnit = formatSpeedUnit(unitSystem);
  const calories = Math.round(formatDistanceValue(distance, "imperial") * 100);
  
  if (permission === null && Platform.OS !== "web") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <View style={styles.centered}>
          <ThemedText type="body">Checking location access...</ThemedText>
        </View>
      </View>
    );
  }
  
  if (permission !== "granted" && Platform.OS !== "web") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <View style={styles.centered}>
          <Feather name="map-pin" size={48} color={Colors.light.primary} />
          <ThemedText type="h3" style={styles.permissionTitle}>
            Track Your Runs
          </ThemedText>
          <ThemedText type="body" style={styles.permissionText}>
            Allow location access to track distance, pace, and route.
          </ThemedText>
          <Button onPress={requestPermission} style={styles.permissionButton}>
            Enable Location
          </Button>
        </View>
      </View>
    );
  }
  
  const goalProgress = goal ? (
    goal.type === "distance"
      ? (displayDistance / goal.value) * 100
      : ((duration / 60) / goal.value) * 100
  ) : 0;
  
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: insets.bottom + Spacing["3xl"],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mapContainer}>
          <MapDisplay
            currentLocation={currentLocation}
            route={route}
            mapRef={mapRef}
          />
          <View style={styles.mapOverlay}>
            <ThemedText type="small" style={styles.dateText}>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </ThemedText>
          </View>
          <Pressable onPress={toggleMute} style={styles.muteButton}>
            <Feather name={audioMuted ? "volume-x" : "volume-2"} size={18} color="#FFFFFF" />
          </Pressable>
          {goal && isRunning ? (
            <View style={styles.goalBadge}>
              <ThemedText style={styles.goalBadgeText}>
                {goal.type === "distance" ? `${goal.value} ${distanceUnit} goal` : `${goal.value} min goal`}
              </ThemedText>
            </View>
          ) : null}
        </View>
        
        {goal && isRunning ? (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${Math.min(goalProgress, 100)}%` }
                ]} 
              />
            </View>
            <ThemedText type="small" style={[styles.progressText, { color: theme.textSecondary }]}>
              {Math.min(Math.round(goalProgress), 100)}% complete
            </ThemedText>
          </View>
        ) : null}
        
        <View style={[styles.statsContainer, { borderBottomColor: theme.border }]}>
          <View style={styles.mainStatsRow}>
            <View style={styles.mainStat}>
              <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>{distanceUnit.toUpperCase()}</ThemedText>
              <ThemedText type="display" style={{ fontWeight: "700" }}>{displayDistance.toFixed(2)}</ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.mainStat}>
              <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>Min : Sec</ThemedText>
              <ThemedText type="display" style={{ fontWeight: "700" }}>{formatDuration(duration)}</ThemedText>
            </View>
          </View>
          
          <View style={[styles.secondaryStatsRow, { borderTopColor: theme.border }]}>
            <View style={styles.secondaryStat}>
              <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>Speed ({speedUnit})</ThemedText>
              <ThemedText type="h1" style={{ fontWeight: "600" }}>{speed.toFixed(2)}</ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.secondaryStat}>
              <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>Calories</ThemedText>
              <ThemedText type="h1" style={{ fontWeight: "600" }}>{calories}</ThemedText>
            </View>
          </View>
          
          {splits.length > 0 ? (
            <View style={[styles.splitsContainer, { borderTopColor: theme.border }]}>
              <ThemedText type="small" style={[styles.splitsLabel, { color: theme.textSecondary }]}>Splits:</ThemedText>
              <View style={styles.splitsRow}>
                {splits.map((splitTime, index) => (
                  <View key={index} style={[styles.splitItem, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText style={styles.splitMile}>{index + 1} {distanceUnit.charAt(0).toUpperCase() + distanceUnit.slice(1)}</ThemedText>
                    <ThemedText style={[styles.splitTime, { color: theme.text }]}>{formatDuration(splitTime)}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
        
        <View style={styles.controlsContainer}>
          {!isRunning ? (
            <View style={styles.startControls}>
              <AnimatedPress onPress={() => navigation.navigate("RunGoal")} style={[styles.goalButton, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="target" size={20} color={Colors.light.primary} />
                <ThemedText style={[styles.goalButtonText, { color: theme.text }]}>Set Goal</ThemedText>
              </AnimatedPress>
              <Button onPress={startRun} style={styles.startButton}>
                <View style={styles.startButtonContent}>
                  <Feather name="play" size={28} color="#fff" />
                  <ThemedText type="body" style={styles.startButtonText}>
                    {goal ? `START ${goal.type === "distance" ? `${goal.value} ${distanceUnit.toUpperCase()}` : `${goal.value} MIN`} RUN` : "FREE RUN"}
                  </ThemedText>
                </View>
              </Button>
            </View>
          ) : (
            <View style={styles.activeControls}>
              {isPaused ? (
                <AnimatedPress onPress={resumeRun} style={[styles.controlButton, styles.resumeButton]}>
                  <Feather name="play" size={28} color="#FFFFFF" />
                </AnimatedPress>
              ) : (
                <AnimatedPress onPress={pauseRun} style={[styles.controlButton, styles.pauseButton]}>
                  <Feather name="pause" size={28} color="#FFFFFF" />
                </AnimatedPress>
              )}
              <AnimatedPress onPress={stopRun} style={[styles.controlButton, styles.stopButton]}>
                <Feather name="square" size={28} color="#FFFFFF" />
              </AnimatedPress>
            </View>
          )}
        </View>
        
        <View style={styles.historySection}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Run History</ThemedText>
          {runHistory.length > 0 ? (
            runHistory.slice(0, 5).map((run) => (
              <Card
                key={run.id}
                onPress={() => {
                  navigation.navigate("RunDetail" as any, { run });
                }}
                style={styles.historyCard}
              >
                <View style={styles.historyHeader}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {new Date(run.completedAt).toLocaleDateString()}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {new Date(run.completedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </ThemedText>
                </View>
                <View style={styles.historyStats}>
                  <View style={styles.historyStat}>
                    <ThemedText type="body" style={[styles.historyValue, { color: Colors.light.primary }]}>
                      {formatDistanceValue(run.distanceKm, unitSystem).toFixed(2)}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>{distanceUnit}</ThemedText>
                  </View>
                  <View style={styles.historyStat}>
                    <ThemedText type="body" style={[styles.historyValue, { color: Colors.light.primary }]}>
                      {formatDuration(run.durationSeconds)}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>time</ThemedText>
                  </View>
                  <View style={styles.historyStat}>
                    <ThemedText type="body" style={[styles.historyValue, { color: Colors.light.primary }]}>
                      {run.calories || Math.round(run.distanceKm * 60)}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>kcal</ThemedText>
                  </View>
                  {run.avgHeartRate ? (
                    <View style={styles.historyStat}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Feather name="heart" size={12} color={run.heartRateZone ? getZoneColor(run.heartRateZone) : Colors.light.primary} style={{ marginRight: 4 }} />
                        <ThemedText type="body" style={[styles.historyValue, { color: run.heartRateZone ? getZoneColor(run.heartRateZone) : Colors.light.primary }]}>
                          {run.avgHeartRate}
                        </ThemedText>
                      </View>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>bpm</ThemedText>
                    </View>
                  ) : null}
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyHistoryCard}>
              <Feather name="map-pin" size={32} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
                No runs yet. Start your first run!
              </ThemedText>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  permissionTitle: {
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  permissionText: {
    textAlign: "center",
    opacity: 0.7,
  },
  permissionButton: {
    marginTop: Spacing.md,
    minWidth: 200,
  },
  mapContainer: {
    height: MAP_HEIGHT,
    backgroundColor: "#1a1a2e",
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  mapPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  mapPlaceholderText: {
    opacity: 0.6,
  },
  mapOverlay: {
    position: "absolute",
    top: Spacing.md,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  muteButton: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  dateText: {
    color: "#fff",
    opacity: 0.8,
  },
  statsContainer: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  mainStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  mainStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  statDivider: {
    width: 1,
    height: 50,
  },
  statLabel: {
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  secondaryStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  secondaryStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  splitsContainer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  splitsLabel: {
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  splitsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  splitItem: {
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  splitMile: {
    color: Colors.light.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  splitTime: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  controlsContainer: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  startControls: {
    width: "100%",
    alignItems: "center",
    gap: Spacing.md,
  },
  goalButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  goalButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  startButton: {
    width: "100%",
    maxWidth: 300,
  },
  startButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  startButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  goalBadge: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.md,
    backgroundColor: Colors.light.primary + "E6",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  goalBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  progressContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.light.primary,
    borderRadius: 4,
  },
  progressText: {
    textAlign: "center",
    marginTop: Spacing.xs,
    fontSize: 12,
  },
  activeControls: {
    flexDirection: "row",
    gap: Spacing.xl,
  },
  controlButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },
  resumeButton: {
    backgroundColor: Colors.light.primary,
    paddingLeft: 4,
  },
  pauseButton: {
    backgroundColor: "#F59E0B",
  },
  stopButton: {
    backgroundColor: "#EF4444",
  },
  historySection: {
    padding: Spacing.lg,
  },
  historyCard: {
    marginBottom: Spacing.sm,
  },
  emptyHistoryCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  historyStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  historyStat: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  historyValue: {
    fontWeight: "600",
  },
});
