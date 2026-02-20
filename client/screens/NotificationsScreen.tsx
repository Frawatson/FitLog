import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { AnimatedPress } from "@/components/AnimatedPress";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Notification } from "@/types";
import { getNotificationsApi, markNotificationsReadApi } from "@/lib/socialStorage";
import { timeAgo } from "@/lib/timeAgo";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ICON_MAP: Record<string, { icon: keyof typeof Feather.glyphMap; color: string }> = {
  like: { icon: "heart", color: Colors.light.error },
  comment: { icon: "message-circle", color: Colors.light.primary },
  follow: { icon: "user-plus", color: "#22C55E" },
};

export default function NotificationsScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const result = await getNotificationsApi();
      setNotifications(result.notifications);
    } catch (e) {
      console.log("Failed to load notifications:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    loadData();
    markNotificationsReadApi().catch(() => {});
  }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    markNotificationsReadApi().catch(() => {});
    setRefreshing(false);
  };

  const handlePress = (notification: Notification) => {
    if (notification.type === "follow") {
      navigation.navigate("SocialProfile", { userId: notification.actorId });
    } else if (notification.referenceId) {
      navigation.navigate("PostDetail", { postId: notification.referenceId });
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <SkeletonLoader variant="list" lines={5} height={60} />
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
      }}
      data={notifications}
      keyExtractor={(item) => item.id.toString()}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textSecondary} />}
      renderItem={({ item }) => {
        const config = ICON_MAP[item.type] || ICON_MAP.like;
        return (
          <AnimatedPress
            onPress={() => handlePress(item)}
            style={[
              styles.row,
              {
                backgroundColor: item.isRead ? theme.backgroundCard : Colors.light.primary + "08",
                borderColor: item.isRead ? theme.cardBorder : Colors.light.primary + "20",
              },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: config.color + "15" }]}>
              <Feather name={config.icon} size={18} color={config.color} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="body">{item.message}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {timeAgo(item.createdAt)}
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={16} color={theme.textSecondary} />
          </AnimatedPress>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Feather name="bell-off" size={48} color={theme.textSecondary} style={{ opacity: 0.3, marginBottom: Spacing.lg }} />
          <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>No notifications</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            When someone likes, comments, or follows you, it will show up here.
          </ThemedText>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    paddingTop: Spacing["5xl"],
    paddingHorizontal: Spacing["3xl"],
  },
});
