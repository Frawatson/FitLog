import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { v4 as uuidv4 } from "uuid";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { ROUTINE_TEMPLATES, RoutineTemplate } from "@/lib/routineTemplates";
import * as storage from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type FilterCategory = "all" | "full_body" | "upper_lower" | "ppl" | "bro_split";

export default function RoutineTemplatesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<RoutineTemplate | null>(null);
  
  const filteredTemplates = filter === "all"
    ? ROUTINE_TEMPLATES
    : ROUTINE_TEMPLATES.filter((t) => t.category === filter);
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "#22C55E";
      case "intermediate":
        return Colors.light.primary;
      case "advanced":
        return "#EF4444";
      default:
        return theme.text;
    }
  };
  
  const handleAddTemplate = async (template: RoutineTemplate) => {
    const routine = {
      id: uuidv4(),
      name: template.name,
      exercises: template.exercises,
      createdAt: new Date().toISOString(),
    };
    
    await storage.saveRoutine(routine);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    navigation.goBack();
  };
  
  const renderFilter = (category: FilterCategory, label: string) => (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        setFilter(category);
      }}
      style={[
        styles.filterChip,
        {
          backgroundColor: filter === category ? Colors.light.primary : theme.backgroundElevated,
        },
      ]}
    >
      <ThemedText
        type="small"
        style={{ color: filter === category ? "#FFFFFF" : theme.text, fontWeight: "600" }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
  
  const renderTemplate = ({ item }: { item: RoutineTemplate }) => (
    <Card 
      style={styles.templateCard}
      onPress={() => {
        Haptics.selectionAsync();
        setSelectedTemplate(selectedTemplate?.id === item.id ? null : item);
      }}
    >
      <View style={styles.templateHeader}>
          <View style={styles.templateTitleRow}>
            <ThemedText type="h3">{item.name}</ThemedText>
            <View
              style={[
                styles.difficultyBadge,
                { backgroundColor: getDifficultyColor(item.difficulty) + "20" },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: getDifficultyColor(item.difficulty), fontWeight: "600" }}
              >
                {item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)}
              </ThemedText>
            </View>
          </View>
          <ThemedText type="body" style={styles.templateDescription}>
            {item.description}
          </ThemedText>
          <View style={styles.templateMeta}>
            <View style={styles.metaItem}>
              <Feather name="calendar" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={styles.metaText}>
                {item.daysPerWeek} days/week
              </ThemedText>
            </View>
            <View style={styles.metaItem}>
              <Feather name="list" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={styles.metaText}>
                {item.exercises.length} exercises
              </ThemedText>
            </View>
          </View>
        </View>
        
        {selectedTemplate?.id === item.id ? (
          <View style={styles.expandedSection}>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ThemedText type="h4" style={styles.exercisesTitle}>
              Exercises
            </ThemedText>
            {item.exercises.map((exercise, index) => (
              <View key={exercise.exerciseId} style={styles.exerciseRow}>
                <View style={[styles.exerciseNumber, { backgroundColor: Colors.light.primary }]}>
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    {index + 1}
                  </ThemedText>
                </View>
                <ThemedText type="body">{exercise.exerciseName}</ThemedText>
              </View>
            ))}
            <Button
              onPress={() => handleAddTemplate(item)}
              style={styles.addButton}
            >
              Add to My Routines
            </Button>
          </View>
        ) : null}
    </Card>
  );
  
  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      ListHeaderComponent={
        <View style={styles.filtersContainer}>
          {renderFilter("all", "All")}
          {renderFilter("full_body", "Full Body")}
          {renderFilter("upper_lower", "Upper/Lower")}
          {renderFilter("ppl", "Push/Pull/Legs")}
          {renderFilter("bro_split", "Bro Split")}
        </View>
      }
      data={filteredTemplates}
      keyExtractor={(item) => item.id}
      renderItem={renderTemplate}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filtersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  templateCard: {
    padding: Spacing.lg,
  },
  templateHeader: {
    gap: Spacing.xs,
  },
  templateTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  difficultyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  templateDescription: {
    opacity: 0.7,
  },
  templateMeta: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  metaText: {
    opacity: 0.6,
  },
  expandedSection: {
    marginTop: Spacing.md,
  },
  divider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  exercisesTitle: {
    marginBottom: Spacing.sm,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  exerciseNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    marginTop: Spacing.md,
  },
});
