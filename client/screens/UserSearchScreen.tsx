import React, { useState, useRef } from "react";
import { View, StyleSheet, FlatList, TextInput, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Feather from "@expo/vector-icons/Feather";

import { ThemedText } from "@/components/ThemedText";
import { AnimatedPress } from "@/components/AnimatedPress";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { FollowUser } from "@/types";
import {
  searchUsersApi,
  followUserApi,
  unfollowUserApi,
} from "@/lib/socialStorage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function UserSearchScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FollowUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id per issued request: a slow response for "jo" must not
  // overwrite fresher results for "john" that already landed.
  const requestIdRef = useRef(0);
  // Per-row busy set so a double-tap on Follow can't race itself.
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());

  const runSearch = async (term: string) => {
    const requestId = ++requestIdRef.current;
    setSearching(true);
    setSearchError(false);
    try {
      const users = await searchUsersApi(term);
      if (requestId !== requestIdRef.current) return; // stale response
      setResults(users);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      console.log("Search failed:", e);
      setSearchError(true);
    } finally {
      if (requestId === requestIdRef.current) setSearching(false);
    }
  };

  const handleSearch = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      // Invalidate any in-flight request too — a pending response used
      // to repopulate the list right after the user cleared it.
      requestIdRef.current++;
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(text.trim()), 300);
  };

  const handleSubmitSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length >= 2) runSearch(query.trim());
  };

  const handleFollow = async (targetUser: FollowUser) => {
    if (busyIds.has(targetUser.userId)) return;
    setBusyIds((prev) => new Set(prev).add(targetUser.userId));
    // Targeted optimistic + rollback so a failing request only reverts its
    // own row; concurrent toggles on other rows keep their state.
    const wasFollowed = targetUser.isFollowedByMe;
    setResults((prev) =>
      prev.map((u) =>
        u.userId === targetUser.userId
          ? { ...u, isFollowedByMe: !u.isFollowedByMe }
          : u,
      ),
    );
    const ok = wasFollowed
      ? await unfollowUserApi(targetUser.userId)
      : await followUserApi(targetUser.userId);
    if (!ok) {
      setResults((prev) =>
        prev.map((u) =>
          u.userId === targetUser.userId
            ? { ...u, isFollowedByMe: wasFollowed }
            : u,
        ),
      );
    }
    setBusyIds((prev) => {
      const next = new Set(prev);
      next.delete(targetUser.userId);
      return next;
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.userId.toString()}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing["5xl"],
          width: "100%",
          maxWidth: 720,
          alignSelf: "center",
        }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <Feather name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by name..."
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={handleSearch}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleSubmitSearch}
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => handleSearch("")}
                hitSlop={8}
                accessibilityLabel="Clear search"
              >
                <Feather name="x" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <AnimatedPress
            onPress={() =>
              navigation.navigate("SocialProfile", { userId: item.userId })
            }
            style={[styles.userRow, { borderBottomColor: theme.border }]}
          >
            <Avatar uri={item.avatarUrl} name={item.name} size={44} />
            <View style={{ flex: 1 }}>
              <ThemedText type="h4">{item.name}</ThemedText>
              {item.bio ? (
                <ThemedText
                  type="caption"
                  numberOfLines={1}
                  style={{ color: theme.textSecondary }}
                >
                  {item.bio}
                </ThemedText>
              ) : null}
            </View>
            {user && item.userId !== Number(user.id) && (
              <Pressable
                onPress={() => handleFollow(item)}
                style={[
                  styles.followBtn,
                  {
                    backgroundColor: item.isFollowedByMe
                      ? theme.backgroundDefault
                      : Colors.light.primary,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{
                    color: item.isFollowedByMe ? theme.text : "#fff",
                    fontWeight: "700",
                  }}
                >
                  {item.isFollowedByMe ? "Following" : "Follow"}
                </ThemedText>
              </Pressable>
            )}
          </AnimatedPress>
        )}
        ListEmptyComponent={
          searchError ? (
            <View style={{ alignItems: "center", paddingTop: Spacing["3xl"] }}>
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, marginBottom: Spacing.md }}
              >
                Search failed. Check your connection.
              </ThemedText>
              <Pressable onPress={handleSubmitSearch} hitSlop={8}>
                <ThemedText
                  type="body"
                  style={{ color: Colors.light.primary, fontWeight: "600" }}
                >
                  Retry
                </ThemedText>
              </Pressable>
            </View>
          ) : query.trim().length >= 2 && !searching ? (
            <ThemedText
              type="body"
              style={{
                color: theme.textSecondary,
                textAlign: "center",
                paddingTop: Spacing["3xl"],
              }}
            >
              No users found.
            </ThemedText>
          ) : query.length < 2 ? (
            <View style={styles.empty}>
              <Feather
                name="search"
                size={48}
                color={theme.textSecondary}
                style={{ opacity: 0.3, marginBottom: Spacing.lg }}
              />
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, textAlign: "center" }}
              >
                Search for people to follow and see their fitness journey.
              </ThemedText>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  followBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  empty: {
    alignItems: "center",
    paddingTop: Spacing["5xl"],
    paddingHorizontal: Spacing["3xl"],
  },
});
