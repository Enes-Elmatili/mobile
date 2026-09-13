import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { darkTokens } from "@/hooks/use-app-theme";

interface XSpinnerProps {
  size?: number;
  color?: string;
  speed?: number; // ms per rotation
}

export function XSpinner({ size = 32, color = darkTokens.text, speed = 700 }: XSpinnerProps) {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = 0;
    spin.value = withRepeat(withTiming(1, { duration: speed, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(spin);
  }, [speed, spin]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  const thickness = size * 0.14;
  const arm = {
    position: "absolute" as const,
    width: size,
    height: thickness,
    backgroundColor: color,
    borderRadius: thickness / 2,
    top: size / 2 - thickness / 2,
    left: 0,
  };

  return (
    <Animated.View style={[{ width: size, height: size }, spinStyle]}>
      <View style={[arm, { transform: [{ rotate: "45deg" }] }]} />
      <View style={[arm, { transform: [{ rotate: "-45deg" }] }]} />
    </Animated.View>
  );
}

// Full-screen loading overlay
export function XSpinnerOverlay({ color = darkTokens.text }: { color?: string }) {
  return (
    <View style={overlay.container}>
      <XSpinner size={48} color={color} />
    </View>
  );
}

const overlay = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: darkTokens.bg,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
});