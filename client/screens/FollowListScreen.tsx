import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
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
import type { FollowUser } from "@/types";
import { getFollowersList, getFollowingList, followUserApi, unfollowUserApi } from "@/lib/socialStorage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type FollowRoute = RouteProp<RootStackParamList, "FollowList">;

export default function FollowListScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<FollowRoute>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { userId, mode } = route.params;

  const [users, setUsers] = useState<FollowUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const hasLoadedRef = useRef(false);

  const loadData = async (pageNum = 0) => {
    if (!hasLoadedRef.current) setIsLoading(true);
    try {
      const fetcher = mode === "followers" ? getFollowersList : getFollowingList;
      const result = await fetcher(userId, pageNum);
      if (pageNum === 0) {
        setUsers(result);
      } else {
        setUsers(prev => [...prev, ...result]);
      }
      setHasMore(result.length === 20);
      setError(false);
    } catch (e) {
      console.log("Failed to load follow list:", e);
      setError(true);
    } finally {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        setIsLoading(false);
      }
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  React.useEffect(() => {
    navigation.setOptions({ headerTitle: mode === "followers" ? "Followers" : "Following" });
  }, [mode]);

  const handleFollow = async (targetUser: FollowUser) => {
    setUsers(prev => prev.map(u =>
      u.userId === targetUser.userId ? { ...u, isFollowedByMe: !u.isFollowedByMe } : u
    ));
    if (targetUser.isFollowedByMe) {
      await unfollowUserApi(targetUser.userId);
    } else {
      await followUserApi(targetUser.userId);
    }
  };

  const loadMore = () => {
    if (!hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadData(nextPage);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <SkeletonLoader variant="card" count={5} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight, alignItems: "center", justifyContent: "center" }]}>
        <Feather name="alert-circle" size={48} color={theme.textSecondary} style={{ opacity: 0.4, marginBottom: Spacing.lg }} />
        <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
          Could not load list.
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
        data={users}
        keyExtractor={(item) => item.userId.toString()}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: Spacing["5xl"] }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <AnimatedPress
            onPress={() => navigation.navigate("SocialProfile", { userId: item.userId })}
            style={[styles.userRow, { borderBottomColor: theme.border }]}
          >
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText type="h4">{item.name?.charAt(0)?.toUpperCase()}</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="h4">{item.name}</ThemedText>
              {item.bio ? <ThemedText type="caption" numberOfLines={1} style={{ color: theme.textSecondary }}>{item.bio}</ThemedText> : null}
            </View>
            {user && item.userId !== Number(user.id) && (
              <Pressable
                onPress={() => handleFollow(item)}
                style={[styles.followBtn, { backgroundColor: item.isFollowedByMe ? theme.backgroundDefault : Colors.light.primary }]}
              >
                <ThemedText type="caption" style={{ color: item.isFollowedByMe ? theme.text : "#fff", fontWeight: "700" }}>
                  {item.isFollowedByMe ? "Following" : "Follow"}
                </ThemedText>
              </Pressable>
            )}
          </AnimatedPress>
        )}
        ListEmptyComponent={
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", paddingTop: Spacing["3xl"] }}>
            {mode === "followers" ? "No followers yet." : "Not following anyone yet."}
          </ThemedText>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  userRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  followBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
});
