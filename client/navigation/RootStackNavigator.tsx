import React, { useState, useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  getStateFromPath,
  useNavigation,
  CommonActions,
} from "@react-navigation/native";
import type { NavigatorScreenParams } from "@react-navigation/native";
import { linking } from "@/navigation/linking";
import MainTabNavigator, {
  type MainTabParamList,
} from "@/navigation/MainTabNavigator";
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
import ExerciseLibraryScreen from "@/screens/ExerciseLibraryScreen";
import { lazyScreen } from "@/components/LazyScreen";

// Split out of the main bundle: ExerciseHistory drags react-native-
// chart-kit, BarcodeScanner drags expo-camera's web scanner. Neither is
// on the critical path of a typical session.
const ExerciseHistoryScreen = lazyScreen(
  () => import("@/screens/ExerciseHistoryScreen"),
);
const BarcodeScannerScreen = lazyScreen(
  () => import("@/screens/BarcodeScannerScreen"),
);
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
  ResetPassword: { email?: string } | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Onboarding: undefined;
  EditRoutine: {
    routineId?: string;
    prefillExercise?: { id: string; name: string; muscleGroup: string };
  };
  SelectRoutine: undefined;
  ActiveWorkout: { routineId: string };
  WorkoutComplete: { workoutId: string };
  RunComplete: { runId: string };
  // Flat primitives only — object params serialize into the web URL as
  // "[object Object]" and break on refresh. Large/structured payloads go
  // through lib/transientParams instead.
  AddFood:
    | {
        prefillName?: string;
        prefillCalories?: string;
        prefillProtein?: string;
        prefillCarbs?: string;
        prefillFat?: string;
        prefillServing?: string;
      }
    | undefined;
  // Payload (foods + image) travels via stashTransient("photoReview");
  // the old params pushed a multi-MB base64 image into the URL bar.
  PhotoReview: { mode?: string } | undefined;
  FoodDetail: { entryId: string };
  WorkoutHistory: undefined;
  WorkoutDetail: { workoutId: string };
  RunDetail: { runId: string };
  EditMacros: undefined;
  RoutineTemplates: undefined;
  GenerateRoutine: undefined;
  EditProfile: undefined;
  ExerciseHistory: { exerciseId: string; exerciseName: string };
  ExerciseLibrary: undefined;
  BarcodeScanner: undefined;
  SocialFeed: undefined;
  // Prefill travels via stashTransient("createPostPrefill") — the
  // referenceData object broke the URL on web.
  CreatePost: undefined;
  PostDetail: { postId: number };
  SocialProfile: { userId: number };
  FollowList: { userId: number; mode: "followers" | "following" };
  UserSearch: undefined;
  BlockedUsers: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Deep-link-after-auth (web): an unauthenticated visit to e.g. /community
// lands on Login, and after signing in the user used to end up on Home —
// the intended URL was forgotten the moment the auth navigator rendered.
// Capture it at module load; consumed once after login.
const PUBLIC_PATHS = new Set([
  "/",
  "/home",
  "/login",
  "/register",
  "/onboarding",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
]);

let pendingDeepLink: string | null =
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  !PUBLIC_PATHS.has(window.location.pathname)
    ? window.location.pathname + window.location.search
    : null;

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const navigation = useNavigation();
  const { user, loading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    checkOnboarding();
  }, [user]);

  // Whether the signed-out navigator was ever shown this session. Only
  // then does the captured deep link need restoring: when the app starts
  // already signed in, URL linking has opened the page itself, and
  // re-dispatching it reset navigation and loaded the screen twice.
  const sawSignedOutRef = React.useRef(false);
  if (!loading && !user) sawSignedOutRef.current = true;

  // Restore the captured deep link once the user is signed in and the
  // authenticated navigator is mounted.
  useEffect(() => {
    if (!user || !onboardingComplete || !pendingDeepLink) return;
    if (!sawSignedOutRef.current) {
      pendingDeepLink = null;
      return;
    }
    const path = pendingDeepLink.replace(/^\//, "");
    pendingDeepLink = null;
    try {
      const state = getStateFromPath(path, linking.config);
      if (state) {
        navigation.dispatch(CommonActions.reset(state));
      }
    } catch {
      // Unparseable path — stay on the default screen.
    }
  }, [user, onboardingComplete, navigation]);

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
