import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { AnimatedPress } from "@/components/AnimatedPress";
import { MapDisplay } from "@/components/MapDisplay";
import { showSystemMenu } from "@/components/SystemMenu";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { RunEntry, UnitSystem } from "@/types";
import * as storage from "@/lib/storage";
import {
  formatDistanceValue,
  formatDistanceUnit,
  formatPace,
  formatPaceUnit,
  simplifyRoute,
} from "@/lib/units";
import { getZoneColor, getZoneName } from "@/lib/heartRateZones";
import { stashTransient } from "@/lib/transientParams";
import { RunStackParamList } from "@/navigation/RunStackNavigator";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RunStackParamList>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;
type RouteType = RouteProp<RunStackParamList, "RunDetail">;

export default function RunDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteType>();
  const { theme } = useTheme();

  // Loaded by id — the whole RunEntry used to ride in route params,
  // which serialized to "[object Object]" in the web URL and crashed
  // this screen on refresh or shared link.
  const runId = route.params?.runId;
  const [run, setRun] = useState<RunEntry | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");

  useEffect(() => {
    const load = async () => {
      const profile = await storage.getUserProfile();
      if (profile?.unitSystem) setUnitSystem(profile.unitSystem);
      if (!runId) {
        setNotFound(true);
        return;
      }
      const runs = await storage.getRunHistory();
      const found = runs.find((r) => r.id === runId);
      if (found) {
        setRun(found);
      } else {
        setNotFound(true);
      }
    };
    load();
  }, [runId]);

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (notFound) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            alignItems: "center",
            justifyContent: "center",
            padding: Spacing.xl,
          },
        ]}
      >
        <Feather name="alert-circle" size={40} color={theme.textSecondary} />
        <ThemedText type="h4" style={{ marginTop: Spacing.md }}>
          Run not found
        </ThemedText>
        <ThemedText
          type="small"
          style={{
            color: theme.textSecondary,
            textAlign: "center",
            marginTop: Spacing.xs,
          }}
        >
          This run may have been deleted or hasn&apos;t synced to this device
          yet.
        </ThemedText>
      </View>
    );
  }

  if (!run) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Loading run...
        </ThemedText>
      </View>
    );
  }

  const handleDelete = () => {
    const doDelete = async () => {
      await storage.deleteRunEntry(run.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    };
    showSystemMenu({
      title: "Delete Run",
      message:
        "Are you sure you want to delete this run? This action cannot be undone.",
      options: [
        { label: "Delete", destructive: true, onPress: doDelete },
        { label: "Cancel", cancel: true },
      ],
    });
  };

  const handleShare = () => {
    const rootNav = navigation.getParent<RootNav>();
    if (rootNav) {
      // Prefill goes through the transient store — referenceData is an
      // object and would corrupt the web URL as a route param.
      stashTransient("createPostPrefill", {
        postType: "run",
        referenceId: run.id,
        referenceData: {
          distanceKm: run.distanceKm,
          durationMinutes: Math.round(run.durationSeconds / 60),
          paceMinPerKm: run.paceMinPerKm,
          pace: formatPace(run.paceMinPerKm, unitSystem),
          calories: run.calories,
          route: run.route ? simplifyRoute(run.route) : undefined,
        },
      });
      rootNav.navigate("CreatePost");
    }
  };

  const distanceDisplay = formatDistanceValue(
    run.distanceKm,
    unitSystem,
  ).toFixed(2);
  const distUnit = formatDistanceUnit(unitSystem);
  const paceDisplay = formatPace(run.paceMinPerKm, unitSystem);
  const paceUnit = formatPaceUnit(unitSystem);
  const calories = run.calories || Math.round(run.distanceKm * 0.621371 * 100);

  const runDate = new Date(run.completedAt);
  const dateStr = runDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = runDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: insets.bottom + Spacing["3xl"],
      }}
    >
      {/* Map */}
      {run.route && run.route.length > 0 ? (
        <View style={styles.mapContainer}>
          <MapDisplay
            currentLocation={run.route[run.route.length - 1]}
            route={run.route}
          />
        </View>
      ) : (
        <View
          style={[
            styles.noMapContainer,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Feather name="map" size={32} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            No route data available
          </ThemedText>
        </View>
      )}

      {/* Date & Time */}
      <View style={styles.dateSection}>
        <ThemedText type="h4">{dateStr}</ThemedText>
        <ThemedText type="small" style={{ opacity: 0.6 }}>
          {timeStr}
        </ThemedText>
      </View>

      {/* Main Stats */}
      <Card style={styles.statsCard}>
        <View style={styles.mainStatsRow}>
          <View style={styles.mainStat}>
            <ThemedText
              style={[styles.bigValue, { color: Colors.light.primary }]}
            >
              {distanceDisplay}
            </ThemedText>
            <ThemedText type="small" style={{ opacity: 0.6 }}>
              {distUnit}
            </ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.mainStat}>
            <ThemedText style={[styles.bigValue, { color: theme.text }]}>
              {formatDuration(run.durationSeconds)}
            </ThemedText>
            <ThemedText type="small" style={{ opacity: 0.6 }}>
              duration
            </ThemedText>
          </View>
        </View>

        <View
          style={[styles.secondaryStatsRow, { borderTopColor: theme.border }]}
        >
          <View style={styles.secondaryStat}>
            <ThemedText style={[styles.mediumValue, { color: theme.text }]}>
              {paceDisplay}
            </ThemedText>
            <ThemedText type="small" style={{ opacity: 0.6 }}>
              pace {paceUnit}
            </ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.secondaryStat}>
            <ThemedText style={[styles.mediumValue, { color: theme.text }]}>
              {calories}
            </ThemedText>
            <ThemedText type="small" style={{ opacity: 0.6 }}>
              calories
            </ThemedText>
          </View>
        </View>
      </Card>

      {/* Splits */}
      {run.splits && run.splits.length > 0 ? (
        <Card style={styles.hrCard}>
          <View style={styles.hrHeader}>
            <Feather name="flag" size={20} color={Colors.light.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Splits
            </ThemedText>
          </View>
          {run.splits.map((time, i) => (
            <View key={i} style={styles.splitRow}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                {i + 1} {run.splitsUnit || "mi"}
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {formatDuration(time)}
              </ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Heart Rate */}
      {run.avgHeartRate ? (
        <Card style={styles.hrCard}>
          <View style={styles.hrHeader}>
            <Feather
              name="heart"
              size={20}
              color={
                run.heartRateZone
                  ? getZoneColor(run.heartRateZone)
                  : Colors.light.primary
              }
            />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              Heart Rate
            </ThemedText>
          </View>
          <View style={styles.hrStatsRow}>
            <View style={styles.hrStat}>
              <ThemedText
                style={[
                  styles.hrValue,
                  {
                    color: run.heartRateZone
                      ? getZoneColor(run.heartRateZone)
                      : theme.text,
                  },
                ]}
              >
                {run.avgHeartRate}
              </ThemedText>
              <ThemedText type="small" style={{ opacity: 0.6 }}>
                avg bpm
              </ThemedText>
            </View>
            {run.maxHeartRate ? (
              <View style={styles.hrStat}>
                <ThemedText style={[styles.hrValue, { color: theme.text }]}>
                  {run.maxHeartRate}
                </ThemedText>
                <ThemedText type="small" style={{ opacity: 0.6 }}>
                  max bpm
                </ThemedText>
              </View>
            ) : null}
            {run.heartRateZone ? (
              <View
                style={[
                  styles.zoneBadge,
                  { backgroundColor: getZoneColor(run.heartRateZone) + "20" },
                ]}
              >
                <View
                  style={[
                    styles.zoneDot,
                    { backgroundColor: getZoneColor(run.heartRateZone) },
                  ]}
                />
                <ThemedText
                  type="body"
                  style={{
                    color: getZoneColor(run.heartRateZone),
                    fontWeight: "600",
                  }}
                >
                  {getZoneName(run.heartRateZone)}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      {/* Share to Community */}
      <AnimatedPress
        onPress={handleShare}
        style={[
          styles.deleteButton,
          { backgroundColor: Colors.light.primary + "10" },
        ]}
      >
        <Feather name="users" size={18} color={Colors.light.primary} />
        <ThemedText
          type="body"
          style={{ color: Colors.light.primary, marginLeft: Spacing.sm }}
        >
          Share to Community
        </ThemedText>
      </AnimatedPress>

      {/* Delete */}
      <AnimatedPress
        onPress={handleDelete}
        style={[
          styles.deleteButton,
          { backgroundColor: theme.backgroundDefault },
        ]}
      >
        <Feather name="trash-2" size={18} color={Colors.light.error} />
        <ThemedText
          type="body"
          style={{ color: Colors.light.error, marginLeft: Spacing.sm }}
        >
          Delete Run
        </ThemedText>
      </AnimatedPress>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    height: 220,
    backgroundColor: "#1a1a2e",
  },
  noMapContainer: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  dateSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  statsCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
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
  bigValue: {
    fontSize: 36,
    fontWeight: "700",
    lineHeight: 44,
  },
  divider: {
    width: 1,
    height: 50,
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
  },
  mediumValue: {
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 32,
  },
  hrCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  hrHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  hrStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
  },
  hrStat: {
    alignItems: "center",
  },
  hrValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  zoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  zoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
});
