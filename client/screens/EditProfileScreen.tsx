import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [age, setAge] = useState(user?.age?.toString() || "");
  const [sex, setSex] = useState(user?.sex || "");
  const [heightCm, setHeightCm] = useState(user?.heightCm?.toString() || "");
  const [weightKg, setWeightKg] = useState(user?.weightKg?.toString() || "");
  const [experience, setExperience] = useState(user?.experience || "");
  const [goal, setGoal] = useState(user?.goal || "");
  const [activityLevel, setActivityLevel] = useState(user?.activityLevel || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("[EditProfile] User data:", JSON.stringify(user, null, 2));
    if (user) {
      setName(user.name || "");
      setAge(user.age?.toString() || "");
      setSex(user.sex || "");
      setHeightCm(user.heightCm?.toString() || "");
      setWeightKg(user.weightKg?.toString() || "");
      setExperience(user.experience || "");
      setGoal(user.goal || "");
      setActivityLevel(user.activityLevel || "");
      console.log("[EditProfile] Setting sex:", user.sex, "experience:", user.experience, "goal:", user.goal, "activityLevel:", user.activityLevel);
    }
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await updateProfile({
        name: name.trim(),
        age: age ? parseInt(age) : undefined,
        sex: sex || undefined,
        heightCm: heightCm ? parseFloat(heightCm) : undefined,
        weightKg: weightKg ? parseFloat(weightKg) : undefined,
        experience: experience || undefined,
        goal: goal || undefined,
        activityLevel: activityLevel || undefined,
      });
      navigation.goBack();
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      {error ? (
        <View style={[styles.errorBox, { backgroundColor: Colors.light.danger + "20" }]}>
          <ThemedText type="small" style={{ color: Colors.light.danger }}>
            {error}
          </ThemedText>
        </View>
      ) : null}

      <Card style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>Basic Info</ThemedText>
        
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
            <ThemedText type="small" style={styles.pickerLabel}>Sex</ThemedText>
            <View style={[styles.pickerContainer, { backgroundColor: theme.backgroundSecondary }]}>
              <Picker
                selectedValue={sex}
                onValueChange={setSex}
                style={[styles.picker, { color: theme.text }]}
              >
                <Picker.Item label="Select..." value="" />
                <Picker.Item label="Male" value="male" />
                <Picker.Item label="Female" value="female" />
              </Picker>
            </View>
          </View>
        </View>
      </Card>

      <Card style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>Body Metrics</ThemedText>
        
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
              value={weightKg}
              onChangeText={setWeightKg}
              placeholder="70"
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      </Card>

      <Card style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>Fitness Profile</ThemedText>
        
        <ThemedText type="small" style={styles.pickerLabel}>Experience Level</ThemedText>
        <View style={[styles.pickerContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Picker
            selectedValue={experience}
            onValueChange={setExperience}
            style={[styles.picker, { color: theme.text }]}
          >
            <Picker.Item label="Select..." value="" />
            <Picker.Item label="Beginner" value="beginner" />
            <Picker.Item label="Intermediate" value="intermediate" />
            <Picker.Item label="Advanced" value="advanced" />
          </Picker>
        </View>

        <ThemedText type="small" style={[styles.pickerLabel, { marginTop: Spacing.md }]}>Goal</ThemedText>
        <View style={[styles.pickerContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Picker
            selectedValue={goal}
            onValueChange={setGoal}
            style={[styles.picker, { color: theme.text }]}
          >
            <Picker.Item label="Select..." value="" />
            <Picker.Item label="Lose Fat" value="lose_fat" />
            <Picker.Item label="Gain Muscle" value="gain_muscle" />
            <Picker.Item label="Recomposition" value="recomposition" />
            <Picker.Item label="Maintain" value="maintain" />
          </Picker>
        </View>

        <ThemedText type="small" style={[styles.pickerLabel, { marginTop: Spacing.md }]}>Activity Level</ThemedText>
        <View style={[styles.pickerContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Picker
            selectedValue={activityLevel}
            onValueChange={setActivityLevel}
            style={[styles.picker, { color: theme.text }]}
          >
            <Picker.Item label="Select..." value="" />
            <Picker.Item label="1-2 days/week" value="1-2" />
            <Picker.Item label="3-4 days/week" value="3-4" />
            <Picker.Item label="5-6 days/week" value="5-6" />
          </Picker>
        </View>
      </Card>

      <Button onPress={handleSave} disabled={loading} style={styles.saveButton}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : "Save Changes"}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  section: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  pickerLabel: {
    marginBottom: Spacing.xs,
    opacity: 0.7,
  },
  pickerContainer: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  saveButton: {
    marginTop: Spacing.md,
  },
});
