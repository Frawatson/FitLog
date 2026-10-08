import "react-native-get-random-values";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
// Weight-specific subpath imports, NOT the package barrel. The barrel
// re-exports (and therefore bundles) all 18 Montserrat weights + italics —
// about 6 MB of fonts in the web export for the 3 weights we use.
import { useFonts } from "@expo-google-fonts/montserrat/useFonts";
import { Montserrat_400Regular } from "@expo-google-fonts/montserrat/400Regular";
import { Montserrat_600SemiBold } from "@expo-google-fonts/montserrat/600SemiBold";
import { Montserrat_700Bold } from "@expo-google-fonts/montserrat/700Bold";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { linking } from "@/navigation/linking";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SystemMenuRoot } from "@/components/SystemMenu";
import { WebInstallPrompt } from "@/components/WebInstallPrompt";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <SafeAreaProvider>
              <GestureHandlerRootView style={styles.root}>
                <KeyboardProvider>
                  <NavigationContainer
                    linking={linking}
                    documentTitle={{
                      formatter: (options, route) => {
                        // Most screens set headerTitle, not title — without
                        // this fallback the browser tab showed internal
                        // route names like "EditRoutine · Gbolo".
                        const headerTitle =
                          typeof options?.headerTitle === "string"
                            ? options.headerTitle
                            : undefined;
                        const label =
                          options?.title ?? headerTitle ?? route?.name;
                        return label
                          ? `${label} · Gbolo`
                          : "Gbolo Fitness and Nutrition";
                      },
                    }}
                  >
                    <RootStackNavigator />
                  </NavigationContainer>
                  <SystemMenuRoot />
                  <WebInstallPrompt />
                  <StatusBar style="auto" />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </SafeAreaProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
