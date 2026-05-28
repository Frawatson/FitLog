import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, Modal, Platform, Switch } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { AnimatedPress } from "@/components/AnimatedPress";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import * as notifications from "@/lib/notifications";
import type { NotificationSettings } from "@/lib/notifications";
import { exportUserDataCsv } from "@/lib/dataExport";
import { webSafeAlert } from "@/lib/webSafeAlert";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark, themePreference, setThemePreference } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const outcome = await exportUserDataCsv();
      if (!outcome.ok) {
        if (outcome.reason === "sharing-unavailable") {
          webSafeAlert("Not available", "Sharing isn't available on this device.");
        } else {
          webSafeAlert("Export failed", outcome.message || "Please try again.");
        }
      }
    } finally {
      setIsExporting(false);
    }
  };
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    workoutReminders: false,
    streakAlerts: false,
    reminderTime: { hour: 18, minute: 0 },
  });
  // Debounce ref for the time-picker chevrons. Rapid taps (e.g.
  // holding ↑) previously fired a saveNotificationSettings AND a
  // scheduleNotificationAsync per tap — heavy at ~10 taps/sec. The
  // UI updates instantly; only the persist + reschedule side effects
  // are debounced. pendingRef holds the latest debounced value so we
  // can flush on Done / unmount and never lose the last change.
  const timePersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTimeRef = useRef<NotificationSettings | null>(null);

  const flushTimeChange = useCallback(async () => {
    if (timePersistRef.current) {
      clearTimeout(timePersistRef.current);
      timePersistRef.current = null;
    }
    const pending = pendingTimeRef.current;
    if (!pending) return;
    pendingTimeRef.current = null;
    await notifications.saveNotificationSettings(pending);
    if (pending.workoutReminders) {
      await notifications.scheduleWorkoutReminder(pending.reminderTime.hour, pending.reminderTime.minute);
    }
    if (pending.streakAlerts) {
      await notifications.scheduleStreakReminder(pending.reminderTime.hour, pending.reminderTime.minute);
    }
  }, []);

  // Flush any pending change on unmount so a quick close-modal-then-
  // navigate-away doesn't drop the last tap.
  useEffect(() => () => {
    flushTimeChange();
  }, [flushTimeChange]);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const notifData = await notifications.getNotificationSettings();
        setNotifSettings(notifData);
        setIsLoading(false);
      };
      load();
    }, [])
  );

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
      // Cancel only the workout reminder — was previously
      // cancelAllNotifications which would also wipe the streak reminder.
      await notifications.cancelWorkoutReminder();
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
      // Previously this toggle ONLY persisted to AsyncStorage —
      // no scheduling, no reminder ever fired. Now schedules a daily
      // notification at the same hour:minute as the workout reminder.
      await notifications.scheduleStreakReminder(notifSettings.reminderTime.hour, notifSettings.reminderTime.minute);
    } else {
      await notifications.cancelStreakReminder();
    }
    const updated = { ...notifSettings, streakAlerts: value };
    setNotifSettings(updated);
    await notifications.saveNotificationSettings(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleReminderTimeChange = (hour: number, minute: number) => {
    const updated = { ...notifSettings, reminderTime: { hour, minute } };
    setNotifSettings(updated);
    pendingTimeRef.current = updated;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (timePersistRef.current) clearTimeout(timePersistRef.current);
    timePersistRef.current = setTimeout(() => {
      flushTimeChange();
    }, 300);
  };

  const formatTime = (hour: number, minute: number) => {
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const displayMin = minute.toString().padStart(2, "0");
    return `${displayHour}:${displayMin} ${period}`;
  };

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
      >
        {isLoading ? (
          <View style={{ gap: Spacing.lg }}>
            <SkeletonLoader variant="card" />
            <SkeletonLoader variant="card" />
          </View>
        ) : (
          <>
            <Card style={styles.sectionCard}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.lg }}>Appearance</ThemedText>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Feather name={isDark ? "moon" : "sun"} size={20} color={theme.text} />
                  <View style={styles.settingText}>
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

              <AnimatedPress
                onPress={() => {
                  setThemePreference("system");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.systemThemeButton,
                  { backgroundColor: themePreference === "system" ? Colors.light.primary + "20" : "transparent" },
                ]}
              >
                <Feather name="smartphone" size={16} color={themePreference === "system" ? Colors.light.primary : theme.textSecondary} />
                <ThemedText type="small" style={{ marginLeft: Spacing.sm, color: themePreference === "system" ? Colors.light.primary : theme.textSecondary }}>
                  Use System Setting
                </ThemedText>
              </AnimatedPress>
            </Card>

            <Card style={styles.sectionCard}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.lg }}>Notifications</ThemedText>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Feather name="bell" size={20} color={theme.text} />
                  <View style={styles.settingText}>
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

              <AnimatedPress
                onPress={() => setShowTimePicker(true)}
                style={[
                  styles.timePickerButton,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
                ]}
                testID="button-change-reminder-time"
              >
                <Feather name="clock" size={16} color={Colors.light.primary} />
                <ThemedText type="small" style={{ marginLeft: Spacing.sm, color: Colors.light.primary }}>
                  Change Reminder Time
                </ThemedText>
              </AnimatedPress>

              <View style={[styles.settingRow, { marginTop: Spacing.md }]}>
                <View style={styles.settingInfo}>
                  <Feather name="zap" size={20} color={theme.text} />
                  <View style={styles.settingText}>
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

            <Card style={styles.sectionCard}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.lg }}>Legal</ThemedText>

              <AnimatedPress
                // TODO: stand up privacy page on gbolofitness.com before launch
                onPress={() => WebBrowser.openBrowserAsync("https://gbolofitness.com/privacy")}
                style={styles.settingRow}
              >
                <View style={styles.settingInfo}>
                  <Feather name="shield" size={20} color={theme.text} />
                  <View style={styles.settingText}>
                    <ThemedText type="body">Privacy Policy</ThemedText>
                  </View>
                </View>
                <Feather name="external-link" size={18} color={theme.textSecondary} />
              </AnimatedPress>

              <AnimatedPress
                // TODO: stand up terms page on gbolofitness.com before launch
                onPress={() => WebBrowser.openBrowserAsync("https://gbolofitness.com/terms")}
                style={[styles.settingRow, { marginTop: Spacing.lg }]}
              >
                <View style={styles.settingInfo}>
                  <Feather name="file-text" size={20} color={theme.text} />
                  <View style={styles.settingText}>
                    <ThemedText type="body">Terms of Service</ThemedText>
                  </View>
                </View>
                <Feather name="external-link" size={18} color={theme.textSecondary} />
              </AnimatedPress>
            </Card>

            <Card style={styles.sectionCard}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.lg }}>Privacy & Data</ThemedText>

              <AnimatedPress
                onPress={() => navigation.navigate("BlockedUsers")}
                style={styles.settingRow}
              >
                <View style={styles.settingInfo}>
                  <Feather name="slash" size={20} color={theme.text} />
                  <View style={styles.settingText}>
                    <ThemedText type="body">Blocked Users</ThemedText>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </AnimatedPress>

              <AnimatedPress
                onPress={handleExportData}
                disabled={isExporting}
                style={[styles.settingRow, { marginTop: Spacing.lg, opacity: isExporting ? 0.5 : 1 }]}
              >
                <View style={styles.settingInfo}>
                  <Feather name="download" size={20} color={theme.text} />
                  <View style={styles.settingText}>
                    <ThemedText type="body">{isExporting ? "Exporting…" : "Export Data"}</ThemedText>
                    <ThemedText type="small" style={{ opacity: 0.6 }}>
                      Download a CSV of your workouts, runs, body weight, and nutrition history.
                    </ThemedText>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </AnimatedPress>
            </Card>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { flushTimeChange(); setShowTimePicker(false); }}
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
              onPress={() => { flushTimeChange(); setShowTimePicker(false); }}
              style={({ pressed }) => ({
                backgroundColor: Colors.light.primary,
                marginTop: Spacing.lg,
                alignSelf: "center" as const,
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.xl,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.md,
  },
  settingText: {
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
  modalTitle: {
    marginTop: Spacing.md,
    textAlign: "center",
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
