import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { syncToServer, syncWithRetry, isAuthenticated } from "@/lib/syncService";

const NOTIFICATION_SETTINGS_KEY = "@merge_notification_settings";
// Tracks the scheduled-notification ids per type so we can cancel each
// independently. Previously scheduleWorkoutReminder ran
// cancelAllScheduledNotificationsAsync which clobbered any other
// scheduled notification — so adding a streak reminder via the same
// pattern would have each toggle nuke the other.
const NOTIFICATION_IDS_KEY = "@merge_notification_ids";

type ScheduledKey = "workout" | "streak";

async function getScheduledIds(): Promise<Partial<Record<ScheduledKey, string>>> {
  try {
    const data = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

async function rememberId(key: ScheduledKey, id: string | null): Promise<void> {
  try {
    const ids = await getScheduledIds();
    if (id) {
      ids[key] = id;
    } else {
      delete ids[key];
    }
    await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(ids));
  } catch {
    // ignore — id tracking is best-effort
  }
}

async function cancelOne(key: ScheduledKey): Promise<void> {
  if (Platform.OS === "web") return;
  const ids = await getScheduledIds();
  const id = ids[key];
  if (id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // notification may have already fired or been cancelled — fine
    }
    await rememberId(key, null);
  }
}

export interface NotificationSettings {
  workoutReminders: boolean;
  streakAlerts: boolean;
  reminderTime: { hour: number; minute: number };
}

const defaultSettings: NotificationSettings = {
  workoutReminders: false,
  streakAlerts: false,
  reminderTime: { hour: 18, minute: 0 },
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    if (await isAuthenticated()) {
      const result = await syncToServer<any>("/api/notification-prefs", "GET");
      if (result.success && result.data) {
        const settings: NotificationSettings = {
          workoutReminders: result.data.workoutReminders ?? false,
          streakAlerts: result.data.streakAlerts ?? false,
          reminderTime: {
            hour: result.data.reminderHour ?? 18,
            minute: result.data.reminderMinute ?? 0,
          },
        };
        await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
        return settings;
      }
    }
    const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.log("Error loading notification settings:", error);
  }
  return defaultSettings;
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));

    if (await isAuthenticated()) {
      await syncWithRetry("/api/notification-prefs", "POST", {
        workoutReminders: settings.workoutReminders,
        streakAlerts: settings.streakAlerts,
        reminderHour: settings.reminderTime.hour,
        reminderMinute: settings.reminderTime.minute,
      });
    }
  } catch (error) {
    console.log("Error saving notification settings:", error);
  }
}

export async function scheduleWorkoutReminder(hour: number, minute: number): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    // Cancel only our previous workout-reminder id, not all
    // notifications — otherwise the streak reminder would be wiped
    // every time the workout reminder is (re)scheduled.
    await cancelOne("workout");

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time to work out!",
        body: "Don't break your streak. Let's crush today's workout.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    await rememberId("workout", id);
    return id;
  } catch (error) {
    console.log("Error scheduling workout reminder:", error);
    return null;
  }
}

export async function cancelWorkoutReminder(): Promise<void> {
  await cancelOne("workout");
}

// Daily "are you keeping your streak?" reminder. Scheduled at the same
// hour/minute as the workout reminder for v1 — the Settings UI exposes
// a single time. A future iteration could check whether the user
// actually logged something today before firing (needs a background
// task), but the daily ping at least respects the toggle.
export async function scheduleStreakReminder(hour: number, minute: number): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    await cancelOne("streak");
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Don't lose your streak!",
        body: "Log a workout, run, or meal today to keep your streak going.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    await rememberId("streak", id);
    return id;
  } catch (error) {
    console.log("Error scheduling streak reminder:", error);
    return null;
  }
}

export async function cancelStreakReminder(): Promise<void> {
  await cancelOne("streak");
}

export async function sendStreakReminderNotification(currentStreak: number): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Protect your streak!",
        body: `You're on a ${currentStreak}-day streak. Log a workout or run today to keep it going!`,
        sound: true,
      },
      trigger: null,
    });
  } catch (error) {
    console.log("Error sending streak notification:", error);
  }
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.log("Error canceling notifications:", error);
  }
}

// Full reset of this device's notification state — cancels every scheduled
// OS notification and wipes both AsyncStorage keys (settings + tracked
// ids). Called on logout / account-delete / cross-user login so reminders
// scheduled for user A don't continue firing under user B's session.
// Server-side prefs are preserved (re-pulled on next login).
export async function clearScheduledNotifications(): Promise<void> {
  if (Platform.OS !== "web") {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
      // best-effort — proceed to clear local state even if cancel fails
    }
  }
  try {
    await AsyncStorage.multiRemove([NOTIFICATION_IDS_KEY, NOTIFICATION_SETTINGS_KEY]);
  } catch {
    // best-effort
  }
}

export async function getScheduledNotifications() {
  if (Platform.OS === "web") {
    return [];
  }
  return Notifications.getAllScheduledNotificationsAsync();
}
