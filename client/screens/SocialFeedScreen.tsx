import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, RefreshControl, Pressable, Image, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Post, PostType } from "@/types";
import { getFeed, likePostApi, unlikePostApi, getUnreadCountApi, blockUserApi, reportContentApi } from "@/lib/socialStorage";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/lib/timeAgo";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const POST_TYPE_CONFIG: Record<PostType, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
  workout: { icon: "activity", color: "#FF4500", label: "Workout" },
  run: { icon: "map-pin", color: "#00D084", label: "Run" },
  meal: { icon: "pie-chart", color: "#818cf8", label: "Meal" },
  achievement: { icon: "award", color: "#facc15", label: "Achievement" },
  text: { icon: "edit-3", color: "#9BA1A6", label: "Post" },
};

function PostCard({ post, onLike, onPress, onMorePress, theme, serverTime }: {
  post: Post;
  onLike: (post: Post) => void;
  onPress: (post: Post) => void;
  onMorePress?: (post: Post) => void;
  theme: any;
  serverTime?: string;
}) {
  const config = POST_TYPE_CONFIG[post.postType] || POST_TYPE_CONFIG.text;
  const ref = post.referenceData;

  return (
    <AnimatedPress onPress={() => onPress(post)} style={[styles.postCard, { backgroundColor: theme.backgroundCard, borderColor: theme.cardBorder }]}>
      <View style={styles.postHeader}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="h4" style={{ fontSize: 16 }}>
            {post.authorName?.charAt(0)?.toUpperCase() || "?"}
          </ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="h4" style={{ fontSize: 15 }}>{post.authorName}</ThemedText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={[styles.typeBadge, { backgroundColor: config.color + "20" }]}>
              <Feather name={config.icon} size={10} color={config.color} />
              <ThemedText type="caption" style={{ color: config.color, fontSize: 10 }}>{config.label}</ThemedText>
            </View>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>{timeAgo(post.createdAt, serverTime)}</ThemedText>
          </View>
        </View>
        {onMorePress && (
          <Pressable onPress={() => onMorePress(post)} hitSlop={8}>
            <Feather name="more-horizontal" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {post.content ? (
        <ThemedText type="body" style={{ marginBottom: Spacing.md }}>{post.content}</ThemedText>
      ) : null}

      {post.imageData ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${post.imageData}` }}
          style={styles.postImage}
          resizeMode="cover"
        />
      ) : null}

      {post.postType === "workout" && ref && (
        <View style={[styles.refCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={{ marginBottom: 4 }}>{ref.routineName || "Workout"}</ThemedText>
          <View style={styles.statsRow}>
            {ref.durationMinutes ? <StatChip icon="clock" value={`${ref.durationMinutes}m`} theme={theme} /> : null}
            {ref.totalSets ? <StatChip icon="layers" value={`${ref.totalSets} sets`} theme={theme} /> : null}
            {ref.exerciseCount ? <StatChip icon="list" value={`${ref.exerciseCount} exercises`} theme={theme} /> : null}
          </View>
          {ref.exercises?.length > 0 && (
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }} numberOfLines={1}>
              {ref.exercises.map((e: any) => e.name).join(", ")}
            </ThemedText>
          )}
        </View>
      )}

      {post.postType === "run" && ref && (
        <View style={[styles.refCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.statsRow}>
            {ref.distanceKm != null && <StatChip icon="navigation" value={`${ref.distanceKm.toFixed(2)} km`} theme={theme} />}
            {ref.durationMinutes ? <StatChip icon="clock" value={`${ref.durationMinutes}m`} theme={theme} /> : null}
            {ref.pace ? <StatChip icon="trending-up" value={ref.pace} theme={theme} /> : null}
          </View>
        </View>
      )}

      {post.postType === "meal" && ref && (
        <View style={[styles.refCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={{ marginBottom: 4 }}>{ref.foodName || "Meal"}</ThemedText>
          <View style={styles.statsRow}>
            {ref.calories != null && <StatChip icon="zap" value={`${ref.calories} cal`} theme={theme} />}
            {ref.protein != null && <StatChip icon="target" value={`${ref.protein}g P`} theme={theme} />}
          </View>
        </View>
      )}

      <View style={styles.postActions}>
        <Pressable onPress={() => onLike(post)} style={styles.actionBtn} hitSlop={8}>
          <Feather
            name="heart"
            size={18}
            color={post.likedByMe ? Colors.light.error : theme.textSecondary}
            style={post.likedByMe ? { opacity: 1 } : { opacity: 0.6 }}
          />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {post.likesCount > 0 ? post.likesCount : null}
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => onPress(post)} style={styles.actionBtn} hitSlop={8}>
          <Feather name="message-circle" size={18} color={theme.textSecondary} style={{ opacity: 0.6 }} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {post.commentsCount > 0 ? post.commentsCount : null}
          </ThemedText>
        </Pressable>
      </View>
    </AnimatedPress>
  );
}

function StatChip({ icon, value, theme }: { icon: keyof typeof Feather.glyphMap; value: string; theme: any }) {
  return (
    <View style={styles.statChip}>
      <Feather name={icon} size={12} color={theme.textSecondary} />
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>{value}</ThemedText>
    </View>
  );
}

export default function SocialFeedScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [serverTime, setServerTime] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const hasLoadedRef = useRef(false);

  const loadFeed = async (cursor?: string) => {
    const result = await getFeed(cursor);
    return result;
  };

  const loadData = async () => {
    if (!hasLoadedRef.current) setIsLoading(true);
    try {
      const [result, count] = await Promise.all([loadFeed(), getUnreadCountApi()]);
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
      setServerTime(result.serverTime);
      setUnreadCount(count);
      setError(false);
    } catch (e) {
      console.log("Failed to load feed:", e);
      setError(true);
    } finally {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        setIsLoading(false);
      }
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await loadFeed();
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
      setServerTime(result.serverTime);
    } finally {
      setRefreshing(false);
    }
  };

  const onEndReached = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await loadFeed(nextCursor);
      setPosts(prev => [...prev, ...result.posts]);
      setNextCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLike = async (post: Post) => {
    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === post.id
        ? { ...p, likedByMe: !p.likedByMe, likesCount: p.likedByMe ? p.likesCount - 1 : p.likesCount + 1 }
        : p
    ));
    if (post.likedByMe) {
      await unlikePostApi(post.id);
    } else {
      await likePostApi(post.id);
    }
  };

  const handlePostPress = (post: Post) => {
    navigation.navigate("PostDetail", { postId: post.id });
  };

  const handleMorePress = (post: Post) => {
    if (Platform.OS === "web") {
      if (window.confirm("Report this post?")) {
        reportContentApi("post", post.id, "inappropriate");
        window.alert("Reported. Thanks for letting us know.");
      } else if (window.confirm(`Block ${post.authorName}? They won't be able to see your posts or find you.`)) {
        blockUserApi(post.userId).then(() => {
          window.alert(`${post.authorName} has been blocked.`);
          setPosts(prev => prev.filter(p => p.userId !== post.userId));
        });
      }
      return;
    }
    Alert.alert("Post Options", undefined, [
      {
        text: "Report Post",
        onPress: () => {
          Alert.alert("Report Post", "Why are you reporting this post?", [
            { text: "Spam", onPress: () => { reportContentApi("post", post.id, "spam"); Alert.alert("Reported", "Thanks for letting us know."); } },
            { text: "Harassment", onPress: () => { reportContentApi("post", post.id, "harassment"); Alert.alert("Reported", "Thanks for letting us know."); } },
            { text: "Inappropriate", onPress: () => { reportContentApi("post", post.id, "inappropriate"); Alert.alert("Reported", "Thanks for letting us know."); } },
            { text: "Cancel", style: "cancel" },
          ]);
        },
      },
      {
        text: "Block User",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Block User",
            `Block ${post.authorName}? They won't be able to see your posts or find you.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Block",
                style: "destructive",
                onPress: async () => {
                  await blockUserApi(post.userId);
                  Alert.alert("Blocked", `${post.authorName} has been blocked.`);
                  setPosts(prev => prev.filter(p => p.userId !== post.userId));
                },
              },
            ]
          );
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <SkeletonLoader variant="card" count={3} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight, alignItems: "center", justifyContent: "center" }]}>
        <Feather name="alert-circle" size={48} color={theme.textSecondary} style={{ opacity: 0.4, marginBottom: Spacing.lg }} />
        <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
          Could not load feed.
        </ThemedText>
        <Button onPress={() => { setError(false); hasLoadedRef.current = false; loadData(); }} variant="outline">
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["5xl"],
          paddingHorizontal: Spacing.lg,
          gap: Spacing.md,
        }}
        renderItem={({ item }) => (
          <PostCard post={item} onLike={handleLike} onPress={handlePostPress} onMorePress={user && item.userId !== Number(user.id) ? handleMorePress : undefined} theme={theme} serverTime={serverTime} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textSecondary} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={48} color={theme.textSecondary} style={{ opacity: 0.3, marginBottom: Spacing.lg }} />
            <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>No posts yet</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
              Follow other users or create your first post to get started.
            </ThemedText>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <AnimatedPress onPress={() => navigation.navigate("UserSearch")} style={[styles.searchBtn, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, flex: 1 }]}>
              <Feather name="search" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary }}>Find people...</ThemedText>
            </AnimatedPress>
            <AnimatedPress onPress={() => navigation.navigate("Notifications")} style={[styles.bellBtn, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <Feather name="bell" size={20} color={theme.text} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <ThemedText type="caption" style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </ThemedText>
                </View>
              )}
            </AnimatedPress>
          </View>
        }
      />

      <AnimatedPress
        onPress={() => navigation.navigate("CreatePost", undefined)}
        style={[styles.fab, { backgroundColor: Colors.light.primary, bottom: insets.bottom + 80 }]}
      >
        <Feather name="plus" size={24} color="#fff" />
      </AnimatedPress>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.light.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  postCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  refCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  postImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  postActions: {
    flexDirection: "row",
    gap: Spacing["2xl"],
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  fab: {
    position: "absolute",
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  empty: {
    alignItems: "center",
    paddingTop: Spacing["5xl"],
    paddingHorizontal: Spacing["3xl"],
  },
});
