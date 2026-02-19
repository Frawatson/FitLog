import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, RefreshControl, Pressable, TextInput, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, useFocusEffect, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { SocialProfile, Post } from "@/types";
import { getSocialProfileApi, followUserApi, unfollowUserApi, getUserPostsFeed, updateSocialProfileApi } from "@/lib/socialStorage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type ProfileRoute = RouteProp<RootStackParamList, "SocialProfile">;

export default function SocialProfileScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ProfileRoute>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const targetUserId = route.params.userId;
  const isOwnProfile = user && Number(user.id) === targetUserId;

  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const hasLoadedRef = useRef(false);

  const loadData = async () => {
    if (!hasLoadedRef.current) setIsLoading(true);
    const [profileData, postsData] = await Promise.all([
      getSocialProfileApi(targetUserId),
      getUserPostsFeed(targetUserId),
    ]);
    setProfile(profileData);
    setPosts(postsData.posts);
    if (profileData?.bio) setBioText(profileData.bio);
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleFollow = async () => {
    if (!profile) return;
    if (profile.isFollowedByMe) {
      setProfile({ ...profile, isFollowedByMe: false, followersCount: profile.followersCount - 1 });
      await unfollowUserApi(targetUserId);
    } else {
      setProfile({ ...profile, isFollowedByMe: true, followersCount: profile.followersCount + 1 });
      await followUserApi(targetUserId);
    }
  };

  const handleSaveBio = async () => {
    await updateSocialProfileApi({ bio: bioText.trim() });
    setProfile(prev => prev ? { ...prev, bio: bioText.trim() } : prev);
    setEditingBio(false);
  };

  if (isLoading || !profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <SkeletonLoader variant="card" count={2} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={{ marginBottom: Spacing.xl }}>
      {/* Avatar + Name */}
      <View style={styles.profileTop}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="display" style={{ fontSize: 32 }}>{profile.name?.charAt(0)?.toUpperCase()}</ThemedText>
        </View>
        <ThemedText type="h1" style={{ marginTop: Spacing.md }}>{profile.name}</ThemedText>
        {profile.bio && !editingBio ? (
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
            {profile.bio}
          </ThemedText>
        ) : null}

        {isOwnProfile && editingBio && (
          <View style={{ width: "100%", marginTop: Spacing.sm }}>
            <TextInput
              style={[styles.bioInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
              value={bioText}
              onChangeText={setBioText}
              placeholder="Write a short bio..."
              placeholderTextColor={theme.textSecondary}
              maxLength={150}
              multiline
            />
            <View style={{ flexDirection: "row", gap: Spacing.sm, justifyContent: "flex-end" }}>
              <Pressable onPress={() => setEditingBio(false)}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
              </Pressable>
              <Pressable onPress={handleSaveBio}>
                <ThemedText type="small" style={{ color: Colors.light.primary, fontWeight: "700" }}>Save</ThemedText>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <Pressable style={styles.statItem} onPress={() => navigation.navigate("FollowList", { userId: targetUserId, mode: "followers" })}>
          <ThemedText type="h3">{profile.followersCount}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Followers</ThemedText>
        </Pressable>
        <Pressable style={styles.statItem} onPress={() => navigation.navigate("FollowList", { userId: targetUserId, mode: "following" })}>
          <ThemedText type="h3">{profile.followingCount}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Following</ThemedText>
        </Pressable>
        <View style={styles.statItem}>
          <ThemedText type="h3">{profile.totalWorkouts}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Workouts</ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText type="h3">{profile.currentStreak}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Streak</ThemedText>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {isOwnProfile ? (
          <Button onPress={() => setEditingBio(true)} variant="outline" style={{ flex: 1 }}>
            Edit Bio
          </Button>
        ) : (
          <Button onPress={handleFollow} variant={profile.isFollowedByMe ? "outline" : "filled"} style={{ flex: 1 }}>
            {profile.isFollowedByMe ? "Following" : "Follow"}
          </Button>
        )}
      </View>

      {/* Fitness Stats */}
      <View style={[styles.fitnessStats, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.fitnessStatItem}>
          <Feather name="activity" size={16} color={Colors.light.primary} />
          <ThemedText type="small">{profile.totalWorkouts} workouts</ThemedText>
        </View>
        <View style={styles.fitnessStatItem}>
          <Feather name="map-pin" size={16} color={Colors.light.success} />
          <ThemedText type="small">{profile.totalRuns} runs ({profile.totalDistanceKm.toFixed(1)} km)</ThemedText>
        </View>
        <View style={styles.fitnessStatItem}>
          <Feather name="calendar" size={16} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Member since {new Date(profile.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</ThemedText>
        </View>
      </View>

      <ThemedText type="h3" style={{ marginTop: Spacing.xl }}>Posts</ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: Spacing["5xl"] }}
        ListHeaderComponent={renderHeader}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textSecondary} />}
        renderItem={({ item }) => (
          <AnimatedPress
            onPress={() => navigation.navigate("PostDetail", { postId: item.id })}
            style={[styles.postCard, { backgroundColor: theme.backgroundCard, borderColor: theme.cardBorder }]}
          >
            <ThemedText type="body" numberOfLines={2}>{item.content || `Shared a ${item.postType}`}</ThemedText>
            <View style={{ flexDirection: "row", gap: Spacing.lg, marginTop: Spacing.sm }}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                <Feather name="heart" size={12} /> {item.likesCount}
              </ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                <Feather name="message-circle" size={12} /> {item.commentsCount}
              </ThemedText>
            </View>
          </AnimatedPress>
        )}
        ListEmptyComponent={
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", paddingTop: Spacing.xl }}>
            No posts yet.
          </ThemedText>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileTop: { alignItems: "center", marginBottom: Spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: Spacing.xl },
  statItem: { alignItems: "center" },
  actionRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.xl },
  fitnessStats: { padding: Spacing.lg, borderRadius: BorderRadius.md, gap: Spacing.md },
  fitnessStatItem: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  bioInput: { borderWidth: 1, borderRadius: BorderRadius.sm, padding: Spacing.md, fontSize: 15, minHeight: 60, marginBottom: Spacing.sm },
  postCard: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
});
