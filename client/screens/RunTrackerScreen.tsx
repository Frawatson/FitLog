import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { MapDisplay } from "@/components/MapDisplay";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RunEntry } from "@/types";
import * as storage from "@/lib/storage";

const MAP_HEIGHT = 220;
const ACCENT_COLOR = "#FF4500";

export default function RunTrackerScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  
  const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [route, setRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const [runHistory, setRunHistory] = useState<RunEntry[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [splits, setSplits] = useState<number[]>([]);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocation = useRef<Location.LocationObject | null>(null);
  const startTimeRef = useRef<string>("");
  const mapRef = useRef<MapView>(null);
  const lastSplitDistance = useRef<number>(0);
  
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
  
  const stopRun = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (locationSubscription.current) {
      locationSubscription.current.remove();
    }
    
    if (duration > 0 && distance > 0) {
      const pace = duration / 60 / distance;
      const runEntry: RunEntry = {
        id: uuidv4(),
        distanceKm: distance,
        durationSeconds: duration,
        paceMinPerKm: pace,
        startedAt: startTimeRef.current,
        completedAt: new Date().toISOString(),
        route,
      };
      
      await storage.saveRunEntry(runEntry);
      loadRunHistory();
    }
    
    setIsRunning(false);
    setIsPaused(false);
    setDuration(0);
    setDistance(0);
    setRoute([]);
    setSplits([]);
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
      <View style={[styles.container, styles.darkBg, { paddingTop: headerHeight }]}>
        <View style={styles.centered}>
          <ThemedText type="body" style={styles.lightText}>Checking location access...</ThemedText>
        </View>
      </View>
    );
  }
  
  if (permission !== "granted" && Platform.OS !== "web") {
    return (
      <View style={[styles.container, styles.darkBg, { paddingTop: headerHeight }]}>
        <View style={styles.centered}>
          <Feather name="map-pin" size={48} color={ACCENT_COLOR} />
          <ThemedText type="h3" style={[styles.lightText, styles.permissionTitle]}>
            Track Your Runs
          </ThemedText>
          <ThemedText type="body" style={[styles.lightText, styles.permissionText]}>
            Allow location access to track distance, pace, and route.
          </ThemedText>
          <Button onPress={requestPermission} style={styles.permissionButton}>
            Enable Location
          </Button>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, styles.darkBg]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingBottom: tabBarHeight + Spacing.xl,
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
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.mainStatsRow}>
            <View style={styles.mainStat}>
              <ThemedText type="small" style={styles.statLabel}>Mil</ThemedText>
              <ThemedText style={styles.bigStatValue}>{distanceMiles.toFixed(2)}</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.mainStat}>
              <ThemedText type="small" style={styles.statLabel}>Min : Sec</ThemedText>
              <ThemedText style={styles.bigStatValue}>{formatDuration(duration)}</ThemedText>
            </View>
          </View>
          
          <View style={styles.secondaryStatsRow}>
            <View style={styles.secondaryStat}>
              <ThemedText type="small" style={styles.statLabel}>Current Speed</ThemedText>
              <ThemedText style={styles.mediumStatValue}>{speedMph.toFixed(2)}</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.secondaryStat}>
              <ThemedText type="small" style={styles.statLabel}>Calories</ThemedText>
              <ThemedText style={styles.mediumStatValue}>{calories}</ThemedText>
            </View>
          </View>
          
          {splits.length > 0 ? (
            <View style={styles.splitsContainer}>
              <ThemedText type="small" style={styles.splitsLabel}>Splits:</ThemedText>
              <View style={styles.splitsRow}>
                {splits.map((splitTime, index) => (
                  <View key={index} style={styles.splitItem}>
                    <ThemedText style={styles.splitMile}>{index + 1} Mi</ThemedText>
                    <ThemedText style={styles.splitTime}>{formatDuration(splitTime)}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
        
        <View style={styles.controlsContainer}>
          {!isRunning ? (
            <Pressable onPress={startRun} style={styles.startButton}>
              <Feather name="play" size={32} color="#1A1A1A" />
              <ThemedText style={styles.startButtonText}>START RUN</ThemedText>
            </Pressable>
          ) : (
            <View style={styles.activeControls}>
              {isPaused ? (
                <Pressable onPress={resumeRun} style={[styles.controlButton, styles.resumeButton]}>
                  <Feather name="play" size={28} color="#1A1A1A" />
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
            <ThemedText style={styles.historyTitle}>Run History</ThemedText>
            {runHistory.slice(0, 5).map((run) => (
              <View key={run.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <ThemedText style={styles.historyDate}>
                    {new Date(run.completedAt).toLocaleDateString()}
                  </ThemedText>
                  <ThemedText style={styles.historyTime}>
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
                    <ThemedText style={styles.historyLabel}>mi</ThemedText>
                  </View>
                  <View style={styles.historyStat}>
                    <ThemedText style={styles.historyValue}>
                      {formatDuration(run.durationSeconds)}
                    </ThemedText>
                    <ThemedText style={styles.historyLabel}>time</ThemedText>
                  </View>
                  <View style={styles.historyStat}>
                    <ThemedText style={styles.historyValue}>
                      {formatPace(run.paceMinPerKm)}
                    </ThemedText>
                    <ThemedText style={styles.historyLabel}>/km</ThemedText>
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
  darkBg: {
    backgroundColor: "#1A1A1A",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  lightText: {
    color: "#FFFFFF",
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
    borderBottomColor: "#2D2D2D",
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
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: "#3D3D3D",
  },
  statLabel: {
    color: "#888888",
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  bigStatValue: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  secondaryStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "#2D2D2D",
  },
  secondaryStat: {
    flex: 1,
    alignItems: "center",
  },
  mediumStatValue: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  splitsContainer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "#2D2D2D",
  },
  splitsLabel: {
    color: "#888888",
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
    backgroundColor: "#2D2D2D",
    borderRadius: BorderRadius.md,
  },
  splitMile: {
    color: ACCENT_COLOR,
    fontSize: 12,
    fontWeight: "600",
  },
  splitTime: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  controlsContainer: {
    padding: Spacing.xl,
    alignItems: "center",
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
    color: "#1A1A1A",
    fontSize: 16,
    fontWeight: "700",
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
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  historyCard: {
    backgroundColor: "#2D2D2D",
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
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  historyTime: {
    color: "#888888",
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
    color: "#888888",
    fontSize: 12,
  },
});
