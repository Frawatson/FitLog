import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import type { Routine } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SelectRoutineScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  
  const [routines, setRoutines] = useState<Routine[]>([]);
  
  useEffect(() => {
    loadRoutines();
  }, []);
  
  const loadRoutines = async () => {
    const data = await storage.getRoutines();
    setRoutines(data);
  };
  
  const handleSelect = (routine: Routine) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.replace("ActiveWorkout", { routineId: routine.id });
  };
  
  const renderRoutine = ({ item }: { item: Routine }) => (
    <Card style={styles.routineCard} onPress={() => handleSelect(item)}>
      <View style={styles.routineContent}>
        <View style={styles.routineInfo}>
          <ThemedText type="h3">{item.name}</ThemedText>
          <ThemedText type="small" style={styles.exerciseCount}>
            {item.exercises.length} exercise{item.exercises.length !== 1 ? "s" : ""}
          </ThemedText>
        </View>
        <View style={[styles.playIcon, { backgroundColor: Colors.light.primary }]}>
          <Feather name="play" size={20} color="#FFFFFF" />
        </View>
      </View>
    </Card>
  );
  
  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      ListHeaderComponent={
        <View style={styles.header}>
          <ThemedText type="h2">Choose a Routine</ThemedText>
          <ThemedText type="body" style={styles.subtitle}>
            Select a workout to start training
          </ThemedText>
        </View>
      }
      data={routines}
      keyExtractor={(item) => item.id}
      renderItem={renderRoutine}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  subtitle: {
    opacity: 0.6,
    marginTop: Spacing.xs,
  },
  routineCard: {
    padding: Spacing.lg,
  },
  routineContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  routineInfo: {
    flex: 1,
  },
  exerciseCount: {
    opacity: 0.6,
    marginTop: Spacing.xs,
  },
  playIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
