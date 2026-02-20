import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Alert, Platform } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { BlockedUser } from "@/types";
import { getBlockedUsersApi, unblockUserApi } from "@/lib/socialStorage";

export default function BlockedUsersScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await getBlockedUsersApi();
      setUsers(data);
    } catch (e) {
      console.log("Failed to load blocked users:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleUnblock = (user: BlockedUser) => {
    const doUnblock = async () => {
      await unblockUserApi(user.userId);
      setUsers(prev => prev.filter(u => u.userId !== user.userId));
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Unblock ${user.name}? They will be able to see your posts and follow you again.`)) {
        doUnblock();
      }
    } else {
      Alert.alert(
        `Unblock ${user.name}?`,
        "They will be able to see your posts and follow you again.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Unblock", onPress: doUnblock },
        ]
      );
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <SkeletonLoader variant="list" lines={3} height={60} />
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
      data={users}
      keyExtractor={(item) => item.userId.toString()}
      renderItem={({ item }) => (
        <View style={[styles.row, { backgroundColor: theme.backgroundCard, borderColor: theme.cardBorder }]}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="h4" style={{ fontSize: 16 }}>
              {item.name?.charAt(0)?.toUpperCase()}
            </ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>{item.name}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Blocked {new Date(item.blockedAt).toLocaleDateString()}
            </ThemedText>
          </View>
          <Button onPress={() => handleUnblock(item)} variant="outline" style={styles.unblockBtn}>
            Unblock
          </Button>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Feather name="shield" size={48} color={theme.textSecondary} style={{ opacity: 0.3, marginBottom: Spacing.lg }} />
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            You haven't blocked anyone.
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  unblockBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  empty: {
    alignItems: "center",
    paddingTop: Spacing["5xl"],
  },
});
