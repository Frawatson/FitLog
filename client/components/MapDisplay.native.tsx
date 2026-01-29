import React from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Polyline } from "react-native-maps";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";

const ACCENT_GREEN = "#00FF7F";

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
];

interface MapDisplayProps {
  currentLocation: { latitude: number; longitude: number } | null;
  route: { latitude: number; longitude: number }[];
  mapRef?: React.RefObject<MapView>;
}

export function MapDisplay({ currentLocation, route, mapRef }: MapDisplayProps) {
  if (!currentLocation) {
    return (
      <View style={styles.mapPlaceholder}>
        <Feather name="navigation" size={40} color={ACCENT_GREEN} />
        <ThemedText type="small" style={styles.mapPlaceholderText}>
          Getting your location...
        </ThemedText>
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      customMapStyle={DARK_MAP_STYLE}
      initialRegion={{
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      region={{
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
      pitchEnabled={false}
      rotateEnabled={false}
    >
      {route.length > 1 ? (
        <Polyline
          coordinates={route}
          strokeColor={ACCENT_GREEN}
          strokeWidth={4}
        />
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: "100%",
  },
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
