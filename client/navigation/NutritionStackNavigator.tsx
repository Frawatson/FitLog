import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
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
            <HeaderButton
              onPress={() => navigation.navigate("AddFood")}
            >
              <Feather name="plus" size={24} color={Colors.light.primary} />
            </HeaderButton>
          ),
        }}
      />
    </Stack.Navigator>
  );
}
