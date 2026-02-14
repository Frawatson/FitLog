import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { AnimatedPress } from "@/components/AnimatedPress";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RunStackParamList } from "@/navigation/RunStackNavigator";

type NavigationProp = NativeStackNavigationProp<RunStackParamList>;

type GoalType = "free" | "distance" | "time";

const DISTANCE_OPTIONS = [1, 2, 3, 5, 10]; // miles
const TIME_OPTIONS = [15, 20, 30, 45, 60]; // minutes

const ACCENT_COLOR = "#FF4500";

export default function RunGoalScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  
  const [goalType, setGoalType] = useState<GoalType>("free");
  const [selectedDistance, setSelectedDistance] = useState(3);
  const [selectedTime, setSelectedTime] = useState(30);
  
  const handleStartRun = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    const goal = goalType === "free" 
      ? undefined 
      : goalType === "distance" 
        ? { type: "distance" as const, value: selectedDistance }
        : { type: "time" as const, value: selectedTime };
    
    navigation.navigate("RunTracker", { goal });
  };
  
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h2">Set Your Goal</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.goalTypeContainer}>
          <AnimatedPress
            onPress={() => {
              Haptics.selectionAsync();
              setGoalType("free");
            }}
            style={[
              styles.goalTypeCard,
              { 
                backgroundColor: goalType === "free" ? ACCENT_COLOR : theme.backgroundSecondary,
                borderColor: goalType === "free" ? ACCENT_COLOR : theme.border,
              }
            ]}
          >
            <Feather 
              name="wind" 
              size={32} 
              color={goalType === "free" ? "#FFFFFF" : theme.text} 
            />
            <ThemedText 
              type="h4" 
              style={[styles.goalTypeText, { color: goalType === "free" ? "#FFFFFF" : theme.text }]}
            >
              Free Run
            </ThemedText>
            <ThemedText 
              type="small" 
              style={{ color: goalType === "free" ? "rgba(255,255,255,0.8)" : theme.textSecondary }}
            >
              No goal, just run
            </ThemedText>
          </AnimatedPress>
          
          <View style={styles.goalTypeRow}>
            <AnimatedPress
              onPress={() => {
                Haptics.selectionAsync();
                setGoalType("distance");
              }}
              style={[
                styles.goalTypeCardSmall,
                { 
                  backgroundColor: goalType === "distance" ? ACCENT_COLOR : theme.backgroundSecondary,
                  borderColor: goalType === "distance" ? ACCENT_COLOR : theme.border,
                }
              ]}
            >
              <Feather 
                name="map-pin" 
                size={24} 
                color={goalType === "distance" ? "#FFFFFF" : theme.text} 
              />
              <ThemedText 
                type="body" 
                style={[styles.goalTypeText, { color: goalType === "distance" ? "#FFFFFF" : theme.text, fontWeight: "600" }]}
              >
                Distance
              </ThemedText>
            </AnimatedPress>
            
            <AnimatedPress
              onPress={() => {
                Haptics.selectionAsync();
                setGoalType("time");
              }}
              style={[
                styles.goalTypeCardSmall,
                { 
                  backgroundColor: goalType === "time" ? ACCENT_COLOR : theme.backgroundSecondary,
                  borderColor: goalType === "time" ? ACCENT_COLOR : theme.border,
                }
              ]}
            >
              <Feather 
                name="clock" 
                size={24} 
                color={goalType === "time" ? "#FFFFFF" : theme.text} 
              />
              <ThemedText 
                type="body" 
                style={[styles.goalTypeText, { color: goalType === "time" ? "#FFFFFF" : theme.text, fontWeight: "600" }]}
              >
                Time
              </ThemedText>
            </AnimatedPress>
          </View>
        </View>
        
        {goalType === "distance" ? (
          <View style={styles.optionsContainer}>
            <ThemedText type="h4" style={styles.optionsTitle}>
              Target Distance
            </ThemedText>
            <View style={styles.optionsRow}>
              {DISTANCE_OPTIONS.map((dist) => (
                <AnimatedPress
                  key={dist}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedDistance(dist);
                  }}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor: selectedDistance === dist ? ACCENT_COLOR : theme.backgroundSecondary,
                      borderColor: selectedDistance === dist ? ACCENT_COLOR : theme.border,
                    }
                  ]}
                >
                  <ThemedText 
                    type="h3" 
                    style={{ color: selectedDistance === dist ? "#FFFFFF" : theme.text }}
                  >
                    {dist}
                  </ThemedText>
                  <ThemedText 
                    type="small" 
                    style={{ color: selectedDistance === dist ? "rgba(255,255,255,0.8)" : theme.textSecondary }}
                  >
                    mi
                  </ThemedText>
                </AnimatedPress>
              ))}
            </View>
          </View>
        ) : null}
        
        {goalType === "time" ? (
          <View style={styles.optionsContainer}>
            <ThemedText type="h4" style={styles.optionsTitle}>
              Target Duration
            </ThemedText>
            <View style={styles.optionsRow}>
              {TIME_OPTIONS.map((time) => (
                <AnimatedPress
                  key={time}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedTime(time);
                  }}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor: selectedTime === time ? ACCENT_COLOR : theme.backgroundSecondary,
                      borderColor: selectedTime === time ? ACCENT_COLOR : theme.border,
                    }
                  ]}
                >
                  <ThemedText 
                    type="h3" 
                    style={{ color: selectedTime === time ? "#FFFFFF" : theme.text }}
                  >
                    {time}
                  </ThemedText>
                  <ThemedText 
                    type="small" 
                    style={{ color: selectedTime === time ? "rgba(255,255,255,0.8)" : theme.textSecondary }}
                  >
                    min
                  </ThemedText>
                </AnimatedPress>
              ))}
            </View>
          </View>
        ) : null}
        
        <View style={styles.footer}>
          <Button onPress={handleStartRun} style={styles.startButton}>
            <View style={styles.startButtonContent}>
              <Feather name="play" size={24} color="#FFFFFF" />
              <ThemedText style={styles.startButtonText}>
                {goalType === "free" 
                  ? "Start Free Run" 
                  : goalType === "distance" 
                    ? `Start ${selectedDistance} Mile Run`
                    : `Start ${selectedTime} Min Run`
                }
              </ThemedText>
            </View>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing["2xl"],
  },
  goalTypeContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  goalTypeCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    borderWidth: 2,
    gap: Spacing.sm,
  },
  goalTypeRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  goalTypeCardSmall: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    borderWidth: 2,
    gap: Spacing.xs,
  },
  goalTypeText: {
    textAlign: "center",
  },
  optionsContainer: {
    marginBottom: Spacing.xl,
  },
  optionsTitle: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  optionButton: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  footer: {
    marginTop: Spacing["2xl"],
  },
  startButton: {
    backgroundColor: ACCENT_COLOR,
  },
  startButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
