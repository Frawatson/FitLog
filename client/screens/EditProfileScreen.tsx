import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { AnimatedPress } from "@/components/AnimatedPress";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import * as storage from "@/lib/storage";
import { kgToLbs, lbsToKg, cmToFeetInches, feetInchesToCm } from "@/lib/units";
import type { UnitSystem } from "@/types";

const SEX_OPTIONS = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
];

const EXPERIENCE_OPTIONS = [
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
];

const GOAL_OPTIONS = [
  { label: "Lose Fat", value: "lose_fat" },
  { label: "Gain Muscle", value: "gain_muscle" },
  { label: "Recomp", value: "recomposition" },
  { label: "Maintain", value: "maintain" },
];

const ACTIVITY_OPTIONS = [
  { label: "1-2 days/wk", value: "1-2" },
  { label: "3-4 days/wk", value: "3-4" },
  { label: "5-6 days/wk", value: "5-6" },
];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, updateProfile } = useAuth();

  const [unitSystem, setUnitSystem] = useState<UnitSystem>("imperial");
  const [name, setName] = useState(user?.name || "");
  const [age, setAge] = useState(user?.age?.toString() || "");
  const [sex, setSex] = useState(user?.sex || "");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weight, setWeight] = useState("");
  const [weightGoal, setWeightGoal] = useState("");
  const [experience, setExperience] = useState(user?.experience || "");
  const [goal, setGoal] = useState(user?.goal || "");
  const [activityLevel, setActivityLevel] = useState(user?.activityLevel || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await storage.getUserProfile();
      if (profile?.unitSystem) {
        setUnitSystem(profile.unitSystem);
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setAge(user.age?.toString() || "");
      setSex(user.sex || "");

      if (user.heightCm) {
        if (unitSystem === "imperial") {
          const { feet, inches } = cmToFeetInches(user.heightCm);
          setHeightFeet(feet.toString());
          setHeightInches(inches.toString());
        } else {
          setHeightCm(user.heightCm.toString());
        }
      }

      if (user.weightKg) {
        if (unitSystem === "imperial") {
          setWeight(kgToLbs(user.weightKg).toString());
        } else {
          setWeight(user.weightKg.toString());
        }
      }

      if (user.weightGoalKg) {
        if (unitSystem === "imperial") {
          setWeightGoal(kgToLbs(user.weightGoalKg).toString());
        } else {
          setWeightGoal(user.weightGoalKg.toString());
        }
      }

      setExperience(user.experience || "");
      setGoal(user.goal || "");
      setActivityLevel(user.activityLevel || "");
    }
  }, [user, unitSystem]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let finalHeightCm: number | undefined;
      let finalWeightKg: number | undefined;
      let finalWeightGoalKg: number | undefined;

      if (unitSystem === "imperial") {
        if (heightFeet || heightInches) {
          finalHeightCm = feetInchesToCm(
            parseFloat(heightFeet) || 0,
            parseFloat(heightInches) || 0
          );
        }
        if (weight) {
          finalWeightKg = lbsToKg(parseFloat(weight));
        }
        if (weightGoal) {
          finalWeightGoalKg = lbsToKg(parseFloat(weightGoal));
        }
      } else {
        if (heightCm) {
          finalHeightCm = parseFloat(heightCm);
        }
        if (weight) {
          finalWeightKg = parseFloat(weight);
        }
        if (weightGoal) {
          finalWeightGoalKg = parseFloat(weightGoal);
        }
      }

      await updateProfile({
        name: name.trim(),
        age: age ? parseInt(age) : undefined,
        sex: sex || undefined,
        heightCm: finalHeightCm,
        weightKg: finalWeightKg,
        weightGoalKg: finalWeightGoalKg,
        experience: experience || undefined,
        goal: goal || undefined,
        activityLevel: activityLevel || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const renderChipGroup = (
    label: string,
    options: { label: string; value: string }[],
    selected: string,
    onSelect: (value: string) => void,
  ) => (
    <View style={styles.chipGroupContainer}>
      <ThemedText type="small" style={styles.chipLabel}>{label}</ThemedText>
      <View style={styles.chipGrid}>
        {options.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <AnimatedPress
              key={opt.value}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? Colors.light.primary : theme.backgroundSecondary,
                  borderColor: isSelected ? Colors.light.primary : theme.border,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(opt.value);
              }}
            >
              <ThemedText
                type="small"
                style={{ color: isSelected ? "#FFFFFF" : theme.text, fontWeight: isSelected ? "600" : "400" }}
              >
                {opt.label}
              </ThemedText>
            </AnimatedPress>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.lg,
        }}
      >
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: Colors.light.error + "20" }]}>
            <Feather name="alert-circle" size={16} color={Colors.light.error} />
            <ThemedText type="small" style={{ color: Colors.light.error, flex: 1 }}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="user" size={20} color={Colors.light.primary} />
            <ThemedText type="h4">Basic Info</ThemedText>
          </View>

          <Input
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Input
                label="Age"
                value={age}
                onChangeText={setAge}
                placeholder="25"
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.halfInput}>
              {renderChipGroup("Sex", SEX_OPTIONS, sex, setSex)}
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="activity" size={20} color={Colors.light.primary} />
            <ThemedText type="h4">Body Metrics</ThemedText>
          </View>

          {unitSystem === "imperial" ? (
            <>
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Input
                    label="Height (ft)"
                    value={heightFeet}
                    onChangeText={setHeightFeet}
                    placeholder="5"
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Input
                    label="Height (in)"
                    value={heightInches}
                    onChangeText={setHeightInches}
                    placeholder="10"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={[styles.row, { marginTop: Spacing.md }]}>
                <View style={styles.halfInput}>
                  <Input
                    label="Weight (lbs)"
                    value={weight}
                    onChangeText={setWeight}
                    placeholder="160"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Input
                    label="Goal Weight (lbs)"
                    value={weightGoal}
                    onChangeText={setWeightGoal}
                    placeholder="150"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Input
                    label="Height (cm)"
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder="175"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Input
                    label="Weight (kg)"
                    value={weight}
                    onChangeText={setWeight}
                    placeholder="70"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={{ marginTop: Spacing.md }}>
                <Input
                  label="Weight Goal (kg)"
                  value={weightGoal}
                  onChangeText={setWeightGoal}
                  placeholder="65"
                  keyboardType="decimal-pad"
                />
              </View>
            </>
          )}
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="target" size={20} color={Colors.light.primary} />
            <ThemedText type="h4">Fitness Profile</ThemedText>
          </View>

          {renderChipGroup("Experience Level", EXPERIENCE_OPTIONS, experience, setExperience)}
          {renderChipGroup("Goal", GOAL_OPTIONS, goal, setGoal)}
          {renderChipGroup("Activity Level", ACTIVITY_OPTIONS, activityLevel, setActivityLevel)}
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg, backgroundColor: theme.backgroundRoot, borderTopColor: theme.border }]}>
        <Button onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : "Save Changes"}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  section: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  chipGroupContainer: {
    marginBottom: Spacing.md,
  },
  chipLabel: {
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
});
