import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Feather from "@expo/vector-icons/Feather";

import { ThemedText } from "@/components/ThemedText";
import { AnimatedPress } from "@/components/AnimatedPress";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Notification } from "@/types";
import {
  getNotificationsApi,
  markNotificationsReadApi,
} from "@/lib/socialStorage";
import { timeAgo } from "@/lib/timeAgo";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ICON_MAP: Record<
  string,
  { icon: keyof typeof Feather.glyphMap; color: string }
> = {
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
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const inFlightRef = useRef(false);

  const loadData = async () => {
    try {
      const result = await getNotificationsApi();
      setNotifications(result.notifications);
      setPage(0);
      setHasMore(result.notifications.length >= 20);
      setError(false);
    } catch (e) {
      console.log("Failed to load notifications:", e);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // The endpoint has always accepted ?page= but only page 0 ever loaded;
  // anything older than the first 20 notifications was unreachable.
  const loadMore = async () => {
    if (!hasMore || inFlightRef.current) return;
    inFlightRef.current = true;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await getNotificationsApi(nextPage);
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [
          ...prev,
          ...result.notifications.filter((n) => !seen.has(n.id)),
        ];
      });
      setPage(nextPage);
      setHasMore(result.notifications.length >= 20);
    } catch {
      // Leave hasMore so a further scroll retries.
    } finally {
      inFlightRef.current = false;
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      markNotificationsReadApi().catch(() => {});
    }, []),
  );

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
      <View
        style={[
          styles.container,
          { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight },
        ]}
      >
        <SkeletonLoader variant="list" lines={5} height={60} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: headerHeight,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <Feather
          name="alert-circle"
          size={48}
          color={theme.textSecondary}
          style={{ opacity: 0.4, marginBottom: Spacing.lg }}
        />
        <ThemedText
          type="body"
          style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}
        >
          Could not load notifications.
        </ThemedText>
        <Button
          onPress={() => {
            setError(false);
            setIsLoading(true);
            loadData();
          }}
          variant="outline"
        >
          Retry
        </Button>
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
      data={notifications}
      keyExtractor={(item) => item.id.toString()}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.textSecondary}
        />
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator
            style={{ paddingVertical: Spacing.lg }}
            color={theme.textSecondary}
          />
        ) : null
      }
      renderItem={({ item }) => {
        const config = ICON_MAP[item.type] || ICON_MAP.like;
        return (
          <AnimatedPress
            onPress={() => handlePress(item)}
            style={[
              styles.row,
              {
                backgroundColor: item.isRead
                  ? theme.backgroundCard
                  : Colors.light.primary + "08",
                borderColor: item.isRead
                  ? theme.cardBorder
                  : Colors.light.primary + "20",
              },
            ]}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: config.color + "15" },
              ]}
            >
              <Feather name={config.icon} size={18} color={config.color} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="body">{item.message}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {timeAgo(item.createdAt)}
              </ThemedText>
            </View>
            <Feather
              name="chevron-right"
              size={16}
              color={theme.textSecondary}
            />
          </AnimatedPress>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Feather
            name="bell-off"
            size={48}
            color={theme.textSecondary}
            style={{ opacity: 0.3, marginBottom: Spacing.lg }}
          />
          <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>
            No notifications
          </ThemedText>
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, textAlign: "center" }}
          >
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
