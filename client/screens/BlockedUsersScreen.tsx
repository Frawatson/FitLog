import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { BlockedUser } from "@/types";
import { getBlockedUsersApi, unblockUserApi } from "@/lib/socialStorage";
import { showSystemMenu } from "@/components/SystemMenu";
import { webSafeAlert } from "@/lib/webSafeAlert";

export default function BlockedUsersScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    try {
      const data = await getBlockedUsersApi();
      setUsers(data);
      setError(false);
    } catch (e) {
      // Distinguish failure from an empty block list — this used to
      // render "You haven't blocked anyone." during outages.
      console.log("Failed to load blocked users:", e);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const handleUnblock = (user: BlockedUser) => {
    const doUnblock = async () => {
      const ok = await unblockUserApi(user.userId);
      if (ok) {
        setUsers((prev) => prev.filter((u) => u.userId !== user.userId));
      } else {
        webSafeAlert("Unblock failed", "Please try again.");
      }
    };
    showSystemMenu({
      title: `Unblock ${user.name}?`,
      message: "They will be able to see your posts and follow you again.",
      options: [
        { label: "Unblock", onPress: doUnblock },
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
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
      }}
      data={users}
      keyExtractor={(item) => item.userId.toString()}
      renderItem={({ item }) => (
        <View
          style={[
            styles.row,
            {
              backgroundColor: theme.backgroundCard,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Avatar uri={item.avatarUrl} name={item.name} size={40} />
          <View style={{ flex: 1 }}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {item.name}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Blocked {new Date(item.blockedAt).toLocaleDateString()}
            </ThemedText>
          </View>
          <Button
            onPress={() => handleUnblock(item)}
            variant="outline"
            style={styles.unblockBtn}
          >
            Unblock
          </Button>
        </View>
      )}
      ListEmptyComponent={
        error ? (
          <View style={styles.empty}>
            <Feather
              name="alert-circle"
              size={48}
              color={theme.textSecondary}
              style={{ opacity: 0.3, marginBottom: Spacing.lg }}
            />
            <ThemedText
              type="body"
              style={{
                color: theme.textSecondary,
                textAlign: "center",
                marginBottom: Spacing.md,
              }}
            >
              Could not load blocked users.
            </ThemedText>
            <Button
              onPress={() => {
                setIsLoading(true);
                loadData();
              }}
              variant="outline"
            >
              Retry
            </Button>
          </View>
        ) : (
          <View style={styles.empty}>
            <Feather
              name="shield"
              size={48}
              color={theme.textSecondary}
              style={{ opacity: 0.3, marginBottom: Spacing.lg }}
            />
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, textAlign: "center" }}
            >
              You haven&apos;t blocked anyone.
            </ThemedText>
          </View>
        )
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
  unblockBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  empty: {
    alignItems: "center",
    paddingTop: Spacing["5xl"],
  },
});
