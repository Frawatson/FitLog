import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RunGoalScreen from "@/screens/RunGoalScreen";
import RunTrackerScreen from "@/screens/RunTrackerScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RunGoal = {
  type: "distance" | "time";
  value: number;
};

export type RunStackParamList = {
  RunGoal: undefined;
  RunTracker: { goal?: RunGoal };
};

const Stack = createNativeStackNavigator<RunStackParamList>();

export default function RunStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions} initialRouteName="RunTracker">
      <Stack.Screen
        name="RunTracker"
        component={RunTrackerScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="RunGoal"
        component={RunGoalScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
