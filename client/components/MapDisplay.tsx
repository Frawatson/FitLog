import React, { useEffect, useRef } from "react";
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

function WebMap({ currentLocation, route }: MapDisplayProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !mapContainerRef.current) return;

    const loadLeaflet = async () => {
      const L = await import("leaflet");
      
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      const defaultCenter: [number, number] = currentLocation 
        ? [currentLocation.latitude, currentLocation.longitude]
        : [40.7128, -74.006];

      const map = L.map(mapContainerRef.current!, {
        center: defaultCenter,
        zoom: 15,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      if (currentLocation) {
        const customIcon = L.divIcon({
          className: "custom-marker",
          html: `<div style="width: 16px; height: 16px; background: ${ACCENT_COLOR}; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        markerRef.current = L.marker([currentLocation.latitude, currentLocation.longitude], { icon: customIcon }).addTo(map);
      }

      if (route.length > 1) {
        const latLngs = route.map(point => [point.latitude, point.longitude] as [number, number]);
        routeLayerRef.current = L.polyline(latLngs, {
          color: ACCENT_COLOR,
          weight: 4,
          opacity: 0.8,
        }).addTo(map);
        map.fitBounds(routeLayerRef.current.getBounds(), { padding: [20, 20] });
      }
    };

    loadLeaflet();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const L = require("leaflet");

    if (currentLocation && markerRef.current) {
      markerRef.current.setLatLng([currentLocation.latitude, currentLocation.longitude]);
      mapInstanceRef.current.panTo([currentLocation.latitude, currentLocation.longitude]);
    } else if (currentLocation && !markerRef.current) {
      const customIcon = L.divIcon({
        className: "custom-marker",
        html: `<div style="width: 16px; height: 16px; background: ${ACCENT_COLOR}; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      markerRef.current = L.marker([currentLocation.latitude, currentLocation.longitude], { icon: customIcon }).addTo(mapInstanceRef.current);
    }

    if (route.length > 1) {
      if (routeLayerRef.current) {
        routeLayerRef.current.setLatLngs(route.map(point => [point.latitude, point.longitude]));
      } else {
        routeLayerRef.current = L.polyline(
          route.map(point => [point.latitude, point.longitude]),
          { color: ACCENT_COLOR, weight: 4, opacity: 0.8 }
        ).addTo(mapInstanceRef.current);
      }
    }
  }, [currentLocation, route]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ width: "100%", height: "100%", backgroundColor: "#0D1117" }}
    />
  );
}

function NativePlaceholder() {
  return (
    <View style={styles.mapPlaceholder}>
      <Feather name="navigation" size={40} color={ACCENT_COLOR} />
      <ThemedText type="small" style={styles.mapPlaceholderText}>
        Getting your location...
      </ThemedText>
    </View>
  );
}

export function MapDisplay({ currentLocation, route, mapRef }: MapDisplayProps) {
  if (Platform.OS === "web") {
    return <WebMap currentLocation={currentLocation} route={route} mapRef={mapRef} />;
  }
  
  return <NativePlaceholder />;
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
