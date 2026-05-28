import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RunGoalScreen from "@/screens/RunGoalScreen";
import RunTrackerScreen from "@/screens/RunTrackerScreen";
import RunDetailScreen from "@/screens/RunDetailScreen";
import RunHistoryScreen from "@/screens/RunHistoryScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import type { RunEntry } from "@/types";

// Distance goals carry their own unit so the tracker doesn't have to
// guess from the user's current preference (which could have changed
// since the goal was set, and which loads async). Time goals are always
// minutes.
export type RunGoal =
  | { type: "distance"; value: number; unit: "mi" | "km" }
  | { type: "time"; value: number };

export type RunStackParamList = {
  RunGoal: undefined;
  RunTracker: { goal?: RunGoal };
  RunDetail: { run: RunEntry };
  RunHistory: undefined;
};

const Stack = createNativeStackNavigator<RunStackParamList>();

export default function RunStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions} initialRouteName="RunTracker">
      <Stack.Screen
        name="RunTracker"
        component={RunTrackerScreen}
        // Native header off — RunTrackerScreen renders a RetractableHeader.
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="RunGoal"
        component={RunGoalScreen}
        options={{ headerTitle: "Set Goal" }}
      />
      <Stack.Screen
        name="RunDetail"
        component={RunDetailScreen}
        options={{ headerTitle: "Run Details" }}
      />
      <Stack.Screen
        name="RunHistory"
        component={RunHistoryScreen}
        options={{ headerTitle: "All Runs" }}
      />
    </Stack.Navigator>
  );
}
