import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { AnimatedPress } from "@/components/AnimatedPress";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Post, PostType } from "@/types";
import { getFeed, likePostApi, unlikePostApi } from "@/lib/socialStorage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const POST_TYPE_CONFIG: Record<PostType, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
  workout: { icon: "activity", color: "#FF4500", label: "Workout" },
  run: { icon: "map-pin", color: "#00D084", label: "Run" },
  meal: { icon: "pie-chart", color: "#818cf8", label: "Meal" },
  progress_photo: { icon: "image", color: "#38bdf8", label: "Progress" },
  achievement: { icon: "award", color: "#facc15", label: "Achievement" },
  text: { icon: "edit-3", color: "#9BA1A6", label: "Post" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function PostCard({ post, onLike, onPress, theme }: {
  post: Post;
  onLike: (post: Post) => void;
  onPress: (post: Post) => void;
  theme: any;
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
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>{timeAgo(post.createdAt)}</ThemedText>
          </View>
        </View>
      </View>

      {post.content ? (
        <ThemedText type="body" style={{ marginBottom: Spacing.md }}>{post.content}</ThemedText>
      ) : null}

      {post.postType === "workout" && ref && (
        <View style={[styles.refCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={{ marginBottom: 4 }}>{ref.routineName || "Workout"}</ThemedText>
          <View style={styles.statsRow}>
            {ref.durationMinutes && <StatChip icon="clock" value={`${ref.durationMinutes}m`} theme={theme} />}
            {ref.totalSets && <StatChip icon="layers" value={`${ref.totalSets} sets`} theme={theme} />}
            {ref.exerciseCount && <StatChip icon="list" value={`${ref.exerciseCount} exercises`} theme={theme} />}
          </View>
        </View>
      )}

      {post.postType === "run" && ref && (
        <View style={[styles.refCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.statsRow}>
            {ref.distanceKm != null && <StatChip icon="navigation" value={`${ref.distanceKm.toFixed(2)} km`} theme={theme} />}
            {ref.durationMinutes && <StatChip icon="clock" value={`${ref.durationMinutes}m`} theme={theme} />}
            {ref.pace && <StatChip icon="trending-up" value={ref.pace} theme={theme} />}
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
            name={post.likedByMe ? "heart" : "heart"}
            size={18}
            color={post.likedByMe ? Colors.light.error : theme.textSecondary}
            style={post.likedByMe ? { opacity: 1 } : { opacity: 0.6 }}
          />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {post.likesCount > 0 ? post.likesCount : ""}
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => onPress(post)} style={styles.actionBtn} hitSlop={8}>
          <Feather name="message-circle" size={18} color={theme.textSecondary} style={{ opacity: 0.6 }} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {post.commentsCount > 0 ? post.commentsCount : ""}
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

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadFeed = async (cursor?: string) => {
    const result = await getFeed(cursor);
    return result;
  };

  const loadData = async () => {
    if (!hasLoadedRef.current) setIsLoading(true);
    const result = await loadFeed();
    setPosts(result.posts);
    setNextCursor(result.nextCursor);
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    const result = await loadFeed();
    setPosts(result.posts);
    setNextCursor(result.nextCursor);
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await loadFeed(nextCursor);
    setPosts(prev => [...prev, ...result.posts]);
    setNextCursor(result.nextCursor);
    setLoadingMore(false);
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

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <SkeletonLoader variant="card" count={3} />
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
          <PostCard post={item} onLike={handleLike} onPress={handlePostPress} theme={theme} />
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
            <AnimatedPress onPress={() => navigation.navigate("UserSearch")} style={[styles.searchBtn, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <Feather name="search" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary }}>Find people...</ThemedText>
            </AnimatedPress>
          </View>
        }
      />

      <AnimatedPress
        onPress={() => navigation.navigate("CreatePost", undefined)}
        style={[styles.fab, { backgroundColor: Colors.light.primary }]}
      >
        <Feather name="plus" size={24} color="#fff" />
      </AnimatedPress>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { marginBottom: Spacing.sm },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
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
    bottom: 100,
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
