import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";

const ACCENT_COLOR = "#FF4500";

interface MapDisplayProps {
  currentLocation: { latitude: number; longitude: number } | null;
  route: { latitude: number; longitude: number }[];
  mapRef?: React.RefObject<any>;
}

export function MapDisplay({ currentLocation, route, mapRef }: MapDisplayProps) {
  return (
    <View style={styles.mapPlaceholder}>
      <Feather name="navigation" size={40} color={ACCENT_COLOR} />
      <ThemedText type="small" style={styles.mapPlaceholderText}>
        {Platform.OS === "web" ? "Run in Expo Go to see the map" : "Getting your location..."}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  mapPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: "#0D1117",
  },
  mapPlaceholderText: {
    color: "#4A5568",
  },
});
