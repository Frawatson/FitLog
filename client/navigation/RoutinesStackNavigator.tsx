import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeaderButton } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import RoutinesScreen from "@/screens/RoutinesScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

export type RoutinesStackParamList = {
  Routines: undefined;
};

const Stack = createNativeStackNavigator<RoutinesStackParamList>();

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export default function RoutinesStackNavigator() {
  const screenOptions = useScreenOptions();
  const navigation = useNavigation<RootNavigation>();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Routines"
        component={RoutinesScreen}
        options={{
          headerTitle: "Routines",
          headerRight: () => (
            <HeaderButton
              onPress={() => navigation.navigate("EditRoutine", {})}
            >
              <Feather name="plus" size={24} color={Colors.light.primary} />
            </HeaderButton>
          ),
        }}
      />
    </Stack.Navigator>
  );
}
