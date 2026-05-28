import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { RunEntry, UnitSystem } from "@/types";
import * as storage from "@/lib/storage";
import { formatDistanceValue, formatDistanceUnit } from "@/lib/units";
import { getZoneColor } from "@/lib/heartRateZones";
import { RunStackParamList } from "@/navigation/RunStackNavigator";

type NavigationProp = NativeStackNavigationProp<RunStackParamList>;

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function RunHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();

  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [history, profile] = await Promise.all([
      storage.getRunHistory(),
      storage.getUserProfile(),
    ]);
    if (profile?.unitSystem) setUnitSystem(profile.unitSystem);
    setRuns(history);
    setLoading(false);
  };

  // Reload on focus so a delete from RunDetail is reflected immediately.
  useFocusEffect(useCallback(() => { load(); }, []));

  const distanceUnit = formatDistanceUnit(unitSystem);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight + Spacing.lg }]}>
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="card" />
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
      }}
      data={runs}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      renderItem={({ item: run }) => (
        <Card
          onPress={() => navigation.navigate("RunDetail", { run })}
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
                  <Feather
                    name="heart"
                    size={12}
                    color={run.heartRateZone ? getZoneColor(run.heartRateZone) : Colors.light.primary}
                    style={{ marginRight: 4 }}
                  />
                  <ThemedText
                    type="body"
                    style={[
                      styles.historyValue,
                      { color: run.heartRateZone ? getZoneColor(run.heartRateZone) : Colors.light.primary },
                    ]}
                  >
                    {run.avgHeartRate}
                  </ThemedText>
                </View>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>bpm</ThemedText>
              </View>
            ) : null}
          </View>
        </Card>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Feather name="map-pin" size={48} color={theme.textSecondary} style={{ opacity: 0.4, marginBottom: Spacing.lg }} />
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            No runs yet.
          </ThemedText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  historyCard: {
    padding: Spacing.lg,
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
  empty: {
    alignItems: "center",
    paddingTop: Spacing["5xl"],
    paddingHorizontal: Spacing["3xl"],
  },
});
