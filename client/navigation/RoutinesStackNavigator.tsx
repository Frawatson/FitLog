import React from "react";
import { Pressable } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import RoutinesScreen from "@/screens/RoutinesScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
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
  const { theme } = useTheme();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Routines"
        component={RoutinesScreen}
        options={{
          headerTitle: "Routines",
          headerRight: () => (
            <Pressable
              onPress={() => navigation.navigate("EditRoutine", {})}
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
