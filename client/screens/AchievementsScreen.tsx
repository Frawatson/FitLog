import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import * as storage from "@/lib/storage";
import { checkAchievements, type Achievement } from "@/lib/achievements";

export default function AchievementsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const loadData = async () => {
    if (!hasLoadedRef.current) setIsLoading(true);

    const [workouts, runs, bodyWeights, allFoodLog] = await Promise.all([
      storage.getWorkouts(),
      storage.getRunHistory(),
      storage.getBodyWeights(),
      storage.getFoodLog(),
    ]);

    const foodDays = new Set(allFoodLog.map((f) => f.date)).size;

    const results = checkAchievements({
      workouts,
      runs,
      bodyWeights,
      foodLogDays: foodDays,
    });

    setAchievements(results);
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing["3xl"],
        paddingHorizontal: Spacing.lg,
      }}
    >
      {/* Summary */}
      <View style={styles.summary}>
        <ThemedText type="h2" style={{ color: "#FFB300" }}>
          {unlocked.length}
        </ThemedText>
        <ThemedText type="small" style={{ opacity: 0.6 }}>
          of {achievements.length} achievements unlocked
        </ThemedText>
      </View>

      {isLoading ? (
        <View style={{ gap: Spacing.md }}>
          <SkeletonLoader variant="list" lines={5} />
        </View>
      ) : (
        <>
          {unlocked.length > 0 ? (
            <>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Unlocked
              </ThemedText>
              <View style={styles.grid}>
                {unlocked.map((a) => (
                  <AchievementCard key={a.id} achievement={a} theme={theme} />
                ))}
              </View>
            </>
          ) : null}

          {locked.length > 0 ? (
            <>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Locked
              </ThemedText>
              <View style={styles.grid}>
                {locked.map((a) => (
                  <AchievementCard key={a.id} achievement={a} theme={theme} />
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function AchievementCard({ achievement, theme }: { achievement: Achievement; theme: any }) {
  const progress = Math.min(achievement.progress / achievement.threshold, 1);

  return (
    <Card
      style={{
        ...styles.achievementCard,
        opacity: achievement.unlocked ? 1 : 0.5,
      }}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: achievement.unlocked
              ? "#FFB30020"
              : theme.backgroundSecondary,
          },
        ]}
      >
        <Feather
          name={achievement.icon as any}
          size={24}
          color={achievement.unlocked ? "#FFB300" : theme.textSecondary}
        />
      </View>
      <ThemedText type="body" style={{ fontWeight: "600", textAlign: "center" }}>
        {achievement.title}
      </ThemedText>
      <ThemedText
        type="caption"
        style={{ opacity: 0.6, textAlign: "center", marginTop: 2 }}
      >
        {achievement.description}
      </ThemedText>
      {!achievement.unlocked ? (
        <View style={styles.progressContainer}>
          <View
            style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: Colors.light.primary,
                },
              ]}
            />
          </View>
          <ThemedText type="caption" style={{ opacity: 0.5, marginTop: 2 }}>
            {achievement.progress} / {achievement.threshold}
          </ThemedText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summary: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  achievementCard: {
    width: "47%",
    alignItems: "center",
    padding: Spacing.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  progressContainer: {
    width: "100%",
    marginTop: Spacing.sm,
    alignItems: "center",
  },
  progressBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
});
