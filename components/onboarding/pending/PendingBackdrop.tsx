// components/onboarding/pending/PendingBackdrop.tsx — grille + halo de l'écran d'attente
import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";
import { darkTokens } from "@/hooks/use-app-theme";
import { alpha } from "@/components/auth";
import { useLayoutClass } from "@/lib/layout";
import type { useGlow } from "@/lib/motion/useLoops";
import { C } from "./pendingTheme";

const GRID_SIZE = 40;

function GridLines() {
  // Réactif : au dépliage la grille couvre le nouvel écran (Dimensions.get était lu une fois au chargement).
  const { width: SCREEN_W, height: SCREEN_H } = useLayoutClass();
  const cols = Math.ceil(SCREEN_W / GRID_SIZE) + 1;
  const rows = Math.ceil(SCREEN_H / GRID_SIZE) + 1;
  const stroke = alpha(darkTokens.text, 0.025);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
        {Array.from({ length: cols }, (_, i) => (
          <Line key={`v${i}`} x1={i * GRID_SIZE} y1={0} x2={i * GRID_SIZE} y2={SCREEN_H} stroke={stroke} strokeWidth={1} />
        ))}
        {Array.from({ length: rows }, (_, i) => (
          <Line key={`h${i}`} x1={0} y1={i * GRID_SIZE} x2={SCREEN_W} y2={i * GRID_SIZE} stroke={stroke} strokeWidth={1} />
        ))}
      </Svg>
      <LinearGradient
        colors={["transparent", "transparent", C.bg]}
        locations={[0, 0.35, 0.75]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />
    </View>
  );
}

/** Grille puis halo qui respire — même ordre dans les deux branches de l'écran. */
export function PendingBackdrop({ screenWidth, glowStyle }: {
  screenWidth: number;
  glowStyle: ReturnType<typeof useGlow>;
}) {
  return (
    <>
      <GridLines />
      <Animated.View style={[s.glowWrap, { left: (screenWidth - 420) / 2 }, glowStyle]}>
        <LinearGradient
          colors={[alpha(darkTokens.text, 0.025), "transparent"]}
          style={s.glowGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>
    </>
  );
}

const s = StyleSheet.create({
  glowWrap: {
    position: "absolute", top: -80,
    width: 420, height: 420,
  },
  glowGradient: { width: "100%", height: "100%", borderRadius: 210 },
});
