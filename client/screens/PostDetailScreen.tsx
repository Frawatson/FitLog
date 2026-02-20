import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert, Image } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { v4 as uuid } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { MapDisplay } from "@/components/MapDisplay";
import type { Post, PostComment } from "@/types";
import { getPostById, getComments, addCommentApi, deleteCommentApi, likePostApi, unlikePostApi, deleteSocialPost, reportContentApi, blockUserApi, editPostApi, editCommentApi } from "@/lib/socialStorage";
import { timeAgo } from "@/lib/timeAgo";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, "PostDetail">;

export default function PostDetailScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DetailRoute>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const postId = route.params.postId;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [serverTime, setServerTime] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [editPostText, setEditPostText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const hasLoadedRef = useRef(false);

  const loadData = async () => {
    if (!hasLoadedRef.current) setIsLoading(true);
    try {
      const [postData, commentResult] = await Promise.all([
        getPostById(postId),
        getComments(postId),
      ]);
      setPost(postData);
      setComments(commentResult.comments);
      setServerTime(postData?.serverTime || commentResult.serverTime);
      setError(false);
    } catch (e) {
      console.log("Failed to load post:", e);
      setError(true);
    } finally {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        setIsLoading(false);
      }
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
    const doDelete = async () => {
      const success = await deleteCommentApi(commentId);
      if (success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        setPost(prev => prev ? { ...prev, commentsCount: Math.max(prev.commentsCount - 1, 0) } : prev);
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm("Delete this comment?")) doDelete();
    } else {
      Alert.alert("Delete Comment", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleDeletePost = async () => {
    if (!post) return;
    const doDelete = async () => {
      await deleteSocialPost(post.id);
      navigation.goBack();
    };
    if (Platform.OS === "web") {
      if (window.confirm("Delete this post?")) doDelete();
    } else {
      Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleReportPost = () => {
    if (!post) return;
    if (Platform.OS === "web") {
      if (window.confirm("Report this post as inappropriate?")) {
        reportContentApi("post", post.id, "inappropriate");
        window.alert("Reported. Thanks for letting us know.");
      }
      return;
    }
    Alert.alert("Report Post", "Why are you reporting this post?", [
      { text: "Spam", onPress: () => { reportContentApi("post", post.id, "spam"); Alert.alert("Reported", "Thanks for letting us know."); } },
      { text: "Harassment", onPress: () => { reportContentApi("post", post.id, "harassment"); Alert.alert("Reported", "Thanks for letting us know."); } },
      { text: "Inappropriate", onPress: () => { reportContentApi("post", post.id, "inappropriate"); Alert.alert("Reported", "Thanks for letting us know."); } },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleReportComment = (commentId: number) => {
    if (Platform.OS === "web") {
      if (window.confirm("Report this comment as inappropriate?")) {
        reportContentApi("comment", commentId, "inappropriate");
        window.alert("Reported. Thanks for letting us know.");
      }
      return;
    }
    Alert.alert("Report Comment", "Why are you reporting this comment?", [
      { text: "Spam", onPress: () => { reportContentApi("comment", commentId, "spam"); Alert.alert("Reported", "Thanks for letting us know."); } },
      { text: "Harassment", onPress: () => { reportContentApi("comment", commentId, "harassment"); Alert.alert("Reported", "Thanks for letting us know."); } },
      { text: "Inappropriate", onPress: () => { reportContentApi("comment", commentId, "inappropriate"); Alert.alert("Reported", "Thanks for letting us know."); } },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleBlockUser = () => {
    if (!post) return;
    const doBlock = async () => {
      await blockUserApi(post.userId);
      if (Platform.OS === "web") {
        window.alert(`${post.authorName} has been blocked.`);
      } else {
        Alert.alert("Blocked", `${post.authorName} has been blocked.`);
      }
      navigation.goBack();
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Block ${post.authorName}? They won't be able to see your posts or find you.`)) {
        doBlock();
      }
    } else {
      Alert.alert(
        "Block User",
        `Block ${post.authorName}? They won't be able to see your posts or find you.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Block", style: "destructive", onPress: doBlock },
        ]
      );
    }
  };

  const handleEditPost = () => {
    if (!post) return;
    setEditPostText(post.content || "");
    setEditingPost(true);
  };

  const handleSaveEditPost = async () => {
    if (!post || !editPostText.trim()) return;
    const success = await editPostApi(post.id, editPostText.trim());
    if (success) {
      setPost(prev => prev ? { ...prev, content: editPostText.trim() } : prev);
    }
    setEditingPost(false);
  };

  const handleEditComment = (comment: PostComment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content);
  };

  const handleSaveEditComment = async () => {
    if (!editingCommentId || !editCommentText.trim()) return;
    const success = await editCommentApi(editingCommentId, editCommentText.trim());
    if (success) {
      setComments(prev => prev.map(c => c.id === editingCommentId ? { ...c, content: editCommentText.trim() } : c));
    }
    setEditingCommentId(null);
    setEditCommentText("");
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <SkeletonLoader variant="card" count={1} />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight, alignItems: "center", justifyContent: "center" }]}>
        <Feather name="alert-circle" size={48} color={theme.textSecondary} style={{ opacity: 0.4, marginBottom: Spacing.lg }} />
        <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
          Could not load post.
        </ThemedText>
        <Button onPress={() => { setError(false); hasLoadedRef.current = false; loadData(); }} variant="outline">
          Retry
        </Button>
      </View>
    );
  }

  const isOwner = user && post.userId === Number(user.id);
  const ref = post.referenceData;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>{timeAgo(post.createdAt, serverTime)}</ThemedText>
                </View>
                {isOwner ? (
                  <View style={{ flexDirection: "row", gap: Spacing.md }}>
                    <Pressable onPress={handleEditPost} hitSlop={8}>
                      <Feather name="edit-2" size={18} color={Colors.light.primary} />
                    </Pressable>
                    <Pressable onPress={handleDeletePost} hitSlop={8}>
                      <Feather name="trash-2" size={18} color={Colors.light.error} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      if (Platform.OS === "web") {
                        if (window.confirm("Report this post?")) {
                          handleReportPost();
                        } else if (window.confirm(`Block ${post.authorName}?`)) {
                          handleBlockUser();
                        }
                        return;
                      }
                      Alert.alert("Post Options", undefined, [
                        { text: "Report Post", onPress: handleReportPost },
                        { text: "Block User", style: "destructive", onPress: handleBlockUser },
                        { text: "Cancel", style: "cancel" },
                      ]);
                    }}
                    hitSlop={8}
                  >
                    <Feather name="more-horizontal" size={18} color={theme.textSecondary} />
                  </Pressable>
                )}
              </View>

              {editingPost ? (
                <View style={{ marginBottom: Spacing.lg }}>
                  <TextInput
                    style={[styles.editInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                    value={editPostText}
                    onChangeText={setEditPostText}
                    multiline
                    maxLength={500}
                  />
                  <View style={{ flexDirection: "row", gap: Spacing.sm, justifyContent: "flex-end" }}>
                    <Pressable onPress={() => setEditingPost(false)}>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
                    </Pressable>
                    <Pressable onPress={handleSaveEditPost}>
                      <ThemedText type="small" style={{ color: Colors.light.primary, fontWeight: "700" }}>Save</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ) : post.content ? (
                <ThemedText type="body" style={{ marginBottom: Spacing.lg }}>{post.content}</ThemedText>
              ) : null}

              {post.imageData ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${post.imageData}` }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
              ) : null}

              {/* Reference data */}
              {post.postType === "workout" && ref && (
                <View style={[styles.refCard, { backgroundColor: theme.backgroundDefault }]}>
                  <ThemedText type="h4" style={{ marginBottom: 4 }}>{ref.routineName || "Workout"}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: ref.exercises?.length > 0 ? Spacing.md : 0 }}>
                    {[
                      ref.durationMinutes && `${ref.durationMinutes}m`,
                      ref.totalSets && `${ref.totalSets} sets`,
                      ref.exerciseCount && `${ref.exerciseCount} exercises`,
                    ].filter(Boolean).join(" \u00B7 ")}
                  </ThemedText>
                  {ref.exercises && ref.exercises.length > 0 && (
                    <View>
                      {ref.exercises.map((ex: any, exIdx: number) => (
                        <View key={exIdx} style={{ marginBottom: Spacing.md }}>
                          <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.xs }}>
                            {ex.name}
                          </ThemedText>
                          {ex.sets?.map((set: any, setIdx: number) => (
                            <View key={setIdx} style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: 2 }}>
                              <ThemedText type="caption" style={{ color: theme.textSecondary, width: 24 }}>
                                {setIdx + 1}
                              </ThemedText>
                              <ThemedText type="small" style={{ color: set.completed ? theme.text : theme.textSecondary, flex: 1 }}>
                                {set.weight} lbs x {set.reps}
                              </ThemedText>
                              <Feather
                                name={set.completed ? "check" : "x"}
                                size={12}
                                color={set.completed ? Colors.light.success : theme.textSecondary}
                              />
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {post.postType === "run" && ref && (
                <View style={[styles.refCard, { backgroundColor: theme.backgroundDefault }]}>
                  {ref.route && ref.route.length > 1 && (
                    <View style={{ height: 180, borderRadius: BorderRadius.sm, overflow: "hidden", marginBottom: Spacing.md }}>
                      <MapDisplay
                        currentLocation={ref.route[ref.route.length - 1]}
                        route={ref.route}
                      />
                    </View>
                  )}
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {[
                      ref.distanceKm != null && `${ref.distanceKm.toFixed(2)} km`,
                      ref.durationMinutes && `${ref.durationMinutes}m`,
                      ref.pace && `${ref.pace}`,
                      ref.calories && `${ref.calories} cal`,
                    ].filter(Boolean).join(" \u00B7 ")}
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
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>{timeAgo(item.createdAt, serverTime)}</ThemedText>
                </View>
                {editingCommentId === item.id ? (
                  <View>
                    <TextInput
                      style={[styles.editInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border, marginTop: 4 }]}
                      value={editCommentText}
                      onChangeText={setEditCommentText}
                      maxLength={300}
                    />
                    <View style={{ flexDirection: "row", gap: Spacing.sm, justifyContent: "flex-end" }}>
                      <Pressable onPress={() => setEditingCommentId(null)}>
                        <ThemedText type="caption" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
                      </Pressable>
                      <Pressable onPress={handleSaveEditComment}>
                        <ThemedText type="caption" style={{ color: Colors.light.primary, fontWeight: "700" }}>Save</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <ThemedText type="body">{item.content}</ThemedText>
                )}
              </View>
              {user && item.userId === Number(user.id) ? (
                <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                  <Pressable onPress={() => handleEditComment(item)} hitSlop={8}>
                    <Feather name="edit-2" size={14} color={theme.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => handleDeleteComment(item.id)} hitSlop={8}>
                    <Feather name="x" size={14} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ) : user ? (
                <Pressable onPress={() => handleReportComment(item.id)} hitSlop={8}>
                  <Feather name="flag" size={14} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", paddingVertical: Spacing.xl }}>
              No comments yet. Be the first!
            </ThemedText>
          }
        />

        {/* Comment Input */}
        <View style={[styles.commentInput, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
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
  postImage: { width: "100%", height: 250, borderRadius: BorderRadius.sm, marginBottom: Spacing.lg },
  refCard: { padding: Spacing.md, borderRadius: BorderRadius.sm, marginBottom: Spacing.lg },
  actions: { flexDirection: "row", gap: Spacing["2xl"], marginBottom: Spacing.lg },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  divider: { height: 1, marginBottom: Spacing.lg },
  commentRow: { flexDirection: "row", gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  editInput: { borderWidth: 1, borderRadius: BorderRadius.sm, padding: Spacing.md, fontSize: 15, minHeight: 40, marginBottom: Spacing.sm },
  commentInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    fontSize: 15,
  },
});
