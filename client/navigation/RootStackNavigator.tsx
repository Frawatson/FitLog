import React, { useState, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import OnboardingScreen from "@/screens/OnboardingScreen";
import EditRoutineScreen from "@/screens/EditRoutineScreen";
import SelectRoutineScreen from "@/screens/SelectRoutineScreen";
import ActiveWorkoutScreen from "@/screens/ActiveWorkoutScreen";
import WorkoutCompleteScreen from "@/screens/WorkoutCompleteScreen";
import AddFoodScreen from "@/screens/AddFoodScreen";
import WorkoutHistoryScreen from "@/screens/WorkoutHistoryScreen";
import WorkoutDetailScreen from "@/screens/WorkoutDetailScreen";
import EditMacrosScreen from "@/screens/EditMacrosScreen";
import RoutineTemplatesScreen from "@/screens/RoutineTemplatesScreen";
import RunTrackerScreen from "@/screens/RunTrackerScreen";
import GenerateRoutineScreen from "@/screens/GenerateRoutineScreen";
import LoginScreen from "@/screens/LoginScreen";
import RegisterScreen from "@/screens/RegisterScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";
import * as storage from "@/lib/storage";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: { screen?: string } | undefined;
  Onboarding: undefined;
  EditRoutine: { routineId?: string };
  SelectRoutine: undefined;
  ActiveWorkout: { routineId: string };
  WorkoutComplete: { workoutId: string };
  AddFood: undefined;
  WorkoutHistory: undefined;
  WorkoutDetail: { workoutId: string };
  EditMacros: undefined;
  RoutineTemplates: undefined;
  RunTracker: undefined;
  GenerateRoutine: undefined;
  EditProfile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { user, loading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  
  useEffect(() => {
    checkOnboarding();
  }, [user]);
  
  const checkOnboarding = async () => {
    if (!user) {
      setOnboardingComplete(null);
      return;
    }
    const profile = await storage.getUserProfile();
    // Check if local profile exists and matches the current user
    // Also verify that the database user has completed their profile (has goal and activityLevel)
    const localProfileMatchesUser = profile?.email === user.email;
    const dbProfileComplete = user.goal && user.activityLevel;
    
    if (localProfileMatchesUser && profile?.onboardingCompleted) {
      setOnboardingComplete(true);
    } else if (dbProfileComplete) {
      // DB profile is complete but local storage doesn't match - user may have logged in on new device
      setOnboardingComplete(true);
    } else {
      setOnboardingComplete(false);
    }
  };
  
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  
  if (!user) {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    );
  }
  
  if (onboardingComplete === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  
  return (
    <Stack.Navigator
      screenOptions={screenOptions}
      initialRouteName={onboardingComplete ? "Main" : "Onboarding"}
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
        name="WorkoutDetail"
        component={WorkoutDetailScreen}
        options={{ headerTitle: "Workout Details" }}
      />
      <Stack.Screen
        name="EditMacros"
        component={EditMacrosScreen}
        options={{ headerTitle: "Macro Targets" }}
      />
      <Stack.Screen
        name="RoutineTemplates"
        component={RoutineTemplatesScreen}
        options={{ headerTitle: "Workout Templates" }}
      />
      <Stack.Screen
        name="RunTracker"
        component={RunTrackerScreen}
        options={{ headerTitle: "Run Tracker" }}
      />
      <Stack.Screen
        name="GenerateRoutine"
        component={GenerateRoutineScreen}
        options={{ headerTitle: "Generate Routine" }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerTitle: "Edit Profile" }}
      />
    </Stack.Navigator>
  );
}
