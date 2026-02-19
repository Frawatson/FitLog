import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ProfileScreen from "@/screens/ProfileScreen";
import ProgressChartsScreen from "@/screens/ProgressChartsScreen";
import AchievementsScreen from "@/screens/AchievementsScreen";
import ProgressPhotosScreen from "@/screens/ProgressPhotosScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ProfileStackParamList = {
  Profile: undefined;
  ProgressCharts: undefined;
  Achievements: undefined;
  ProgressPhotos: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: "Profile",
        }}
      />
      <Stack.Screen
        name="ProgressCharts"
        component={ProgressChartsScreen}
        options={{
          headerTitle: "Progress",
        }}
      />
      <Stack.Screen
        name="Achievements"
        component={AchievementsScreen}
        options={{
          headerTitle: "Achievements",
        }}
      />
      <Stack.Screen
        name="ProgressPhotos"
        component={ProgressPhotosScreen}
        options={{
          headerTitle: "Progress Photos",
        }}
      />
    </Stack.Navigator>
  );
}
