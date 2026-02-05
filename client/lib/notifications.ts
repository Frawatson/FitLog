import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const NOTIFICATION_SETTINGS_KEY = "@fitlog_notification_settings";

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
  } catch (error) {
    console.log("Error saving notification settings:", error);
  }
}

export async function scheduleWorkoutReminder(hour: number, minute: number): Promise<string | null> {
  if (Platform.OS === "web") {
    return null;
  }

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

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

    return id;
  } catch (error) {
    console.log("Error scheduling workout reminder:", error);
    return null;
  }
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

export async function getScheduledNotifications() {
  if (Platform.OS === "web") {
    return [];
  }
  return Notifications.getAllScheduledNotificationsAsync();
}
