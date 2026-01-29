import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { UserProfile, Sex, TrainingExperience, FitnessGoal, ActivityLevel, MacroTargets } from "@/types";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const GOALS: { value: FitnessGoal; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "lose_fat", label: "Lose Fat", icon: "trending-down" },
  { value: "gain_muscle", label: "Gain Muscle", icon: "trending-up" },
  { value: "recomposition", label: "Recomposition", icon: "refresh-cw" },
  { value: "maintain", label: "Maintain", icon: "minus" },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user, register, updateProfile } = useAuth();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [experience, setExperience] = useState<TrainingExperience>("beginner");
  const [goal, setGoal] = useState<FitnessGoal>("gain_muscle");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("3-4");
  const [macros, setMacros] = useState<MacroTargets | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const needsAccountCreation = !user;
  
  const handleNext = async () => {
    setError("");
    
    if (step === 1 && needsAccountCreation) {
      if (!name.trim()) {
        setError("Please enter your name");
        return;
      }
      if (!email.trim()) {
        setError("Please enter your email");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      
      setLoading(true);
      try {
        await register(email.trim(), password, name.trim());
      } catch (err: any) {
        setError(err.message || "Failed to create account");
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 4) {
      const profile: UserProfile = {
        id: uuidv4(),
        name: name.trim() || user?.name || "User",
        email: email.trim() || user?.email || "",
        age: parseInt(age) || 25,
        sex,
        heightCm: parseInt(heightCm) || 170,
        weightKg: parseInt(weightKg) || 70,
        experience,
        goal,
        activityLevel,
        onboardingCompleted: false,
        createdAt: new Date().toISOString(),
      };
      const calculated = storage.calculateMacros(profile);
      setMacros(calculated);
    }
    setStep(step + 1);
  };
  
  const handleFinish = async () => {
    setLoading(true);
    try {
      await updateProfile({
        name: name.trim() || user?.name,
        age: parseInt(age) || undefined,
        sex,
        heightCm: parseInt(heightCm) || undefined,
        weightKg: parseInt(weightKg) || undefined,
        experience,
        goal,
        activityLevel,
      });
    } catch (err) {
      console.log("Failed to update profile in database:", err);
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const profile: UserProfile = {
      id: uuidv4(),
      name: name.trim() || user?.name || "User",
      email: email.trim() || user?.email || "",
      age: parseInt(age) || 25,
      sex,
      heightCm: parseInt(heightCm) || 170,
      weightKg: parseInt(weightKg) || 70,
      experience,
      goal,
      activityLevel,
      onboardingCompleted: true,
      createdAt: new Date().toISOString(),
    };
    await storage.saveUserProfile(profile);
    if (macros) {
      await storage.saveMacroTargets(macros);
    }
    // Save initial body weight to weight tracking history
    const initialWeight = parseInt(weightKg);
    if (initialWeight > 0) {
      await storage.addBodyWeight(initialWeight);
    }
    setLoading(false);
    navigation.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
  };
  
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h1" style={styles.stepTitle}>
        {needsAccountCreation ? "Create Your Account" : "Welcome Back"}
      </ThemedText>
      <ThemedText type="body" style={styles.stepDescription}>
        {needsAccountCreation ? "Set up your login credentials" : "Let's complete your profile setup"}
      </ThemedText>
      
      {error ? (
        <View style={[styles.errorBox, { backgroundColor: Colors.light.danger + "20" }]}>
          <ThemedText type="small" style={{ color: Colors.light.danger }}>
            {error}
          </ThemedText>
        </View>
      ) : null}
      
      {needsAccountCreation ? (
        <>
          <Input
            label="Full Name"
            placeholder="John Doe"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          
          <Input
            label="Email"
            placeholder="john@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <Input
            label="Password"
            placeholder="Create a password (min 6 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <Input
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </>
      ) : (
        <View style={styles.welcomeBack}>
          <View style={[styles.avatar, { backgroundColor: Colors.light.primary }]}>
            <Feather name="user" size={40} color="#FFFFFF" />
          </View>
          <ThemedText type="h3" style={{ marginTop: Spacing.md }}>
            {user?.name}
          </ThemedText>
          <ThemedText type="body" style={{ opacity: 0.6 }}>
            {user?.email}
          </ThemedText>
        </View>
      )}
    </View>
  );
  
  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h1" style={styles.stepTitle}>
        Tell us about yourself
      </ThemedText>
      <ThemedText type="body" style={styles.stepDescription}>
        This helps us calculate your targets
      </ThemedText>
      
      <Input
        label="Age"
        placeholder="25"
        keyboardType="number-pad"
        value={age}
        onChangeText={setAge}
      />
      
      <ThemedText type="small" style={styles.fieldLabel}>
        Sex
      </ThemedText>
      <SegmentedControl
        options={["Male", "Female"]}
        selectedIndex={sex === "male" ? 0 : 1}
        onChange={(index) => setSex(index === 0 ? "male" : "female")}
      />
      
      <View style={styles.spacer} />
      
      <Input
        label="Height (cm)"
        placeholder="170"
        keyboardType="number-pad"
        value={heightCm}
        onChangeText={setHeightCm}
      />
      
      <Input
        label="Current Weight (kg)"
        placeholder="70"
        keyboardType="number-pad"
        value={weightKg}
        onChangeText={setWeightKg}
      />
      
      <ThemedText type="small" style={styles.fieldLabel}>
        Training Experience
      </ThemedText>
      <SegmentedControl
        options={["Beginner", "Intermediate", "Advanced"]}
        selectedIndex={experience === "beginner" ? 0 : experience === "intermediate" ? 1 : 2}
        onChange={(index) =>
          setExperience(
            index === 0 ? "beginner" : index === 1 ? "intermediate" : "advanced"
          )
        }
      />
    </View>
  );
  
  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h1" style={styles.stepTitle}>
        What's your goal?
      </ThemedText>
      <ThemedText type="body" style={styles.stepDescription}>
        We'll adjust your nutrition targets accordingly
      </ThemedText>
      
      <View style={styles.goalGrid}>
        {GOALS.map((g) => {
          const isSelected = goal === g.value;
          return (
            <Pressable
              key={g.value}
              onPress={() => {
                Haptics.selectionAsync();
                setGoal(g.value);
              }}
              style={[
                styles.goalCard,
                {
                  backgroundColor: isSelected
                    ? Colors.light.primary
                    : theme.backgroundDefault,
                  borderColor: isSelected ? Colors.light.primary : theme.border,
                },
              ]}
            >
              <Feather
                name={g.icon}
                size={32}
                color={isSelected ? "#FFFFFF" : theme.text}
              />
              <ThemedText
                type="h4"
                style={[
                  styles.goalLabel,
                  { color: isSelected ? "#FFFFFF" : theme.text },
                ]}
              >
                {g.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
  
  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h1" style={styles.stepTitle}>
        How often do you train?
      </ThemedText>
      <ThemedText type="body" style={styles.stepDescription}>
        This affects your calorie targets
      </ThemedText>
      
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setActivityLevel("3-4");
        }}
        style={[
          styles.activityCard,
          {
            backgroundColor:
              activityLevel === "3-4" ? Colors.light.primary : theme.backgroundDefault,
            borderColor:
              activityLevel === "3-4" ? Colors.light.primary : theme.border,
          },
        ]}
      >
        <ThemedText
          type="h3"
          style={{
            color: activityLevel === "3-4" ? "#FFFFFF" : theme.text,
          }}
        >
          3-4 days / week
        </ThemedText>
        <ThemedText
          type="small"
          style={{
            color: activityLevel === "3-4" ? "#FFFFFF" : theme.textSecondary,
            marginTop: Spacing.xs,
          }}
        >
          Moderate training volume
        </ThemedText>
      </Pressable>
      
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setActivityLevel("5-6");
        }}
        style={[
          styles.activityCard,
          {
            backgroundColor:
              activityLevel === "5-6" ? Colors.light.primary : theme.backgroundDefault,
            borderColor:
              activityLevel === "5-6" ? Colors.light.primary : theme.border,
          },
        ]}
      >
        <ThemedText
          type="h3"
          style={{
            color: activityLevel === "5-6" ? "#FFFFFF" : theme.text,
          }}
        >
          5-6 days / week
        </ThemedText>
        <ThemedText
          type="small"
          style={{
            color: activityLevel === "5-6" ? "#FFFFFF" : theme.textSecondary,
            marginTop: Spacing.xs,
          }}
        >
          High training volume
        </ThemedText>
      </Pressable>
    </View>
  );
  
  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h1" style={styles.stepTitle}>
        Your Targets
      </ThemedText>
      <ThemedText type="body" style={styles.stepDescription}>
        Based on your profile, here are your daily targets
      </ThemedText>
      
      {macros ? (
        <View style={styles.macroGrid}>
          <View style={[styles.macroCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h1" style={{ color: Colors.light.primary }}>
              {macros.calories}
            </ThemedText>
            <ThemedText type="small">Calories</ThemedText>
          </View>
          <View style={[styles.macroCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h1" style={{ color: Colors.light.success }}>
              {macros.protein}g
            </ThemedText>
            <ThemedText type="small">Protein</ThemedText>
          </View>
          <View style={[styles.macroCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h1" style={{ color: "#FFA500" }}>
              {macros.carbs}g
            </ThemedText>
            <ThemedText type="small">Carbs</ThemedText>
          </View>
          <View style={[styles.macroCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h1" style={{ color: "#9B59B6" }}>
              {macros.fat}g
            </ThemedText>
            <ThemedText type="small">Fat</ThemedText>
          </View>
        </View>
      ) : null}
      
      <ThemedText type="small" style={styles.disclaimer}>
        You can adjust these targets anytime in Settings
      </ThemedText>
    </View>
  );
  
  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing["2xl"] }]}>
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4, 5].map((s) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              {
                backgroundColor:
                  s <= step ? Colors.light.primary : theme.backgroundSecondary,
              },
            ]}
          />
        ))}
      </View>
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
      </ScrollView>
      
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.footerButtons}>
          {step > 1 ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStep(step - 1);
              }}
              style={[styles.backButton, { borderColor: theme.border }]}
            >
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
          ) : null}
          
          {step < 5 ? (
            <Button onPress={handleNext} disabled={loading} style={[styles.button, step > 1 ? styles.buttonWithBack : null]}>
              {loading ? "Creating Account..." : (step === 1 && needsAccountCreation ? "Create Account & Continue" : "Next")}
            </Button>
          ) : (
            <Button onPress={handleFinish} disabled={loading} style={[styles.button, step > 1 ? styles.buttonWithBack : null]}>
              {loading ? "Saving..." : "Start Training"}
            </Button>
          )}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    marginBottom: Spacing.sm,
  },
  stepDescription: {
    opacity: 0.7,
    marginBottom: Spacing["2xl"],
  },
  fieldLabel: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  spacer: {
    height: Spacing.lg,
  },
  goalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  goalCard: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  goalLabel: {
    marginTop: Spacing.md,
    textAlign: "center",
  },
  activityCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
  },
  macroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  macroCard: {
    width: "47%",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  disclaimer: {
    textAlign: "center",
    opacity: 0.6,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  footerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    flex: 1,
  },
  buttonWithBack: {
    flex: 1,
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  welcomeBack: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
