import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import RoutinesScreen from "@/screens/RoutinesScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RoutinesStackParamList = {
  Routines: undefined;
};

const Stack = createNativeStackNavigator<RoutinesStackParamList>();

export default function RoutinesStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Routines"
        component={RoutinesScreen}
        // Native header disabled — RoutinesScreen renders its own
        // <RetractableHeader/> that slides on scroll. The "+" action is
        // re-implemented on that header.
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
