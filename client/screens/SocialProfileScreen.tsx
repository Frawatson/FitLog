import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
  RouteProp,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Feather from "@expo/vector-icons/Feather";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { Avatar } from "@/components/Avatar";
import { SaveRoutineButton } from "@/components/SaveRoutineButton";
import { visibleWorkoutExercises } from "@/lib/workoutPosts";
import { showSystemMenu } from "@/components/SystemMenu";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { SocialProfile, Post } from "@/types";
import {
  getSocialProfileApi,
  followUserApi,
  unfollowUserApi,
  getUserPostsFeed,
  blockUserApi,
  unblockUserApi,
} from "@/lib/socialStorage";
import { onPostDeleted } from "@/lib/postEvents";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ProfileRoute = RouteProp<RootStackParamList, "SocialProfile">;

export default function SocialProfileScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ProfileRoute>();
  const { theme } = useTheme();
  const { user } = useAuth();
  // Number(): URL params arrive as strings after a web refresh, which
  // made the own-profile check fail (showing Follow/Block on yourself)
  // and could fire requests at /users/NaN.
  const targetUserId = Number(route.params?.userId);
  const isOwnProfile = user && Number(user.id) === targetUserId;

  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const hasLoadedRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const loadData = async () => {
    if (!Number.isFinite(targetUserId)) {
      setError(true);
      setIsLoading(false);
      hasLoadedRef.current = true;
      return;
    }
    if (!hasLoadedRef.current) setIsLoading(true);
    try {
      const [profileData, postsData] = await Promise.all([
        getSocialProfileApi(targetUserId),
        getUserPostsFeed(targetUserId),
      ]);
      setProfile(profileData);
      setPosts(postsData.posts);
      setNextCursor(postsData.nextCursor);
      setError(false);
    } catch (e) {
      console.log("Failed to load social profile:", e);
      setError(true);
    } finally {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        setIsLoading(false);
      }
    }
  };

  // Older pages of this user's posts — only the first page ever loaded
  // before.
  const loadMorePosts = async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const result = await getUserPostsFeed(targetUserId, nextCursor);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...result.posts.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(result.nextCursor);
    } catch {
      // Cursor retained; next scroll retries.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  // Drop posts deleted from PostDetail so back-navigation doesn't show
  // ghost rows (same contract as SocialFeedScreen).
  React.useEffect(
    () =>
      onPostDeleted((postId) => {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }),
    [],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleFollow = async () => {
    if (!profile) return;
    const previous = profile;
    if (profile.isFollowedByMe) {
      setProfile({
        ...profile,
        isFollowedByMe: false,
        followersCount: profile.followersCount - 1,
      });
      const ok = await unfollowUserApi(targetUserId);
      if (!ok) setProfile(previous);
    } else {
      setProfile({
        ...profile,
        isFollowedByMe: true,
        followersCount: profile.followersCount + 1,
      });
      const ok = await followUserApi(targetUserId);
      if (!ok) setProfile(previous);
    }
  };

  const handleBlock = () => {
    if (!profile) return;
    const action = profile.isBlockedByMe ? "Unblock" : "Block";
    const message = profile.isBlockedByMe
      ? "They will be able to see your posts and follow you again."
      : "They won't be able to see your posts or find you. This will also unfollow them.";

    const doAction = async () => {
      if (profile.isBlockedByMe) {
        await unblockUserApi(targetUserId);
        setProfile((prev) => (prev ? { ...prev, isBlockedByMe: false } : prev));
      } else {
        await blockUserApi(targetUserId);
        setProfile((prev) =>
          prev ? { ...prev, isBlockedByMe: true, isFollowedByMe: false } : prev,
        );
      }
    };
    // Cross-platform confirm — was previously Platform.OS branching
    // between Alert.alert and window.confirm. showSystemMenu handles
    // both correctly and matches the pattern already in use across the
    // rest of the social Report/Block/Delete flows.
    showSystemMenu({
      title: `${action} ${profile.name}?`,
      message,
      options: [
        {
          label: action,
          destructive: !profile.isBlockedByMe,
          onPress: doAction,
        },
        { label: "Cancel", cancel: true },
      ],
    });
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight },
        ]}
      >
        <SkeletonLoader variant="card" count={2} />
      </View>
    );
  }

  if (error || !profile) {
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
          Could not load profile.
        </ThemedText>
        <Button
          onPress={() => {
            setError(false);
            hasLoadedRef.current = false;
            loadData();
          }}
          variant="outline"
        >
          Retry
        </Button>
      </View>
    );
  }

  const headerElement = (
    <View style={{ marginBottom: Spacing.xl }}>
      {/* Avatar + Name */}
      <View style={styles.profileTop}>
        <Avatar uri={profile.avatarUrl} name={profile.name} size={80} />
        <ThemedText type="h1" style={{ marginTop: Spacing.md }}>
          {profile.name}
        </ThemedText>
        {profile.bio ? (
          <ThemedText
            type="body"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: Spacing.xs,
            }}
          >
            {profile.bio}
          </ThemedText>
        ) : null}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <Pressable
          style={styles.statItem}
          onPress={() =>
            navigation.navigate("FollowList", {
              userId: targetUserId,
              mode: "followers",
            })
          }
        >
          <ThemedText type="h3">{profile.followersCount}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Followers
          </ThemedText>
        </Pressable>
        <Pressable
          style={styles.statItem}
          onPress={() =>
            navigation.navigate("FollowList", {
              userId: targetUserId,
              mode: "following",
            })
          }
        >
          <ThemedText type="h3">{profile.followingCount}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Following
          </ThemedText>
        </Pressable>
        <View style={styles.statItem}>
          <ThemedText type="h3">{profile.totalWorkouts}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Workouts
          </ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText type="h3">{profile.currentStreak}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Streak
          </ThemedText>
        </View>
      </View>

      {/* Action Buttons — only for OTHER users' profiles. Bio + avatar
          editing live on the Profile tab; if a user lands here viewing
          themselves (e.g. tapped their own name in the feed) we skip
          the follow/block controls. */}
      {!isOwnProfile ? (
        <View style={styles.actionRow}>
          <Button
            onPress={handleFollow}
            variant={profile.isFollowedByMe ? "outline" : "filled"}
            style={{ flex: 1 }}
          >
            {profile.isFollowedByMe ? "Following" : "Follow"}
          </Button>
          <AnimatedPress
            onPress={handleBlock}
            style={[
              styles.blockBtn,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <Feather
              name={profile.isBlockedByMe ? "user-check" : "slash"}
              size={18}
              color={profile.isBlockedByMe ? theme.text : Colors.light.error}
            />
          </AnimatedPress>
        </View>
      ) : null}

      {/* Fitness Stats */}
      <View
        style={[
          styles.fitnessStats,
          { backgroundColor: theme.backgroundDefault },
        ]}
      >
        <View style={styles.fitnessStatItem}>
          <Feather name="activity" size={16} color={Colors.light.primary} />
          <ThemedText type="small">{profile.totalWorkouts} workouts</ThemedText>
        </View>
        <View style={styles.fitnessStatItem}>
          <Feather name="map-pin" size={16} color={Colors.light.success} />
          <ThemedText type="small">
            {profile.totalRuns} runs ({profile.totalDistanceKm.toFixed(1)} km)
          </ThemedText>
        </View>
        <View style={styles.fitnessStatItem}>
          <Feather name="calendar" size={16} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Member since{" "}
            {new Date(profile.memberSince).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </ThemedText>
        </View>
      </View>

      <ThemedText type="h3" style={{ marginTop: Spacing.xl }}>
        Posts
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={posts}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing["5xl"],
          width: "100%",
          maxWidth: 720,
          alignSelf: "center",
        }}
        ListHeaderComponent={headerElement}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.textSecondary}
          />
        }
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              style={{ paddingVertical: Spacing.lg }}
              color={theme.textSecondary}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <AnimatedPress
            onPress={() =>
              navigation.navigate("PostDetail", { postId: item.id })
            }
            style={[
              styles.postCard,
              {
                backgroundColor: theme.backgroundCard,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            {item.content ? (
              <ThemedText type="body" numberOfLines={2}>
                {item.content}
              </ThemedText>
            ) : null}
            {(item.postType === "workout" || item.postType === "routine") &&
            item.referenceData ? (
              <View
                style={[
                  styles.refCard,
                  { backgroundColor: theme.backgroundDefault },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  {item.postType === "routine" ? "WORKOUT PLAN" : "WORKOUT"}
                </ThemedText>
                <ThemedText type="h4">
                  {item.referenceData.routineName || "Workout"}
                </ThemedText>
                {visibleWorkoutExercises(item.referenceData).length > 0 ? (
                  <ThemedText
                    type="caption"
                    numberOfLines={2}
                    style={{ color: theme.textSecondary, marginTop: 2 }}
                  >
                    {/* Only exercises actually done. */}
                    {visibleWorkoutExercises(item.referenceData)
                      .map((e) => e.name)
                      .join(", ")}
                  </ThemedText>
                ) : null}
                {!isOwnProfile ? <SaveRoutineButton post={item} /> : null}
              </View>
            ) : !item.content ? (
              <ThemedText type="body" numberOfLines={2}>
                {`Shared a ${item.postType}`}
              </ThemedText>
            ) : null}
            {/* Icons and numbers as row siblings: an icon nested inside
                <Text> doesn't render reliably on the web. */}
            <View style={styles.postMeta}>
              <View style={styles.metaItem}>
                <Feather name="heart" size={12} color={theme.textSecondary} />
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  {item.likesCount}
                </ThemedText>
              </View>
              <View style={styles.metaItem}>
                <Feather
                  name="message-circle"
                  size={12}
                  color={theme.textSecondary}
                />
                <ThemedText
                  type="caption"
                  style={{ color: theme.textSecondary }}
                >
                  {item.commentsCount}
                </ThemedText>
              </View>
            </View>
          </AnimatedPress>
        )}
        ListEmptyComponent={
          <ThemedText
            type="small"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              paddingTop: Spacing.xl,
            }}
          >
            No posts yet.
          </ThemedText>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  refCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  postMeta: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  profileTop: { alignItems: "center", marginBottom: Spacing.xl },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: Spacing.xl,
  },
  statItem: { alignItems: "center" },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  fitnessStats: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  fitnessStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  postCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  blockBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
