import React, { useState, useRef } from "react";
import { View, StyleSheet, FlatList, TextInput, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { AnimatedPress } from "@/components/AnimatedPress";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { FollowUser } from "@/types";
import { searchUsersApi, followUserApi, unfollowUserApi } from "@/lib/socialStorage";
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const users = await searchUsersApi(text.trim());
      setResults(users);
      setSearching(false);
    }, 300);
  };

  const handleFollow = async (targetUser: FollowUser) => {
    setResults(prev => prev.map(u =>
      u.userId === targetUser.userId ? { ...u, isFollowedByMe: !u.isFollowedByMe } : u
    ));
    if (targetUser.isFollowedByMe) {
      await unfollowUserApi(targetUser.userId);
    } else {
      await followUserApi(targetUser.userId);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.userId.toString()}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: Spacing["5xl"] }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by name..."
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={handleSearch}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(""); setResults([]); }} hitSlop={8}>
                <Feather name="x" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>
        }
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
          query.length >= 2 && !searching ? (
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", paddingTop: Spacing["3xl"] }}>
              No users found.
            </ThemedText>
          ) : query.length < 2 ? (
            <View style={styles.empty}>
              <Feather name="search" size={48} color={theme.textSecondary} style={{ opacity: 0.3, marginBottom: Spacing.lg }} />
              <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
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
  userRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  followBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  empty: { alignItems: "center", paddingTop: Spacing["5xl"], paddingHorizontal: Spacing["3xl"] },
});
