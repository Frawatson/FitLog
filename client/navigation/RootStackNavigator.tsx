import React, { useState, useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import OnboardingScreen from "@/screens/OnboardingScreen";
import EditRoutineScreen from "@/screens/EditRoutineScreen";
import SelectRoutineScreen from "@/screens/SelectRoutineScreen";
import ActiveWorkoutScreen from "@/screens/ActiveWorkoutScreen";
import WorkoutCompleteScreen from "@/screens/WorkoutCompleteScreen";
import AddFoodScreen from "@/screens/AddFoodScreen";
import WorkoutHistoryScreen from "@/screens/WorkoutHistoryScreen";
import EditMacrosScreen from "@/screens/EditMacrosScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import * as storage from "@/lib/storage";

export type RootStackParamList = {
  Main: { screen?: string } | undefined;
  Onboarding: undefined;
  EditRoutine: { routineId?: string };
  SelectRoutine: undefined;
  ActiveWorkout: { routineId: string };
  WorkoutComplete: { workoutId: string };
  AddFood: undefined;
  WorkoutHistory: undefined;
  EditMacros: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const [initialRoute, setInitialRoute] = useState<"Main" | "Onboarding" | null>(null);
  
  useEffect(() => {
    checkOnboarding();
  }, []);
  
  const checkOnboarding = async () => {
    const profile = await storage.getUserProfile();
    if (profile?.onboardingCompleted) {
      setInitialRoute("Main");
    } else {
      setInitialRoute("Onboarding");
    }
  };
  
  if (!initialRoute) {
    return null;
  }
  
  return (
    <Stack.Navigator
      screenOptions={screenOptions}
      initialRouteName={initialRoute}
    >
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditRoutine"
        component={EditRoutineScreen}
        options={{ headerTitle: "Edit Routine" }}
      />
      <Stack.Screen
        name="SelectRoutine"
        component={SelectRoutineScreen}
        options={{
          headerTitle: "Start Workout",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="ActiveWorkout"
        component={ActiveWorkoutScreen}
        options={{
          headerTitle: "Workout",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="WorkoutComplete"
        component={WorkoutCompleteScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="AddFood"
        component={AddFoodScreen}
        options={{
          headerTitle: "Add Food",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="WorkoutHistory"
        component={WorkoutHistoryScreen}
        options={{ headerTitle: "Workout History" }}
      />
      <Stack.Screen
        name="EditMacros"
        component={EditMacrosScreen}
        options={{ headerTitle: "Macro Targets" }}
      />
    </Stack.Navigator>
  );
}
