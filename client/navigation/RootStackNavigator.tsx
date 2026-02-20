import React, { useState, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import OnboardingScreen from "@/screens/OnboardingScreen";
import EditRoutineScreen from "@/screens/EditRoutineScreen";
import SelectRoutineScreen from "@/screens/SelectRoutineScreen";
import ActiveWorkoutScreen from "@/screens/ActiveWorkoutScreen";
import WorkoutCompleteScreen from "@/screens/WorkoutCompleteScreen";
import RunCompleteScreen from "@/screens/RunCompleteScreen";
import AddFoodScreen from "@/screens/AddFoodScreen";
import FoodDetailScreen from "@/screens/FoodDetailScreen";
import WorkoutHistoryScreen from "@/screens/WorkoutHistoryScreen";
import WorkoutDetailScreen from "@/screens/WorkoutDetailScreen";
import EditMacrosScreen from "@/screens/EditMacrosScreen";
import RoutineTemplatesScreen from "@/screens/RoutineTemplatesScreen";
import GenerateRoutineScreen from "@/screens/GenerateRoutineScreen";
import LoginScreen from "@/screens/LoginScreen";
import RegisterScreen from "@/screens/RegisterScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "@/screens/ResetPasswordScreen";
import PhotoReviewScreen from "@/screens/PhotoReviewScreen";
import ExerciseHistoryScreen from "@/screens/ExerciseHistoryScreen";
import ExerciseLibraryScreen from "@/screens/ExerciseLibraryScreen";
import BarcodeScannerScreen from "@/screens/BarcodeScannerScreen";
import SocialFeedScreen from "@/screens/SocialFeedScreen";
import CreatePostScreen from "@/screens/CreatePostScreen";
import PostDetailScreen from "@/screens/PostDetailScreen";
import SocialProfileScreen from "@/screens/SocialProfileScreen";
import FollowListScreen from "@/screens/FollowListScreen";
import UserSearchScreen from "@/screens/UserSearchScreen";
import BlockedUsersScreen from "@/screens/BlockedUsersScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import RunDetailScreen from "@/screens/RunDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";
import * as storage from "@/lib/storage";


export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  Main: { screen?: string } | undefined;
  Onboarding: undefined;
  EditRoutine: { routineId?: string; prefillExercise?: { id: string; name: string; muscleGroup: string } };
  SelectRoutine: undefined;
  ActiveWorkout: { routineId: string };
  WorkoutComplete: { workoutId: string };
  RunComplete: { runId: string };
  AddFood: { prefill?: { name: string; calories: string; protein: string; carbs: string; fat: string } } | undefined;
  PhotoReview: { foods: any[]; imageUri: string; imageBase64?: string; mode?: string };
  FoodDetail: { entry: import("@/types").FoodLogEntry };
  WorkoutHistory: undefined;
  WorkoutDetail: { workoutId: string };
  RunDetail: { run: import("@/types").RunEntry };
  EditMacros: undefined;
  RoutineTemplates: undefined;
  GenerateRoutine: undefined;
  EditProfile: undefined;
  ExerciseHistory: { exerciseId: string; exerciseName: string };
  ExerciseLibrary: undefined;
  BarcodeScanner: undefined;
  SocialFeed: undefined;
  CreatePost: { prefill?: { postType: import("@/types").PostType; referenceId?: string; referenceData?: any } } | undefined;
  PostDetail: { postId: number };
  SocialProfile: { userId: number };
  FollowList: { userId: number; mode: "followers" | "following" };
  UserSearch: undefined;
  BlockedUsers: undefined;
  Notifications: undefined;
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
        <Stack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
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
        name="RunComplete"
        component={RunCompleteScreen}
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
        name="PhotoReview"
        component={PhotoReviewScreen}
        options={{
          headerTitle: "Review Food",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="FoodDetail"
        component={FoodDetailScreen}
        options={{
          headerTitle: "Food Details",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="WorkoutHistory"
        component={WorkoutHistoryScreen}
        options={{ headerTitle: "Activity Calendar" }}
      />
      <Stack.Screen
        name="WorkoutDetail"
        component={WorkoutDetailScreen}
        options={{ headerTitle: "Workout Details" }}
      />
      <Stack.Screen
        name="RunDetail"
        component={RunDetailScreen}
        options={{ headerTitle: "Run Details" }}
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
        name="GenerateRoutine"
        component={GenerateRoutineScreen}
        options={{ headerTitle: "Generate Routine" }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerTitle: "Edit Profile" }}
      />
      <Stack.Screen
        name="ExerciseHistory"
        component={ExerciseHistoryScreen}
        options={{ headerTitle: "Exercise History" }}
      />
      <Stack.Screen
        name="ExerciseLibrary"
        component={ExerciseLibraryScreen}
        options={{ headerTitle: "Exercise Library" }}
      />
      <Stack.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="SocialFeed"
        component={SocialFeedScreen}
        options={{ headerTitle: "Community" }}
      />
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{
          headerTitle: "New Post",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{ headerTitle: "Post" }}
      />
      <Stack.Screen
        name="SocialProfile"
        component={SocialProfileScreen}
        options={{ headerTitle: "Profile" }}
      />
      <Stack.Screen
        name="FollowList"
        component={FollowListScreen}
        options={{ headerTitle: "Followers" }}
      />
      <Stack.Screen
        name="UserSearch"
        component={UserSearchScreen}
        options={{ headerTitle: "Find People" }}
      />
      <Stack.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={{ headerTitle: "Blocked Users" }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerTitle: "Notifications" }}
      />
    </Stack.Navigator>
  );
}
