import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, useFocusEffect, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { v4 as uuid } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Post, PostComment } from "@/types";
import { getPostById, getComments, addCommentApi, deleteCommentApi, likePostApi, unlikePostApi, deleteSocialPost } from "@/lib/socialStorage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, "PostDetail">;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function PostDetailScreen() {
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DetailRoute>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const postId = route.params.postId;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const hasLoadedRef = useRef(false);

  const loadData = async () => {
    if (!hasLoadedRef.current) setIsLoading(true);
    const [postData, commentData] = await Promise.all([
      getPostById(postId),
      getComments(postId),
    ]);
    setPost(postData);
    setComments(commentData);
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleLike = async () => {
    if (!post) return;
    setPost({ ...post, likedByMe: !post.likedByMe, likesCount: post.likedByMe ? post.likesCount - 1 : post.likesCount + 1 });
    if (post.likedByMe) await unlikePostApi(post.id);
    else await likePostApi(post.id);
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || sending) return;
    setSending(true);
    const result = await addCommentApi(postId, uuid(), commentText.trim());
    if (result) {
      setComments(prev => [...prev, result]);
      setPost(prev => prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : prev);
      setCommentText("");
    }
    setSending(false);
  };

  const handleDeleteComment = async (commentId: number) => {
    Alert.alert("Delete Comment", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        const success = await deleteCommentApi(commentId);
        if (success) {
          setComments(prev => prev.filter(c => c.id !== commentId));
          setPost(prev => prev ? { ...prev, commentsCount: Math.max(prev.commentsCount - 1, 0) } : prev);
        }
      }},
    ]);
  };

  const handleDeletePost = async () => {
    if (!post) return;
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteSocialPost(post.id);
        navigation.goBack();
      }},
    ]);
  };

  if (isLoading || !post) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <SkeletonLoader variant="card" count={1} />
      </View>
    );
  }

  const isOwner = user && post.userId === Number(user.id);
  const ref = post.referenceData;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={headerHeight}>
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl }}
          ListHeaderComponent={
            <View style={{ marginBottom: Spacing.xl }}>
              {/* Post Header */}
              <View style={styles.postHeader}>
                <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText type="h4" style={{ fontSize: 18 }}>{post.authorName?.charAt(0)?.toUpperCase()}</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <Pressable onPress={() => navigation.navigate("SocialProfile", { userId: post.userId })}>
                    <ThemedText type="h3">{post.authorName}</ThemedText>
                  </Pressable>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>{timeAgo(post.createdAt)}</ThemedText>
                </View>
                {isOwner && (
                  <Pressable onPress={handleDeletePost} hitSlop={8}>
                    <Feather name="trash-2" size={18} color={Colors.light.error} />
                  </Pressable>
                )}
              </View>

              {post.content ? <ThemedText type="body" style={{ marginBottom: Spacing.lg }}>{post.content}</ThemedText> : null}

              {/* Reference data */}
              {post.postType === "workout" && ref && (
                <View style={[styles.refCard, { backgroundColor: theme.backgroundDefault }]}>
                  <ThemedText type="h4" style={{ marginBottom: 4 }}>{ref.routineName || "Workout"}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {ref.durationMinutes && `${ref.durationMinutes}m`}{ref.totalSets && ` \u00B7 ${ref.totalSets} sets`}{ref.exerciseCount && ` \u00B7 ${ref.exerciseCount} exercises`}
                  </ThemedText>
                </View>
              )}

              {post.postType === "run" && ref && (
                <View style={[styles.refCard, { backgroundColor: theme.backgroundDefault }]}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {ref.distanceKm?.toFixed(2)} km{ref.durationMinutes && ` \u00B7 ${ref.durationMinutes}m`}{ref.pace && ` \u00B7 ${ref.pace}`}
                  </ThemedText>
                </View>
              )}

              {/* Like/comment counts */}
              <View style={styles.actions}>
                <Pressable onPress={handleLike} style={styles.actionBtn} hitSlop={8}>
                  <Feather name="heart" size={20} color={post.likedByMe ? Colors.light.error : theme.textSecondary} />
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>{post.likesCount}</ThemedText>
                </Pressable>
                <View style={styles.actionBtn}>
                  <Feather name="message-circle" size={20} color={theme.textSecondary} />
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>{post.commentsCount}</ThemedText>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Comments</ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.commentRow, { borderBottomColor: theme.border }]}>
              <View style={[styles.commentAvatar, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText type="caption" style={{ fontWeight: "700" }}>{item.authorName?.charAt(0)?.toUpperCase()}</ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                  <Pressable onPress={() => navigation.navigate("SocialProfile", { userId: item.userId })}>
                    <ThemedText type="small" style={{ fontWeight: "700" }}>{item.authorName}</ThemedText>
                  </Pressable>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>{timeAgo(item.createdAt)}</ThemedText>
                </View>
                <ThemedText type="body">{item.content}</ThemedText>
              </View>
              {user && item.userId === Number(user.id) && (
                <Pressable onPress={() => handleDeleteComment(item.id)} hitSlop={8}>
                  <Feather name="x" size={14} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
          )}
          ListEmptyComponent={
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", paddingVertical: Spacing.xl }}>
              No comments yet. Be the first!
            </ThemedText>
          }
        />

        {/* Comment Input */}
        <View style={[styles.commentInput, { backgroundColor: theme.backgroundCard, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
            placeholder="Add a comment..."
            placeholderTextColor={theme.textSecondary}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={300}
          />
          <Pressable onPress={handleSendComment} disabled={sending || !commentText.trim()} hitSlop={8}>
            <Feather name="send" size={20} color={commentText.trim() ? Colors.light.primary : theme.textSecondary} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.lg },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  refCard: { padding: Spacing.md, borderRadius: BorderRadius.sm, marginBottom: Spacing.lg },
  actions: { flexDirection: "row", gap: Spacing["2xl"], marginBottom: Spacing.lg },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  divider: { height: 1, marginBottom: Spacing.lg },
  commentRow: { flexDirection: "row", gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  commentInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    fontSize: 15,
  },
});
