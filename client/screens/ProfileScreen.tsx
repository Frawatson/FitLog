import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, Modal, Platform, Switch } from "react-native";
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
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { UserProfile, BodyWeightEntry, MacroTargets } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { formatWeight, parseWeightInput } from "@/lib/units";
import * as notifications from "@/lib/notifications";
import type { NotificationSettings } from "@/lib/notifications";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark, themePreference, setThemePreference } = useTheme();
  const { user, logout, deleteAccount } = useAuth();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bodyWeights, setBodyWeights] = useState<BodyWeightEntry[]>([]);
  const [macros, setMacros] = useState<MacroTargets | null>(null);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    workoutReminders: false,
    streakAlerts: false,
    reminderTime: { hour: 18, minute: 0 },
  });
  
  const loadData = async () => {
    const [profileData, weightData, macroData, notifData] = await Promise.all([
      storage.getUserProfile(),
      storage.getBodyWeights(),
      storage.getMacroTargets(),
      notifications.getNotificationSettings(),
    ]);
    setProfile(profileData);
    setBodyWeights(weightData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setMacros(macroData);
    setNotifSettings(notifData);
  };
  
  const handleToggleWorkoutReminders = async (value: boolean) => {
    if (value) {
      const granted = await notifications.requestNotificationPermissions();
      if (!granted) {
        if (Platform.OS === "web") {
          window.alert("Notifications are not available on web. Please use the mobile app.");
        } else {
          Alert.alert("Permission Required", "Please enable notifications in your device settings.");
        }
        return;
      }
      await notifications.scheduleWorkoutReminder(notifSettings.reminderTime.hour, notifSettings.reminderTime.minute);
    } else {
      await notifications.cancelAllNotifications();
    }
    const updated = { ...notifSettings, workoutReminders: value };
    setNotifSettings(updated);
    await notifications.saveNotificationSettings(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const handleToggleStreakAlerts = async (value: boolean) => {
    if (value) {
      const granted = await notifications.requestNotificationPermissions();
      if (!granted) {
        if (Platform.OS === "web") {
          window.alert("Notifications are not available on web. Please use the mobile app.");
        } else {
          Alert.alert("Permission Required", "Please enable notifications in your device settings.");
        }
        return;
      }
    }
    const updated = { ...notifSettings, streakAlerts: value };
    setNotifSettings(updated);
    await notifications.saveNotificationSettings(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleReminderTimeChange = async (hour: number, minute: number) => {
    const updated = { ...notifSettings, reminderTime: { hour, minute } };
    setNotifSettings(updated);
    await notifications.saveNotificationSettings(updated);
    if (notifSettings.workoutReminders) {
      await notifications.scheduleWorkoutReminder(hour, minute);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const displayMin = minute.toString().padStart(2, "0");
    return `${displayHour}:${displayMin} ${period}`;
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
            <ThemedText type="h2">{formatWeight(latestWeight.weightKg, profile?.unitSystem || "imperial")}</ThemedText>
            <ThemedText type="small" style={{ opacity: 0.6 }}>
              {new Date(latestWeight.date).toLocaleDateString()}
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="body" style={{ opacity: 0.6 }}>
            No weight logged yet
          </ThemedText>
        )}
        
        {bodyWeights.length > 1 ? (
          <View style={styles.weightHistory}>
            <ThemedText type="small" style={styles.historyTitle}>
              Recent History
            </ThemedText>
            {bodyWeights.slice(0, 5).map((entry) => (
              <View key={entry.id} style={styles.weightEntry}>
                <ThemedText type="body">{formatWeight(entry.weightKg, profile?.unitSystem || "imperial")}</ThemedText>
                <ThemedText type="small" style={{ opacity: 0.6 }}>
                  {new Date(entry.date).toLocaleDateString()}
                </ThemedText>
              </View>
            ))}
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
      
      <Card style={styles.sectionCard}>
        <ThemedText type="h4" style={{ marginBottom: Spacing.lg }}>Appearance</ThemedText>
        
        <View style={styles.notificationRow}>
          <View style={styles.notificationInfo}>
            <Feather name={isDark ? "moon" : "sun"} size={20} color={theme.text} />
            <View style={styles.notificationText}>
              <ThemedText type="body">Dark Mode</ThemedText>
              <ThemedText type="small" style={{ opacity: 0.6 }}>
                {themePreference === "system" ? "Following system" : themePreference === "dark" ? "Always dark" : "Always light"}
              </ThemedText>
            </View>
          </View>
          <Switch
            value={themePreference === "dark" || (themePreference === "system" && isDark)}
            onValueChange={(value) => {
              setThemePreference(value ? "dark" : "light");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            trackColor={{ false: theme.border, true: Colors.light.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
        
        <Pressable
          onPress={() => {
            setThemePreference("system");
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={({ pressed }) => [
            styles.systemThemeButton,
            { backgroundColor: themePreference === "system" ? Colors.light.primary + "20" : "transparent", opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="smartphone" size={16} color={themePreference === "system" ? Colors.light.primary : theme.textSecondary} />
          <ThemedText type="small" style={{ marginLeft: Spacing.sm, color: themePreference === "system" ? Colors.light.primary : theme.textSecondary }}>
            Use System Setting
          </ThemedText>
        </Pressable>
      </Card>
      
      <Card style={styles.sectionCard}>
        <ThemedText type="h4" style={{ marginBottom: Spacing.lg }}>Notifications</ThemedText>
        
        <View style={styles.notificationRow}>
          <View style={styles.notificationInfo}>
            <Feather name="bell" size={20} color={theme.text} />
            <View style={styles.notificationText}>
              <ThemedText type="body">Workout Reminders</ThemedText>
              <ThemedText type="small" style={{ opacity: 0.6 }}>
                Daily reminder at {formatTime(notifSettings.reminderTime.hour, notifSettings.reminderTime.minute)}
              </ThemedText>
            </View>
          </View>
          <Switch
            value={notifSettings.workoutReminders}
            onValueChange={handleToggleWorkoutReminders}
            trackColor={{ false: theme.border, true: Colors.light.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
        
        <Pressable
          onPress={() => setShowTimePicker(true)}
          style={({ pressed }) => [
            styles.timePickerButton,
            { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", opacity: pressed ? 0.7 : 1 },
          ]}
          testID="button-change-reminder-time"
        >
          <Feather name="clock" size={16} color={Colors.light.primary} />
          <ThemedText type="small" style={{ marginLeft: Spacing.sm, color: Colors.light.primary }}>
            Change Reminder Time
          </ThemedText>
        </Pressable>
        
        <View style={[styles.notificationRow, { marginTop: Spacing.md }]}>
          <View style={styles.notificationInfo}>
            <Feather name="zap" size={20} color={theme.text} />
            <View style={styles.notificationText}>
              <ThemedText type="body">Streak Alerts</ThemedText>
              <ThemedText type="small" style={{ opacity: 0.6 }}>
                Get notified when your streak is at risk
              </ThemedText>
            </View>
          </View>
          <Switch
            value={notifSettings.streakAlerts}
            onValueChange={handleToggleStreakAlerts}
            trackColor={{ false: theme.border, true: Colors.light.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
        
        {Platform.OS === "web" ? (
          <ThemedText type="small" style={{ opacity: 0.5, marginTop: Spacing.md, fontStyle: "italic" }}>
            Notifications only work on mobile devices via Expo Go
          </ThemedText>
        ) : null}
      </Card>
      
      <Pressable
        onPress={() => navigation.navigate("WorkoutHistory")}
        style={({ pressed }) => [
          styles.menuItem,
          { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Feather name="clock" size={20} color={theme.text} />
        <ThemedText type="body" style={styles.menuLabel}>Workout History</ThemedText>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </Pressable>
      
      <Pressable
        onPress={handleDeleteAccount}
        style={({ pressed }) => [
          styles.menuItem,
          { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Feather name="trash-2" size={20} color={Colors.light.error} />
        <ThemedText type="body" style={[styles.menuLabel, { color: Colors.light.error }]}>
          Delete Account
        </ThemedText>
        <Feather name="chevron-right" size={20} color={Colors.light.error} />
      </Pressable>
      
      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.menuItem,
          { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Feather name="log-out" size={20} color={theme.text} />
        <ThemedText type="body" style={styles.menuLabel}>
          Log Out
        </ThemedText>
        <View style={{ width: 20 }} />
      </Pressable>
    </ScrollView>

    <Modal
      visible={showTimePicker}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowTimePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h3" style={styles.modalTitle}>Set Reminder Time</ThemedText>
          
          <View style={styles.timePickerContainer}>
            <View style={styles.timeColumn}>
              <Pressable onPress={() => {
                const newHour = (notifSettings.reminderTime.hour + 1) % 24;
                handleReminderTimeChange(newHour, notifSettings.reminderTime.minute);
              }}>
                <Feather name="chevron-up" size={28} color={theme.text} />
              </Pressable>
              <View style={[styles.timeDisplay, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                <ThemedText type="h2">
                  {(notifSettings.reminderTime.hour === 0 ? 12 : notifSettings.reminderTime.hour > 12 ? notifSettings.reminderTime.hour - 12 : notifSettings.reminderTime.hour).toString().padStart(2, "0")}
                </ThemedText>
              </View>
              <Pressable onPress={() => {
                const newHour = (notifSettings.reminderTime.hour - 1 + 24) % 24;
                handleReminderTimeChange(newHour, notifSettings.reminderTime.minute);
              }}>
                <Feather name="chevron-down" size={28} color={theme.text} />
              </Pressable>
              <ThemedText type="small" style={{ opacity: 0.5, marginTop: 4 }}>Hour</ThemedText>
            </View>

            <ThemedText type="h2" style={{ marginHorizontal: Spacing.sm }}>:</ThemedText>

            <View style={styles.timeColumn}>
              <Pressable onPress={() => {
                const newMin = (notifSettings.reminderTime.minute + 15) % 60;
                handleReminderTimeChange(notifSettings.reminderTime.hour, newMin);
              }}>
                <Feather name="chevron-up" size={28} color={theme.text} />
              </Pressable>
              <View style={[styles.timeDisplay, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                <ThemedText type="h2">
                  {notifSettings.reminderTime.minute.toString().padStart(2, "0")}
                </ThemedText>
              </View>
              <Pressable onPress={() => {
                const newMin = (notifSettings.reminderTime.minute - 15 + 60) % 60;
                handleReminderTimeChange(notifSettings.reminderTime.hour, newMin);
              }}>
                <Feather name="chevron-down" size={28} color={theme.text} />
              </Pressable>
              <ThemedText type="small" style={{ opacity: 0.5, marginTop: 4 }}>Minute</ThemedText>
            </View>

            <View style={[styles.timeColumn, { marginLeft: Spacing.md }]}>
              <Pressable onPress={() => {
                const currentHour = notifSettings.reminderTime.hour;
                const newHour = currentHour >= 12 ? currentHour - 12 : currentHour + 12;
                handleReminderTimeChange(newHour, notifSettings.reminderTime.minute);
              }}>
                <Feather name="chevron-up" size={28} color={theme.text} />
              </Pressable>
              <View style={[styles.timeDisplay, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                <ThemedText type="h2">
                  {notifSettings.reminderTime.hour >= 12 ? "PM" : "AM"}
                </ThemedText>
              </View>
              <Pressable onPress={() => {
                const currentHour = notifSettings.reminderTime.hour;
                const newHour = currentHour >= 12 ? currentHour - 12 : currentHour + 12;
                handleReminderTimeChange(newHour, notifSettings.reminderTime.minute);
              }}>
                <Feather name="chevron-down" size={28} color={theme.text} />
              </Pressable>
              <ThemedText type="small" style={{ opacity: 0 }}>Hour</ThemedText>
            </View>
          </View>

          <Pressable
            onPress={() => setShowTimePicker(false)}
            style={({ pressed }) => ({
              backgroundColor: Colors.light.primary,
              marginTop: Spacing.lg,
              alignSelf: "center",
              minWidth: 140,
              paddingVertical: Spacing.md,
              paddingHorizontal: Spacing.xl,
              borderRadius: BorderRadius.md,
              alignItems: "center" as const,
              justifyContent: "center" as const,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <ThemedText type="body" style={{ color: "#FFFFFF" }}>Done</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>

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
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notificationInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.md,
  },
  notificationText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  systemThemeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
    alignSelf: "flex-start",
  },
  timePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  timePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
  },
  timeColumn: {
    alignItems: "center",
  },
  timeDisplay: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: Spacing.sm,
  },
});
