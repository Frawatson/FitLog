import React from "react";
import { Pressable } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import NutritionScreen from "@/screens/NutritionScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

export type NutritionStackParamList = {
  Nutrition: undefined;
};

const Stack = createNativeStackNavigator<NutritionStackParamList>();

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export default function NutritionStackNavigator() {
  const screenOptions = useScreenOptions();
  const navigation = useNavigation<RootNavigation>();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Nutrition"
        component={NutritionScreen}
        options={{
          headerTitle: "Nutrition",
          headerRight: () => (
            <Pressable
              onPress={() => navigation.navigate("AddFood")}
              hitSlop={8}
            >
              <Feather name="plus" size={24} color={Colors.light.primary} />
            </Pressable>
          ),
        }}
      />
    </Stack.Navigator>
  );
}
