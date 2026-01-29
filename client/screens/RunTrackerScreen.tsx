import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Linking,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { RunEntry } from "@/types";
import * as storage from "@/lib/storage";

export default function RunTrackerScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  
  const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [route, setRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const [runHistory, setRunHistory] = useState<RunEntry[]>([]);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocation = useRef<Location.LocationObject | null>(null);
  const startTimeRef = useRef<string>("");
  
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
  };
  
  const requestPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermission(status);
  };
  
  const loadRunHistory = async () => {
    const runs = await storage.getRunHistory();
    setRunHistory(runs);
  };
  
  const startRun = async () => {
    if (permission !== "granted") {
      Alert.alert(
        "Location Required",
        "Please enable location access to track your run.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Enable", onPress: requestPermission },
        ]
      );
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRunning(true);
    setIsPaused(false);
    setDuration(0);
    setDistance(0);
    setRoute([]);
    lastLocation.current = null;
    startTimeRef.current = new Date().toISOString();
    
    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
    
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 5,
      },
      (location) => {
        const { latitude, longitude } = location.coords;
        
        setRoute((prev) => [...prev, { latitude, longitude }]);
        
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
        timeInterval: 3000,
        distanceInterval: 5,
      },
      (location) => {
        const { latitude, longitude } = location.coords;
        
        setRoute((prev) => [...prev, { latitude, longitude }]);
        
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
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  const formatPace = (paceMinPerKm: number): string => {
    if (!isFinite(paceMinPerKm) || paceMinPerKm === 0) return "--:--";
    const mins = Math.floor(paceMinPerKm);
    const secs = Math.round((paceMinPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  if (permission === null) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
        <View style={styles.centered}>
          <ThemedText type="body">Checking location access...</ThemedText>
        </View>
      </ThemedView>
    );
  }
  
  if (permission === "denied") {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
        <View style={styles.centered}>
          <Feather name="map-pin" size={48} color={theme.textSecondary} />
          <ThemedText type="h3" style={styles.permissionTitle}>
            Location Access Required
          </ThemedText>
          <ThemedText type="body" style={styles.permissionText}>
            Enable location access to track your runs with GPS.
          </ThemedText>
          {Platform.OS !== "web" ? (
            <Button
              onPress={async () => {
                try {
                  await Linking.openSettings();
                } catch (error) {
                  console.error("Cannot open settings");
                }
              }}
              style={styles.permissionButton}
            >
              Open Settings
            </Button>
          ) : (
            <ThemedText type="small" style={styles.webMessage}>
              Run in Expo Go to use GPS tracking
            </ThemedText>
          )}
        </View>
      </ThemedView>
    );
  }
  
  if (permission !== "granted") {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
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
      </ThemedView>
    );
  }
  
  const currentPace = duration > 0 && distance > 0 ? duration / 60 / distance : 0;
  
  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      ListHeaderComponent={
        <View>
          <Card style={styles.trackerCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <ThemedText type="small" style={styles.statLabel}>
                  DISTANCE
                </ThemedText>
                <ThemedText type="h1" style={styles.statValue}>
                  {distance.toFixed(2)}
                </ThemedText>
                <ThemedText type="small" style={styles.statUnit}>
                  km
                </ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <ThemedText type="small" style={styles.statLabel}>
                  TIME
                </ThemedText>
                <ThemedText type="h1" style={styles.statValue}>
                  {formatDuration(duration)}
                </ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <ThemedText type="small" style={styles.statLabel}>
                  PACE
                </ThemedText>
                <ThemedText type="h1" style={styles.statValue}>
                  {formatPace(currentPace)}
                </ThemedText>
                <ThemedText type="small" style={styles.statUnit}>
                  /km
                </ThemedText>
              </View>
            </View>
            
            <View style={styles.controlsRow}>
              {!isRunning ? (
                <Pressable
                  onPress={startRun}
                  style={[styles.startButton, { backgroundColor: Colors.light.primary }]}
                >
                  <Feather name="play" size={32} color="#FFFFFF" />
                  <ThemedText type="h3" style={styles.buttonLabel}>
                    START RUN
                  </ThemedText>
                </Pressable>
              ) : (
                <View style={styles.activeControls}>
                  {isPaused ? (
                    <Pressable
                      onPress={resumeRun}
                      style={[styles.controlButton, { backgroundColor: Colors.light.primary }]}
                    >
                      <Feather name="play" size={28} color="#FFFFFF" />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={pauseRun}
                      style={[styles.controlButton, { backgroundColor: "#F59E0B" }]}
                    >
                      <Feather name="pause" size={28} color="#FFFFFF" />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={stopRun}
                    style={[styles.controlButton, { backgroundColor: "#EF4444" }]}
                  >
                    <Feather name="square" size={28} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}
            </View>
          </Card>
          
          {runHistory.length > 0 ? (
            <ThemedText type="h3" style={styles.historyTitle}>
              Run History
            </ThemedText>
          ) : null}
        </View>
      }
      data={runHistory}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Card style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {new Date(item.completedAt).toLocaleDateString()}
            </ThemedText>
            <ThemedText type="small" style={styles.historyTime}>
              {new Date(item.completedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </ThemedText>
          </View>
          <View style={styles.historyStats}>
            <View style={styles.historyStat}>
              <ThemedText type="h4">{item.distanceKm.toFixed(2)} km</ThemedText>
              <ThemedText type="small" style={styles.historyLabel}>
                Distance
              </ThemedText>
            </View>
            <View style={styles.historyStat}>
              <ThemedText type="h4">{formatDuration(item.durationSeconds)}</ThemedText>
              <ThemedText type="small" style={styles.historyLabel}>
                Duration
              </ThemedText>
            </View>
            <View style={styles.historyStat}>
              <ThemedText type="h4">{formatPace(item.paceMinPerKm)} /km</ThemedText>
              <ThemedText type="small" style={styles.historyLabel}>
                Pace
              </ThemedText>
            </View>
          </View>
        </Card>
      )}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      ListEmptyComponent={
        !isRunning ? (
          <Card style={styles.emptyCard}>
            <Feather name="activity" size={32} color={theme.textSecondary} />
            <ThemedText type="body" style={styles.emptyText}>
              No runs recorded yet. Start your first run!
            </ThemedText>
          </Card>
        ) : null
      }
    />
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
    opacity: 0.5,
  },
  trackerCard: {
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 60,
    backgroundColor: "rgba(128,128,128,0.2)",
  },
  statLabel: {
    opacity: 0.5,
    marginBottom: Spacing.xs,
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.primary,
  },
  statUnit: {
    opacity: 0.5,
    marginTop: Spacing.xs,
  },
  controlsRow: {
    alignItems: "center",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.full,
    gap: Spacing.md,
    width: "100%",
  },
  buttonLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  activeControls: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  historyTitle: {
    marginBottom: Spacing.md,
  },
  historyCard: {
    padding: Spacing.lg,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  historyTime: {
    opacity: 0.5,
  },
  historyStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  historyStat: {
    alignItems: "center",
  },
  historyLabel: {
    opacity: 0.5,
    marginTop: Spacing.xs,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.md,
  },
  emptyText: {
    textAlign: "center",
    opacity: 0.6,
  },
});
