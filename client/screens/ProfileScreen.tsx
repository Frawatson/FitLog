import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, Modal, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { UserProfile, BodyWeightEntry, MacroTargets } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { getLocalDateString } from "@/lib/dateUtils";
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
  
  const loadData = async () => {
    const [profileData, weightData, macroData] = await Promise.all([
      storage.getUserProfile(),
      storage.getBodyWeights(),
      storage.getMacroTargets(),
    ]);
    setProfile(profileData);
    setBodyWeights(weightData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setMacros(macroData);
    setIsLoading(false);
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

  const handleExportData = async () => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Not Available", "Sharing is not available on this device.");
        return;
      }

      const [workouts, runs, bodyWeights, foodLog] = await Promise.all([
        storage.getWorkouts(),
        storage.getRunHistory(),
        storage.getBodyWeights(),
        storage.getFoodLog(),
      ]);

      const escapeCSV = (val: any) => {
        const str = String(val ?? "");
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      };

      // Workouts CSV
      const workoutRows = ["Date,Routine,Duration (min),Exercises,Total Sets"];
      for (const w of workouts) {
        const exercises = w.exercises?.map((e) => e.exerciseName).join("; ") || "";
        const totalSets = w.exercises?.reduce((sum, e) => sum + (e.sets?.length || 0), 0) || 0;
        workoutRows.push(
          [
            escapeCSV(w.startedAt?.split("T")[0] || w.completedAt?.split("T")[0] || ""),
            escapeCSV(w.routineName || ""),
            w.durationMinutes || 0,
            escapeCSV(exercises),
            totalSets,
          ].join(",")
        );
      }

      // Runs CSV
      const runRows = ["Date,Distance (km),Duration (min),Pace (min/km)"];
      for (const r of runs) {
        const durationMin = Math.round((r.durationSeconds || 0) / 60);
        const pace = r.distanceKm > 0 ? ((r.durationSeconds || 0) / 60 / r.distanceKm).toFixed(2) : "";
        runRows.push(
          [escapeCSV(r.startedAt?.split("T")[0] || ""), r.distanceKm.toFixed(2), durationMin, pace].join(",")
        );
      }

      // Body weights CSV
      const bwRows = ["Date,Weight (kg)"];
      for (const bw of bodyWeights) {
        bwRows.push([escapeCSV(bw.date), bw.weightKg].join(","));
      }

      // Food log CSV
      const foodRows = ["Date,Food,Calories,Protein (g),Carbs (g),Fat (g)"];
      for (const f of foodLog) {
        foodRows.push(
          [
            escapeCSV(f.date),
            escapeCSV(f.food.name),
            f.food.calories,
            f.food.protein,
            f.food.carbs,
            f.food.fat,
          ].join(",")
        );
      }

      const timestamp = getLocalDateString();

      // Create a combined summary CSV
      const summary = [
        `Merge Data Export - ${timestamp}`,
        "",
        `Workouts: ${workouts.length} records`,
        `Runs: ${runs.length} records`,
        `Body Weights: ${bodyWeights.length} records`,
        `Nutrition: ${foodLog.length} records`,
        "",
        "--- WORKOUTS ---",
        workoutRows.join("\n"),
        "",
        "--- RUNS ---",
        runRows.join("\n"),
        "",
        "--- BODY WEIGHT ---",
        bwRows.join("\n"),
        "",
        "--- NUTRITION ---",
        foodRows.join("\n"),
      ].join("\n");

      const file = new File(Paths.cache, `merge_export_${timestamp}.csv`);
      file.write(summary);

      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/csv",
          dialogTitle: "Export Merge Data",
        });
      } else {
        Alert.alert("Export Complete", "Your data has been exported.");
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("Export Failed", "There was an error exporting your data. Please try again.");
    }
  };

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

      {/* Social Section */}
      <ThemedText type="caption" style={styles.sectionLabel}>SOCIAL</ThemedText>

      <AnimatedPress
        onPress={() => navigation.navigate("SocialProfile", { userId: Number(user?.id) })}
        style={[styles.menuItem, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="users" size={20} color={Colors.light.primary} />
        <ThemedText type="body" style={styles.menuLabel}>Social Profile</ThemedText>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </AnimatedPress>

      <AnimatedPress
        onPress={() => navigation.navigate("BlockedUsers")}
        style={[styles.menuItem, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="slash" size={20} color={theme.textSecondary} />
        <ThemedText type="body" style={styles.menuLabel}>Blocked Users</ThemedText>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </AnimatedPress>

      {/* Account Section */}
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
        onPress={handleExportData}
        style={[styles.menuItem, { backgroundColor: theme.backgroundDefault }]}
      >
        <Feather name="download" size={20} color={theme.text} />
        <ThemedText type="body" style={styles.menuLabel}>Export Data</ThemedText>
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
