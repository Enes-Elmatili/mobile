import React, { useEffect, useRef } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";

interface XSpinnerProps {
  size?: number;
  color?: string;
  speed?: number; // ms per rotation
}

export function XSpinner({ size = 32, color = "#FFFFFF", speed = 700 }: XSpinnerProps) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: speed,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [speed]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

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
    <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
      <View style={[arm, { transform: [{ rotate: "45deg" }] }]} />
      <View style={[arm, { transform: [{ rotate: "-45deg" }] }]} />
    </Animated.View>
  );
}

// Full-screen loading overlay
export function XSpinnerOverlay({ color = "#FFFFFF" }: { color?: string }) {
  return (
    <View style={overlay.container}>
      <XSpinner size={48} color={color} />
    </View>
  );
}

const overlay = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0A0A0A",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
});