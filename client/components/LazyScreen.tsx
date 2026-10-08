import React, { Suspense, type ComponentType } from "react";
import { ActivityIndicator } from "react-native";

import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/theme";

// Wraps a dynamically imported screen in Suspense so Metro splits it out
// of the main bundle. Used for screens that drag heavy dependencies
// (react-native-chart-kit, expo-camera) that most sessions never open.
export function lazyScreen<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
): ComponentType<P> {
  const Inner = React.lazy(loader);

  function LazyScreenWrapper(props: P) {
    return (
      <Suspense
        fallback={
          <ThemedView
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </ThemedView>
        }
      >
        <Inner {...(props as any)} />
      </Suspense>
    );
  }

  return LazyScreenWrapper;
}
