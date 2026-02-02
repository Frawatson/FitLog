import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { MapDisplay } from "@/components/MapDisplay";
import { RunCompleteAnimation } from "@/components/RunCompleteAnimation";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RunEntry } from "@/types";
import * as storage from "@/lib/storage";
import { RunStackParamList, RunGoal } from "@/navigation/RunStackNavigator";

type NavigationProp = NativeStackNavigationProp<RunStackParamList>;
type RunTrackerRouteProp = RouteProp<RunStackParamList, "RunTracker">;

const MAP_HEIGHT = 220;
const ACCENT_COLOR = "#FF4500";

export default function RunTrackerScreen() {
  const insets = useSafeAreaInsets();
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
  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false);
  const [completedRunData, setCompletedRunData] = useState<{ distance: number; duration: number; goalReached: boolean } | null>(null);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocation = useRef<Location.LocationObject | null>(null);
  const startTimeRef = useRef<string>("");
  const mapRef = useRef<any>(null);
  const lastSplitDistance = useRef<number>(0);
  const goalReachedRef = useRef(false);
  
  useEffect(() => {
    checkPermission();
    loadRunHistory();
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
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
    startTimeRef.current = new Date().toISOString();
    
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
            return newDistance;
          });
        }
        
        lastLocation.current = location;
      }
    );
  };
  
  const pauseRun = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPaused(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (locationSubscription.current) {
      locationSubscription.current.remove();
    }
  };
  
  const resumeRun = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    
    const distanceMiles = currentDistance * 0.621371;
    const durationMinutes = currentDuration / 60;
    
    if (goal.type === "distance" && distanceMiles >= goal.value) {
      goalReachedRef.current = true;
      completeRun(true);
    } else if (goal.type === "time" && durationMinutes >= goal.value) {
      goalReachedRef.current = true;
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
      locationSubscription.current.remove();
    }
    
    const finalDistance = distance;
    const finalDuration = duration;
    
    if (finalDuration > 0 && finalDistance > 0) {
      const pace = finalDuration / 60 / finalDistance;
      const runEntry: RunEntry = {
        id: uuidv4(),
        distanceKm: finalDistance,
        durationSeconds: finalDuration,
        paceMinPerKm: pace,
        startedAt: startTimeRef.current,
        completedAt: new Date().toISOString(),
        route,
      };
      
      await storage.saveRunEntry(runEntry);
      loadRunHistory();
    }
    
    setCompletedRunData({
      distance: finalDistance * 0.621371,
      duration: finalDuration,
      goalReached,
    });
    setShowCompleteAnimation(true);
    
    setIsRunning(false);
    setIsPaused(false);
  };
  
  const stopRun = async () => {
    const goalReached = goal ? (
      goal.type === "distance" 
        ? distance * 0.621371 >= goal.value 
        : duration / 60 >= goal.value
    ) : false;
    completeRun(goalReached);
  };
  
  const handleAnimationDismiss = () => {
    setShowCompleteAnimation(false);
    setCompletedRunData(null);
    setDuration(0);
    setDistance(0);
    setRoute([]);
    setSplits([]);
    goalReachedRef.current = false;
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
  
  const formatPace = (paceMinPerKm: number): string => {
    if (!isFinite(paceMinPerKm) || paceMinPerKm === 0) return "--:--";
    const mins = Math.floor(paceMinPerKm);
    const secs = Math.round((paceMinPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  const distanceMiles = distance * 0.621371;
  const currentPace = duration > 0 && distance > 0 ? duration / 60 / distance : 0;
  const speedMph = duration > 0 && distance > 0 ? (distance * 0.621371) / (duration / 3600) : 0;
  const calories = Math.round(distanceMiles * 100);
  
  if (permission === null && Platform.OS !== "web") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ThemedText type="body">Checking location access...</ThemedText>
        </View>
      </View>
    );
  }
  
  if (permission !== "granted" && Platform.OS !== "web") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Feather name="map-pin" size={48} color={ACCENT_COLOR} />
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
      ? (distanceMiles / goal.value) * 100
      : ((duration / 60) / goal.value) * 100
  ) : 0;
  
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <RunCompleteAnimation
        visible={showCompleteAnimation}
        distanceMiles={completedRunData?.distance ?? 0}
        durationSeconds={completedRunData?.duration ?? 0}
        goalReached={completedRunData?.goalReached ?? false}
        onDismiss={handleAnimationDismiss}
      />
      
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + Spacing.xl + 80,
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
          {goal && isRunning ? (
            <View style={styles.goalBadge}>
              <ThemedText style={styles.goalBadgeText}>
                {goal.type === "distance" ? `${goal.value} mi goal` : `${goal.value} min goal`}
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
              <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>Mil</ThemedText>
              <ThemedText style={[styles.bigStatValue, { color: theme.text }]}>{distanceMiles.toFixed(2)}</ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.mainStat}>
              <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>Min : Sec</ThemedText>
              <ThemedText style={[styles.bigStatValue, { color: theme.text }]}>{formatDuration(duration)}</ThemedText>
            </View>
          </View>
          
          <View style={[styles.secondaryStatsRow, { borderTopColor: theme.border }]}>
            <View style={styles.secondaryStat}>
              <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>Current Speed</ThemedText>
              <ThemedText style={[styles.mediumStatValue, { color: theme.text }]}>{speedMph.toFixed(2)}</ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.secondaryStat}>
              <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>Calories</ThemedText>
              <ThemedText style={[styles.mediumStatValue, { color: theme.text }]}>{calories}</ThemedText>
            </View>
          </View>
          
          {splits.length > 0 ? (
            <View style={[styles.splitsContainer, { borderTopColor: theme.border }]}>
              <ThemedText type="small" style={[styles.splitsLabel, { color: theme.textSecondary }]}>Splits:</ThemedText>
              <View style={styles.splitsRow}>
                {splits.map((splitTime, index) => (
                  <View key={index} style={[styles.splitItem, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText style={styles.splitMile}>{index + 1} Mi</ThemedText>
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
              <Pressable onPress={() => navigation.navigate("RunGoal")} style={[styles.goalButton, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="target" size={20} color={ACCENT_COLOR} />
                <ThemedText style={[styles.goalButtonText, { color: theme.text }]}>Set Goal</ThemedText>
              </Pressable>
              <Pressable onPress={startRun} style={styles.startButton}>
                <Feather name="play" size={32} color="#FFFFFF" />
                <ThemedText style={styles.startButtonText}>
                  {goal ? `START ${goal.type === "distance" ? `${goal.value} MI` : `${goal.value} MIN`} RUN` : "FREE RUN"}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.activeControls}>
              {isPaused ? (
                <Pressable onPress={resumeRun} style={[styles.controlButton, styles.resumeButton]}>
                  <Feather name="play" size={28} color="#FFFFFF" />
                </Pressable>
              ) : (
                <Pressable onPress={pauseRun} style={[styles.controlButton, styles.pauseButton]}>
                  <Feather name="pause" size={28} color="#FFFFFF" />
                </Pressable>
              )}
              <Pressable onPress={stopRun} style={[styles.controlButton, styles.stopButton]}>
                <Feather name="square" size={28} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
        </View>
        
        {runHistory.length > 0 ? (
          <View style={styles.historySection}>
            <ThemedText style={[styles.historyTitle, { color: theme.text }]}>Run History</ThemedText>
            {runHistory.slice(0, 5).map((run) => (
              <View key={run.id} style={[styles.historyCard, { backgroundColor: theme.backgroundSecondary }]}>
                <View style={styles.historyHeader}>
                  <ThemedText style={[styles.historyDate, { color: theme.text }]}>
                    {new Date(run.completedAt).toLocaleDateString()}
                  </ThemedText>
                  <ThemedText style={[styles.historyTime, { color: theme.textSecondary }]}>
                    {new Date(run.completedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </ThemedText>
                </View>
                <View style={styles.historyStats}>
                  <View style={styles.historyStat}>
                    <ThemedText style={styles.historyValue}>
                      {(run.distanceKm * 0.621371).toFixed(2)}
                    </ThemedText>
                    <ThemedText style={[styles.historyLabel, { color: theme.textSecondary }]}>mi</ThemedText>
                  </View>
                  <View style={styles.historyStat}>
                    <ThemedText style={styles.historyValue}>
                      {formatDuration(run.durationSeconds)}
                    </ThemedText>
                    <ThemedText style={[styles.historyLabel, { color: theme.textSecondary }]}>time</ThemedText>
                  </View>
                  <View style={styles.historyStat}>
                    <ThemedText style={styles.historyValue}>
                      {formatPace(run.paceMinPerKm)}
                    </ThemedText>
                    <ThemedText style={[styles.historyLabel, { color: theme.textSecondary }]}>km</ThemedText>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}
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
  webMessage: {
    marginTop: Spacing.md,
    color: "#888",
  },
  mapContainer: {
    height: MAP_HEIGHT,
    backgroundColor: "#0D1117",
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
    color: "#4A5568",
  },
  mapOverlay: {
    position: "absolute",
    top: Spacing.md,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  dateText: {
    color: "#FFFFFF",
    opacity: 0.8,
    fontSize: 12,
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
  bigStatValue: {
    fontSize: 42,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    lineHeight: 52,
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
  mediumStatValue: {
    fontSize: 28,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    lineHeight: 36,
  },
  splitsContainer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  splitsLabel: {
    fontSize: 11,
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
    color: ACCENT_COLOR,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT_COLOR,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.full,
    gap: Spacing.md,
    width: "100%",
    maxWidth: 300,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  goalBadge: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.md,
    backgroundColor: "rgba(255, 69, 0, 0.9)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  goalBadgeText: {
    color: "#FFFFFF",
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
    backgroundColor: ACCENT_COLOR,
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
    backgroundColor: ACCENT_COLOR,
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
  historyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  historyCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: "600",
  },
  historyTime: {
    fontSize: 12,
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
    color: ACCENT_COLOR,
    fontSize: 18,
    fontWeight: "600",
  },
  historyLabel: {
    fontSize: 12,
  },
});
