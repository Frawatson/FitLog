import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, Dimensions, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ACCENT_COLOR = "#FF4500";
const CONFETTI_COLORS = ["#FF4500", "#FFD700", "#00CED1", "#FF69B4", "#7CFC00", "#FF6347"];

interface RunCompleteAnimationProps {
  visible: boolean;
  distanceMiles: number;
  durationSeconds: number;
  goalReached: boolean;
  onDismiss: () => void;
}

interface ConfettiPiece {
  x: Animated.Value;
  y: Animated.Value;
  rotation: Animated.Value;
  scale: Animated.Value;
  color: string;
  startX: number;
}

export function RunCompleteAnimation({
  visible,
  distanceMiles,
  durationSeconds,
  goalReached,
  onDismiss,
}: RunCompleteAnimationProps) {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const confettiPieces = useRef<ConfettiPiece[]>([]);
  
  useEffect(() => {
    if (visible) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      const initialPositions = Array(20).fill(0).map(() => Math.random() * SCREEN_WIDTH);
      confettiPieces.current = initialPositions.map((startX) => ({
        x: new Animated.Value(startX),
        y: new Animated.Value(-50),
        rotation: new Animated.Value(0),
        scale: new Animated.Value(Math.random() * 0.5 + 0.5),
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        startX,
      }));
      
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
      
      setTimeout(() => {
        Animated.spring(checkmarkScale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }).start();
      }, 200);
      
      confettiPieces.current.forEach((piece, index) => {
        const delay = index * 50;
        Animated.parallel([
          Animated.timing(piece.y, {
            toValue: SCREEN_HEIGHT + 100,
            duration: 3000 + Math.random() * 2000,
            delay,
            easing: Easing.quad,
            useNativeDriver: true,
          }),
          Animated.timing(piece.x, {
            toValue: piece.startX + (Math.random() - 0.5) * 200,
            duration: 3000 + Math.random() * 2000,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(piece.rotation, {
            toValue: Math.random() * 10,
            duration: 3000 + Math.random() * 2000,
            delay,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      checkmarkScale.setValue(0);
    }
  }, [visible]);
  
  if (!visible) return null;
  
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  const pace = durationSeconds > 0 && distanceMiles > 0 
    ? (durationSeconds / 60) / distanceMiles 
    : 0;
  const formatPace = (paceMinPerMile: number): string => {
    if (!isFinite(paceMinPerMile) || paceMinPerMile === 0) return "--:--";
    const mins = Math.floor(paceMinPerMile);
    const secs = Math.round((paceMinPerMile - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  return (
    <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
      {confettiPieces.current.map((piece, index) => (
        <Animated.View
          key={index}
          style={[
            styles.confettiPiece,
            {
              backgroundColor: piece.color,
              transform: [
                { translateX: piece.x },
                { translateY: piece.y },
                { rotate: piece.rotation.interpolate({
                  inputRange: [0, 10],
                  outputRange: ["0deg", "3600deg"],
                })},
                { scale: piece.scale },
              ],
            },
          ]}
        />
      ))}
      
      <Animated.View
        style={[
          styles.card,
          { 
            backgroundColor: theme.backgroundDefault,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.checkmarkContainer,
            { transform: [{ scale: checkmarkScale }] }
          ]}
        >
          <View style={styles.checkmarkCircle}>
            <Feather name="check" size={48} color="#FFFFFF" />
          </View>
        </Animated.View>
        
        <ThemedText type="h1" style={styles.title}>
          {goalReached ? "Goal Reached!" : "Run Complete!"}
        </ThemedText>
        
        <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
          {goalReached ? "You crushed it!" : "Great workout!"}
        </ThemedText>
        
        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <ThemedText type="h2" style={styles.statValue}>
              {distanceMiles.toFixed(2)}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              miles
            </ThemedText>
          </View>
          
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          
          <View style={styles.stat}>
            <ThemedText type="h2" style={styles.statValue}>
              {formatDuration(durationSeconds)}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              duration
            </ThemedText>
          </View>
          
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          
          <View style={styles.stat}>
            <ThemedText type="h2" style={styles.statValue}>
              {formatPace(pace)}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              min/mi
            </ThemedText>
          </View>
        </View>
        
        <Button onPress={onDismiss} style={styles.doneButton}>
          Done
        </Button>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  confettiPiece: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  card: {
    width: "85%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  checkmarkContainer: {
    marginBottom: Spacing.xl,
  },
  checkmarkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: ACCENT_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: Spacing.xl,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    color: ACCENT_COLOR,
    marginBottom: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  doneButton: {
    width: "100%",
    backgroundColor: ACCENT_COLOR,
  },
});
