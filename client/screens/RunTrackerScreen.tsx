import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Platform,
  ScrollView,
  Modal,
  TextInput,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { MapDisplay } from "@/components/MapDisplay";
import { RunCompleteAnimation } from "@/components/RunCompleteAnimation";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { RunEntry, HeartRateZone, UnitSystem } from "@/types";
import * as storage from "@/lib/storage";
import { formatDistanceValue, formatDistanceUnit, formatSpeedValue, formatSpeedUnit, formatPace, formatPaceUnit } from "@/lib/units";
import { RunStackParamList, RunGoal } from "@/navigation/RunStackNavigator";
import { getHeartRateZones, getZoneForHeartRate, getZoneColor, getZoneName } from "@/lib/heartRateZones";

type NavigationProp = NativeStackNavigationProp<RunStackParamList>;
type RunTrackerRouteProp = RouteProp<RunStackParamList, "RunTracker">;

const MAP_HEIGHT = 220;
const ACCENT_COLOR = "#FF4500";

export default function RunTrackerScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
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
  const [showHRInput, setShowHRInput] = useState(false);
  const [avgHRInput, setAvgHRInput] = useState("");
  const [maxHRInput, setMaxHRInput] = useState("");
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [userAge, setUserAge] = useState<number>(30);
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
    if (profile?.age) {
      setUserAge(profile.age);
    }
    if (profile?.unitSystem) {
      setUnitSystem(profile.unitSystem);
    }
  };
  
  // Reload run history when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      loadRunHistory();
    }, [])
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
    
    if (finalDuration > 0 && finalDistance > 0) {
      const pace = finalDuration / 60 / finalDistance;
      const distanceMiles = finalDistance * 0.621371;  // always in miles for calorie estimation
      const runCalories = Math.round(distanceMiles * 100);
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
      setPendingRunId(runId);
      loadRunHistory();
    }
    
    setCompletedRunData({
      distance: formatDistanceValue(finalDistance, unitSystem),
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
        ? formatDistanceValue(distance, unitSystem) >= goal.value
        : duration / 60 >= goal.value
    ) : false;
    completeRun(goalReached);
  };
  
  const handleAnimationDismiss = async () => {
    setShowCompleteAnimation(false);
    setCompletedRunData(null);
    if (pendingRunId) {
      setShowHRInput(true);
    } else {
      resetRunState();
    }
  };
  
  const resetRunState = async () => {
    setDuration(0);
    setDistance(0);
    setRoute([]);
    setSplits([]);
    goalReachedRef.current = false;
    setPendingRunId(null);
    setAvgHRInput("");
    setMaxHRInput("");
    await loadRunHistory();
  };
  
  const handleSaveHeartRate = async () => {
    if (pendingRunId) {
      const avgHR = parseInt(avgHRInput) || undefined;
      const maxHR = parseInt(maxHRInput) || undefined;
      
      if (avgHR || maxHR) {
        const runs = await storage.getRunHistory();
        const updatedRuns = runs.map(run => {
          if (run.id === pendingRunId) {
            let hrZone: HeartRateZone | undefined;
            if (avgHR) {
              const zoneInfo = getZoneForHeartRate(avgHR, userAge);
              hrZone = zoneInfo?.zone;
            }
            return {
              ...run,
              avgHeartRate: avgHR,
              maxHeartRate: maxHR,
              heartRateZone: hrZone,
            };
          }
          return run;
        });
        await storage.saveRunHistory(updatedRuns);
      }
    }
    setShowHRInput(false);
    resetRunState();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  
  const handleSkipHeartRate = () => {
    setShowHRInput(false);
    resetRunState();
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
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top, paddingBottom: tabBarHeight }]}>
        <View style={styles.centered}>
          <ThemedText type="body">Checking location access...</ThemedText>
        </View>
      </View>
    );
  }
  
  if (permission !== "granted" && Platform.OS !== "web") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top, paddingBottom: tabBarHeight }]}>
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
      ? (displayDistance / goal.value) * 100
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
      
      <Modal
        visible={showHRInput}
        transparent={true}
        animationType="slide"
        onRequestClose={handleSkipHeartRate}
      >
        <View style={styles.hrModalOverlay}>
          <View style={[styles.hrModalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.hrModalHeader}>
              <Feather name="heart" size={32} color={Colors.light.primary} />
              <ThemedText type="h3" style={styles.hrModalTitle}>Add Heart Rate</ThemedText>
              <ThemedText type="small" style={{ opacity: 0.6, textAlign: "center" }}>
                Optional: Enter your heart rate data from a watch or monitor
              </ThemedText>
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
            
            {avgHRInput ? (
              <View style={styles.zonePreview}>
                {(() => {
                  const zoneInfo = getZoneForHeartRate(parseInt(avgHRInput) || 0, userAge);
                  if (zoneInfo) {
                    return (
                      <View style={[styles.zoneBadge, { backgroundColor: zoneInfo.color + "20" }]}>
                        <View style={[styles.zoneDot, { backgroundColor: zoneInfo.color }]} />
                        <ThemedText type="body" style={{ color: zoneInfo.color }}>
                          {zoneInfo.name} Zone
                        </ThemedText>
                      </View>
                    );
                  }
                  return null;
                })()}
              </View>
            ) : null}
            
            <View style={styles.hrModalButtons}>
              <AnimatedPress
                onPress={handleSkipHeartRate}
                style={[styles.hrModalButton, { borderColor: theme.border, borderWidth: 1 }]}
              >
                <ThemedText type="body">Skip</ThemedText>
              </AnimatedPress>
              <AnimatedPress
                onPress={handleSaveHeartRate}
                style={[styles.hrModalButton, { backgroundColor: Colors.light.primary }]}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF" }}>Save</ThemedText>
              </AnimatedPress>
            </View>
          </View>
        </View>
      </Modal>
      
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: tabBarHeight + Spacing["3xl"],
        }}
        scrollIndicatorInsets={{ bottom: tabBarHeight }}
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
              <ThemedText style={[styles.bigStatValue, { color: theme.text }]}>{displayDistance.toFixed(2)}</ThemedText>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.mainStat}>
              <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>Min : Sec</ThemedText>
              <ThemedText style={[styles.bigStatValue, { color: theme.text }]}>{formatDuration(duration)}</ThemedText>
            </View>
          </View>
          
          <View style={[styles.secondaryStatsRow, { borderTopColor: theme.border }]}>
            <View style={styles.secondaryStat}>
              <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>Speed ({speedUnit})</ThemedText>
              <ThemedText style={[styles.mediumStatValue, { color: theme.text }]}>{speed.toFixed(2)}</ThemedText>
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
                <Feather name="target" size={20} color={ACCENT_COLOR} />
                <ThemedText style={[styles.goalButtonText, { color: theme.text }]}>Set Goal</ThemedText>
              </AnimatedPress>
              <AnimatedPress onPress={startRun} style={styles.startButton}>
                <Feather name="play" size={32} color="#FFFFFF" />
                <ThemedText style={styles.startButtonText}>
                  {goal ? `START ${goal.type === "distance" ? `${goal.value} ${distanceUnit.toUpperCase()}` : `${goal.value} MIN`} RUN` : "FREE RUN"}
                </ThemedText>
              </AnimatedPress>
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
          <ThemedText style={[styles.historyTitle, { color: theme.text }]}>Run History</ThemedText>
          {runHistory.length > 0 ? (
            runHistory.slice(0, 5).map((run) => (
              <Pressable
                key={run.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  navigation.navigate("RunDetail" as any, { run });
                }}
                style={[styles.historyCard, { backgroundColor: theme.backgroundSecondary }]}
              >
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
                      {formatDistanceValue(run.distanceKm, unitSystem).toFixed(2)}
                    </ThemedText>
                    <ThemedText style={[styles.historyLabel, { color: theme.textSecondary }]}>{distanceUnit}</ThemedText>
                  </View>
                  <View style={styles.historyStat}>
                    <ThemedText style={styles.historyValue}>
                      {formatDuration(run.durationSeconds)}
                    </ThemedText>
                    <ThemedText style={[styles.historyLabel, { color: theme.textSecondary }]}>time</ThemedText>
                  </View>
                  <View style={styles.historyStat}>
                    <ThemedText style={styles.historyValue}>
                      {run.calories || Math.round(run.distanceKm * 60)}
                    </ThemedText>
                    <ThemedText style={[styles.historyLabel, { color: theme.textSecondary }]}>kcal</ThemedText>
                  </View>
                  {run.avgHeartRate ? (
                    <View style={styles.historyStat}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Feather name="heart" size={12} color={run.heartRateZone ? getZoneColor(run.heartRateZone) : Colors.light.primary} style={{ marginRight: 4 }} />
                        <ThemedText style={[styles.historyValue, { color: run.heartRateZone ? getZoneColor(run.heartRateZone) : theme.text }]}>
                          {run.avgHeartRate}
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.historyLabel, { color: theme.textSecondary }]}>bpm</ThemedText>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ))
          ) : (
            <View style={[styles.emptyHistoryCard, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="map-pin" size={32} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyHistoryText, { color: theme.textSecondary }]}>
                No runs yet. Start your first run!
              </ThemedText>
            </View>
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
  emptyHistoryCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  emptyHistoryText: {
    textAlign: "center",
    fontSize: 14,
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
  hrModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  hrModalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing["4xl"],
  },
  hrModalHeader: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  hrModalTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  hrInputRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  hrInputGroup: {
    flex: 1,
  },
  hrInput: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  zonePreview: {
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  zoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  zoneDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  hrModalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  hrModalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
