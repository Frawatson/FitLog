import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, Modal, Platform, TextInput, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { UserProfile, BodyWeightEntry, MacroTargets, SocialProfile } from "@/types";
import * as storage from "@/lib/storage";
import { getSocialProfileApi, updateSocialProfileApi } from "@/lib/socialStorage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { formatWeight, parseWeightInput } from "@/lib/units";

type NavigationProp = NativeStackNavigationProp<RootStackParamList & ProfileStackParamList>;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user, logout, deleteAccount } = useAuth();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bodyWeights, setBodyWeights] = useState<BodyWeightEntry[]>([]);
  const [macros, setMacros] = useState<MacroTargets | null>(null);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [showWeightHistory, setShowWeightHistory] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Social-profile fields lifted into this screen so users see one unified
  // profile (followers/following, bio, public/private) instead of having
  // to navigate to a separate "Social Profile" page.
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");

  const loadData = async () => {
    const userId = user ? Number(user.id) : null;
    const [profileData, weightData, macroData, socialData] = await Promise.all([
      storage.getUserProfile(),
      storage.getBodyWeights(),
      storage.getMacroTargets(),
      userId ? getSocialProfileApi(userId).catch(() => null) : Promise.resolve(null),
    ]);
    setProfile(profileData);
    setBodyWeights(weightData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setMacros(macroData);
    setSocialProfile(socialData);
    if (socialData?.bio) setBioText(socialData.bio);
    setIsLoading(false);
  };

  const handleSaveBio = async () => {
    const trimmed = bioText.trim();
    await updateSocialProfileApi({ bio: trimmed });
    setSocialProfile((prev) => (prev ? { ...prev, bio: trimmed } : prev));
    setEditingBio(false);
  };

  const handleTogglePublic = async (next: boolean) => {
    // Optimistic — flip immediately, roll back if the API rejects.
    const previous = socialProfile;
    setSocialProfile((p) => (p ? { ...p, isPublic: next } : p));
    const ok = await updateSocialProfileApi({ isPublic: next });
    if (!ok) setSocialProfile(previous);
  };
  
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );
  
  const handleLogWeight = async () => {
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight <= 0) return;
    
    const unitSystem = profile?.unitSystem || "imperial";
    const weightInKg = parseWeightInput(weight, unitSystem);
    
    await storage.addBodyWeight(weightInKg);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewWeight("");
    setShowWeightInput(false);
    loadData();
  };
  
  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
  };
  
  const performDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      await storage.clearAllData();
      setShowDeleteModal(false);
      setDeleteStep(1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.error("Delete account error:", error?.message || error);
      if (Platform.OS === "web") {
        window.alert("Failed to delete account. Please try again.");
      } else {
        Alert.alert("Error", "Failed to delete account. Please try again.");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Note: data export moved to Settings (client/lib/dataExport.ts).

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteStep(1);
    setShowDeleteModal(true);
  };

  const handleDeleteModalNext = () => {
    if (deleteStep === 1) {
      setDeleteStep(2);
    } else {
      performDeleteAccount();
    }
  };

  const handleDeleteModalCancel = () => {
    setShowDeleteModal(false);
    setDeleteStep(1);
  };
  
  const getGoalLabel = (goal: string) => {
    switch (goal) {
      case "lose_fat": return "Lose Fat";
      case "gain_muscle": return "Gain Muscle";
      case "recomposition": return "Recomposition";
      case "maintain": return "Maintain";
      default: return goal;
    }
  };
  
  const latestWeight = bodyWeights[0];
  
  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      {isLoading ? (
        <View style={{ gap: Spacing.lg }}>
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
          <View style={{ gap: Spacing.sm }}>
            <SkeletonLoader variant="line" height={52} />
            <SkeletonLoader variant="line" height={52} />
            <SkeletonLoader variant="line" height={52} />
          </View>
        </View>
      ) : (
      <>
      <Card style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: Colors.light.primary }]}>
            <Feather name="user" size={32} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.profileInfo}>
          <ThemedText type="h4">{user?.name || profile?.name || "User"}</ThemedText>
          <ThemedText type="small" style={{ opacity: 0.6 }}>
            {user?.email || profile?.email || ""}
          </ThemedText>
          {/* Bio (social) — inline below email. Pencil toggles edit mode. */}
          {!editingBio ? (
            <Pressable onPress={() => setEditingBio(true)} style={{ marginTop: Spacing.sm }}>
              <ThemedText
                type="small"
                style={{
                  color: socialProfile?.bio ? theme.text : theme.textSecondary,
                  fontStyle: socialProfile?.bio ? "normal" : "italic",
                }}
              >
                {socialProfile?.bio || "Add a short bio…"}
              </ThemedText>
            </Pressable>
          ) : (
            <View style={{ marginTop: Spacing.sm }}>
              <TextInput
                style={[styles.bioInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                value={bioText}
                onChangeText={setBioText}
                placeholder="Write a short bio…"
                placeholderTextColor={theme.textSecondary}
                maxLength={150}
                multiline
                autoFocus
              />
              <View style={{ flexDirection: "row", gap: Spacing.md, justifyContent: "flex-end", marginTop: Spacing.xs }}>
                <Pressable onPress={() => { setBioText(socialProfile?.bio || ""); setEditingBio(false); }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
                </Pressable>
                <Pressable onPress={handleSaveBio}>
                  <ThemedText type="small" style={{ color: Colors.light.primary, fontWeight: "700" }}>Save</ThemedText>
                </Pressable>
              </View>
            </View>
          )}
          {(profile?.goal || user?.goal) ? (
            <>
              <ThemedText type="small" style={[styles.profileLabel, { marginTop: Spacing.md }]}>
                Goal: {getGoalLabel(profile?.goal || user?.goal || "")}
              </ThemedText>
              <ThemedText type="small" style={{ opacity: 0.6 }}>
                {(profile?.activityLevel || user?.activityLevel) === "5-6"
                  ? "5-6 days/week"
                  : (profile?.activityLevel || user?.activityLevel) === "1-2"
                    ? "1-2 days/week"
                    : "3-4 days/week"}
              </ThemedText>
            </>
          ) : null}
        </View>
        <Pressable onPress={() => navigation.navigate("EditProfile")}>
          <Feather name="edit-2" size={20} color={Colors.light.primary} />
        </Pressable>
      </Card>

      {/* Community card — followers, following, and the public-profile toggle.
          Renders only when we have social-profile data; the screen still
          works for users who haven't reached the social API yet. */}
      {socialProfile ? (
        <Card style={styles.sectionCard}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.lg }}>Community</ThemedText>
          <View style={styles.statsRow}>
            <Pressable
              style={styles.statItem}
              onPress={() => user && navigation.navigate("FollowList", { userId: Number(user.id), mode: "followers" })}
            >
              <ThemedText type="h3">{socialProfile.followersCount}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Followers</ThemedText>
            </Pressable>
            <Pressable
              style={styles.statItem}
              onPress={() => user && navigation.navigate("FollowList", { userId: Number(user.id), mode: "following" })}
            >
              <ThemedText type="h3">{socialProfile.followingCount}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Following</ThemedText>
            </Pressable>
            <View style={styles.statItem}>
              <ThemedText type="h3">{socialProfile.totalWorkouts ?? 0}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Workouts</ThemedText>
            </View>
          </View>

          <View style={styles.publicToggleRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="body">Public profile</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {socialProfile.isPublic
                  ? "Anyone can see your bio and posts."
                  : "Only followers can see your bio and posts."}
              </ThemedText>
            </View>
            <Switch
              value={!!socialProfile.isPublic}
              onValueChange={handleTogglePublic}
              trackColor={{ false: theme.border, true: Colors.light.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>
      ) : null}
      
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <ThemedText type="h4">Body Weight</ThemedText>
          <Pressable onPress={() => setShowWeightInput(!showWeightInput)}>
            <Feather name={showWeightInput ? "x" : "plus"} size={20} color={Colors.light.primary} />
          </Pressable>
        </View>
        
        {showWeightInput ? (
          <View style={styles.weightInputRow}>
            <Input
              placeholder={`Weight in ${(profile?.unitSystem || "imperial") === "imperial" ? "lbs" : "kg"}`}
              keyboardType="decimal-pad"
              value={newWeight}
              onChangeText={setNewWeight}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <Button onPress={handleLogWeight} style={styles.logButton}>
              Log
            </Button>
          </View>
        ) : null}
        
        {latestWeight ? (
          <View style={styles.latestWeight}>
            <View style={{ alignItems: "center", flex: 1 }}>
              <ThemedText type="h2">{formatWeight(latestWeight.weightKg, profile?.unitSystem || "imperial")}</ThemedText>
              <ThemedText type="small" style={{ opacity: 0.6 }}>Current</ThemedText>
            </View>
            {profile?.weightGoalKg ? (
              <View style={{ alignItems: "center", flex: 1 }}>
                <ThemedText type="h2" style={{ color: Colors.light.primary }}>{formatWeight(profile.weightGoalKg, profile?.unitSystem || "imperial")}</ThemedText>
                <ThemedText type="small" style={{ opacity: 0.6 }}>Goal</ThemedText>
              </View>
            ) : null}
          </View>
        ) : (
          <ThemedText type="body" style={{ opacity: 0.6 }}>
            No weight logged yet
          </ThemedText>
        )}
        
        {bodyWeights.length > 1 ? (
          <View style={styles.weightHistory}>
            <Pressable
              onPress={() => setShowWeightHistory(!showWeightHistory)}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            >
              <ThemedText type="small" style={styles.historyTitle}>
                Recent History
              </ThemedText>
              <Feather
                name={showWeightHistory ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.textSecondary}
              />
            </Pressable>
            {showWeightHistory && (
              <>
                {bodyWeights.slice(0, 3).map((entry) => (
                  <View key={entry.id} style={styles.weightEntry}>
                    <ThemedText type="body">{formatWeight(entry.weightKg, profile?.unitSystem || "imperial")}</ThemedText>
                    <ThemedText type="small" style={{ opacity: 0.6 }}>
                      {new Date(entry.date).toLocaleDateString()}
                    </ThemedText>
                  </View>
                ))}
                <Pressable onPress={() => navigation.navigate("ProgressCharts")}>
                  <ThemedText type="small" style={{ color: Colors.light.primary, marginTop: Spacing.sm }}>
                    See all
                  </ThemedText>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </Card>
      
      {macros ? (
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h4">Macro Targets</ThemedText>
            <Pressable onPress={() => navigation.navigate("EditMacros")}>
              <Feather name="edit-2" size={18} color={Colors.light.primary} />
            </Pressable>
          </View>
          
          <View style={styles.macroGrid}>
            <View style={styles.macroItem}>
              <ThemedText type="h3" style={{ color: Colors.light.primary }}>
                {macros.calories}
              </ThemedText>
              <ThemedText type="small">Calories</ThemedText>
            </View>
            <View style={styles.macroItem}>
              <ThemedText type="h3" style={{ color: Colors.light.success }}>
                {macros.protein}g
              </ThemedText>
              <ThemedText type="small">Protein</ThemedText>
            </View>
            <View style={styles.macroItem}>
              <ThemedText type="h3" style={{ color: "#FFA500" }}>
                {macros.carbs}g
              </ThemedText>
              <ThemedText type="small">Carbs</ThemedText>
            </View>
            <View style={styles.macroItem}>
              <ThemedText type="h3" style={{ color: "#9B59B6" }}>
                {macros.fat}g
              </ThemedText>
              <ThemedText type="small">Fat</ThemedText>
            </View>
          </View>
        </Card>
      ) : null}
      
      {/* Activity Section */}
      <ThemedText type="caption" style={styles.sectionLabel}>ACTIVITY</ThemedText>

      <AnimatedPress
        onPress={() => navigation.navigate("ProgressCharts")}
        style={[styles.menuItem, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="trending-up" size={20} color={Colors.light.primary} />
        <ThemedText type="body" style={styles.menuLabel}>Progress</ThemedText>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </AnimatedPress>

      <AnimatedPress
        onPress={() => navigation.navigate("Achievements")}
        style={[styles.menuItem, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="award" size={20} color="#FFB300" />
        <ThemedText type="body" style={styles.menuLabel}>Achievements</ThemedText>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </AnimatedPress>

      <AnimatedPress
        onPress={() => navigation.navigate("WorkoutHistory")}
        style={[styles.menuItem, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="clock" size={20} color={theme.text} />
        <ThemedText type="body" style={styles.menuLabel}>Workout History</ThemedText>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </AnimatedPress>

      {/* Account Section — social profile is reached by tapping yourself
          from the feed; blocked-users and export-data moved to Settings. */}
      <ThemedText type="caption" style={styles.sectionLabel}>ACCOUNT</ThemedText>

      <AnimatedPress
        onPress={() => navigation.navigate("Settings")}
        style={[styles.menuItem, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="settings" size={20} color={theme.text} />
        <ThemedText type="body" style={styles.menuLabel}>Settings</ThemedText>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </AnimatedPress>

      <AnimatedPress
        onPress={handleDeleteAccount}
        style={[styles.menuItem, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="trash-2" size={20} color={Colors.light.error} />
        <ThemedText type="body" style={[styles.menuLabel, { color: Colors.light.error }]}>
          Delete Account
        </ThemedText>
        <Feather name="chevron-right" size={20} color={Colors.light.error} />
      </AnimatedPress>

      <AnimatedPress
        onPress={handleLogout}
        style={[styles.menuItem, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="log-out" size={20} color={theme.text} />
        <ThemedText type="body" style={styles.menuLabel}>Log Out</ThemedText>
        <View style={{ width: 20 }} />
      </AnimatedPress>
      </>
      )}
    </ScrollView>

    <Modal
      visible={showDeleteModal}
      transparent={true}
      animationType="fade"
      onRequestClose={handleDeleteModalCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <Feather name="alert-triangle" size={48} color={Colors.light.error} />
            <ThemedText type="h3" style={styles.modalTitle}>
              {deleteStep === 1 ? "Delete Account?" : "Final Confirmation"}
            </ThemedText>
          </View>
          
          <ThemedText type="body" style={styles.modalText}>
            {deleteStep === 1 
              ? "This will permanently delete your account and all associated data. This action cannot be undone."
              : "Please confirm that you want to permanently delete your account. All your workouts, routines, and progress will be lost forever."}
          </ThemedText>
          
          <View style={styles.modalButtons}>
            <Pressable
              onPress={handleDeleteModalCancel}
              style={[styles.modalButton, styles.modalButtonCancel, { borderColor: theme.border }]}
            >
              <ThemedText type="body">Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleDeleteModalNext}
              disabled={isDeleting}
              style={[styles.modalButton, styles.modalButtonDelete]}
            >
              <ThemedText type="body" style={{ color: "#FFFFFF" }}>
                {isDeleting ? "Deleting..." : deleteStep === 1 ? "Continue" : "Delete My Account"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  avatarContainer: {
    marginRight: Spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileLabel: {
    opacity: 0.6,
    marginBottom: Spacing.xs,
  },
  bioInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: 14,
    minHeight: 60,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: Spacing.xl,
  },
  statItem: {
    alignItems: "center",
  },
  publicToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(127,127,127,0.15)",
  },
  sectionCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  weightInputRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  logButton: {
    paddingHorizontal: Spacing.xl,
  },
  latestWeight: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  weightHistory: {
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: Spacing.lg,
  },
  historyTitle: {
    opacity: 0.6,
    marginBottom: Spacing.md,
  },
  weightEntry: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  macroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  macroItem: {
    width: "50%",
    paddingVertical: Spacing.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  menuLabel: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    marginTop: Spacing.md,
    textAlign: "center",
  },
  modalText: {
    textAlign: "center",
    opacity: 0.7,
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonCancel: {
    borderWidth: 1,
  },
  modalButtonDelete: {
    backgroundColor: Colors.light.error,
  },
  sectionLabel: {
    opacity: 0.5,
    letterSpacing: 1,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
});
