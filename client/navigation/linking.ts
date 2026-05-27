import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./RootStackNavigator";

// Build the list of URL prefixes the linker should match. Always include
// the custom scheme for native deep links; on web, the bundle's window
// origin handles same-origin URLs automatically. Production builds also
// match the public domain so emailed links resolve correctly.
function buildPrefixes(): string[] {
  const prefixes = ["merge://"];
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    prefixes.push(domain.startsWith("http") ? domain : `https://${domain}`);
  }
  return prefixes;
}

// URL ↔ Screen map. Every screen in RootStackParamList must be reachable
// from a URL (web) or deep link (native). Path params use :param syntax.
// Nested stacks are declared via a `screens` block so URLs like
// /profile/settings resolve to the right tab + child route.
//
// Path-collision note: React Navigation's matcher prefers literal segments
// over :param segments, so /workouts/active resolves to ActiveWorkout (not
// WorkoutDetail with workoutId="active"). Declaration order below doesn't
// affect this; the matcher specificity does. If you add a new
// /workouts/something literal path, you don't need to reorder anything.
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: buildPrefixes(),
  config: {
    screens: {
      // --- Unauthenticated ---
      Login: "login",
      Register: "register",
      Onboarding: "onboarding",
      ForgotPassword: "forgot-password",
      ResetPassword: "reset-password",

      // --- Authenticated tabs ---
      Main: {
        path: "",
        screens: {
          HomeTab: "home",
          RoutinesTab: {
            path: "routines",
            screens: { Routines: "" },
          },
          RunTab: {
            path: "run",
            screens: {
              RunTracker: "",
              RunGoal: "goal",
            },
          },
          NutritionTab: {
            path: "nutrition",
            screens: { Nutrition: "" },
          },
          ProfileTab: {
            path: "profile",
            screens: {
              Profile: "",
              ProgressCharts: "progress",
              Achievements: "achievements",
              Settings: "settings",
            },
          },
        },
      },

      // --- Top-level modals / detail screens ---
      EditRoutine: "routines/edit",
      SelectRoutine: "routines/select",
      RoutineTemplates: "routines/templates",
      GenerateRoutine: "routines/generate",

      ActiveWorkout: "workouts/active",
      WorkoutComplete: "workouts/complete",
      WorkoutHistory: "workouts/history",
      WorkoutDetail: "workouts/:workoutId",
      ExerciseHistory: "exercises/:exerciseId/history",
      ExerciseLibrary: "exercises",

      RunComplete: "runs/complete",
      RunDetail: "runs/detail",

      AddFood: "nutrition/add",
      PhotoReview: "nutrition/photo-review",
      FoodDetail: "nutrition/food-detail",
      EditMacros: "nutrition/macros",
      BarcodeScanner: "nutrition/scan",

      EditProfile: "profile/edit",
      BlockedUsers: "settings/blocked",

      SocialFeed: "community",
      CreatePost: "community/post",
      PostDetail: "posts/:postId",
      SocialProfile: "users/:userId",
      FollowList: "users/:userId/:mode",
      UserSearch: "community/search",

      Notifications: "notifications",
    },
  },
};

// Useful elsewhere — the canonical landing page when an authenticated user
// hits "/" with no other route hint.
export const HOME_URL = "/home";
