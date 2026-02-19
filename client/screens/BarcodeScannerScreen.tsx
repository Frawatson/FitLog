import React, { useState, useRef } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ScannedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  brand?: string;
  servingSize?: string;
}

export default function BarcodeScannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [isLooking, setIsLooking] = useState(false);
  const scannedRef = useRef(false);

  const lookupBarcode = async (barcode: string): Promise<ScannedFood | null> => {
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
      );
      if (!response.ok) return null;

      const data = await response.json();
      if (data.status !== 1 || !data.product) return null;

      const product = data.product;
      const nutrients = product.nutriments || {};

      return {
        name: product.product_name || product.generic_name || "Unknown Product",
        brand: product.brands || undefined,
        servingSize: product.serving_size || product.quantity || undefined,
        calories: Math.round(nutrients["energy-kcal_100g"] || nutrients["energy-kcal"] || 0),
        protein: Math.round(nutrients.proteins_100g || nutrients.proteins || 0),
        carbs: Math.round(nutrients.carbohydrates_100g || nutrients.carbohydrates || 0),
        fat: Math.round(nutrients.fat_100g || nutrients.fat || 0),
      };
    } catch {
      return null;
    }
  };

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scannedRef.current || isLooking) return;
    scannedRef.current = true;
    setIsLooking(true);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const food = await lookupBarcode(data);

    if (food) {
      navigation.navigate("AddFood", {
        prefill: {
          name: food.brand ? `${food.name} (${food.brand})` : food.name,
          calories: food.calories.toString(),
          protein: food.protein.toString(),
          carbs: food.carbs.toString(),
          fat: food.fat.toString(),
        },
      } as any);
    } else {
      Alert.alert(
        "Product Not Found",
        `Barcode ${data} was not found in the database. You can add the food manually.`,
        [
          {
            text: "Add Manually",
            onPress: () => navigation.navigate("AddFood"),
          },
          {
            text: "Scan Again",
            onPress: () => {
              scannedRef.current = false;
              setIsLooking(false);
            },
          },
        ]
      );
    }
  };

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <Feather name="camera-off" size={48} color={theme.textSecondary} />
        <ThemedText type="body" style={{ textAlign: "center", marginTop: Spacing.lg }}>
          Camera access is needed to scan barcodes
        </ThemedText>
        <Button onPress={requestPermission} style={{ marginTop: Spacing.xl }}>
          Grant Permission
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scannedRef.current ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
        }}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          {isLooking ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <ThemedText type="body" style={styles.hintText}>
                Looking up product...
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="body" style={styles.hintText}>
              Point camera at a barcode
            </ThemedText>
          )}
        </View>
      </View>

      {/* Close button */}
      <Pressable
        style={styles.closeButton}
        onPress={() => navigation.goBack()}
        hitSlop={12}
      >
        <Feather name="x" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const SCAN_AREA_SIZE = 280;
const CORNER_SIZE = 24;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overlayMiddle: {
    flexDirection: "row",
    height: SCAN_AREA_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    paddingTop: Spacing["2xl"],
  },
  hintText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  closeButton: {
    position: "absolute",
    top: 60,
    right: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: "#FFFFFF",
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: "#FFFFFF",
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: "#FFFFFF",
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: "#FFFFFF",
  },
});
