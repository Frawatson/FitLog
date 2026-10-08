import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Platform } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";

const ACCENT_COLOR = "#1B3A27"; // Brand.green

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
  // Leaflet module handle from the dynamic import. A static require()
  // here would pull Leaflet (~150 KB) into the main web bundle for every
  // visitor; keeping it behind import() means only the map screens pay.
  const leafletRef = useRef<any>(null);
  // Latest props, readable from the async loader without re-running it.
  const latestRef = useRef({ currentLocation, route });
  latestRef.current = { currentLocation, route };

  const makeMarkerIcon = (L: any) =>
    L.divIcon({
      className: "custom-marker",
      html: `<div style="width: 16px; height: 16px; background: ${ACCENT_COLOR}; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

  useEffect(() => {
    if (Platform.OS !== "web" || !mapContainerRef.current) return;

    let cancelled = false;

    const loadLeaflet = async () => {
      const L = await import("leaflet");
      // Unmounted while the import was in flight — don't leak a map
      // instance attached to a dead DOM node.
      if (cancelled || !mapContainerRef.current) return;
      leafletRef.current = L;

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

      // Read the props as of import completion, not mount time — the
      // first GPS fix often lands while Leaflet is still downloading.
      const { currentLocation: loc, route: path } = latestRef.current;

      const map = L.map(mapContainerRef.current!, {
        // No location yet: start zoomed way out on a neutral world view
        // instead of pretending the user is in New York. The first fix
        // snaps to street level via setView below.
        center: loc ? [loc.latitude, loc.longitude] : [20, 0],
        zoom: loc ? 15 : 2,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        // Required by OSM/CARTO tile usage policies.
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      mapInstanceRef.current = map;

      if (loc) {
        markerRef.current = L.marker([loc.latitude, loc.longitude], {
          icon: makeMarkerIcon(L),
        }).addTo(map);
      }

      if (path.length > 1) {
        const latLngs = path.map(point => [point.latitude, point.longitude] as [number, number]);
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
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    if (!L || !mapInstanceRef.current) return;

    if (currentLocation && markerRef.current) {
      markerRef.current.setLatLng([currentLocation.latitude, currentLocation.longitude]);
      mapInstanceRef.current.panTo([currentLocation.latitude, currentLocation.longitude]);
    } else if (currentLocation && !markerRef.current) {
      markerRef.current = L.marker(
        [currentLocation.latitude, currentLocation.longitude],
        { icon: makeMarkerIcon(L) },
      ).addTo(mapInstanceRef.current);
      // First fix after a locationless mount: jump from the world view to
      // the user's street instead of leaving their marker off-screen.
      mapInstanceRef.current.setView(
        [currentLocation.latitude, currentLocation.longitude],
        15,
      );
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
