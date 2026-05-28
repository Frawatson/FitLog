import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import NutritionScreen from "@/screens/NutritionScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type NutritionStackParamList = {
  Nutrition: undefined;
};

const Stack = createNativeStackNavigator<NutritionStackParamList>();

export default function NutritionStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Nutrition"
        component={NutritionScreen}
        // Native header off — NutritionScreen renders a RetractableHeader.
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
