// components/quote/primitives.tsx — Briques de la revue de devis :
// micro-label mono, entrée échelonnée (Reveal) et sceau d'acceptation.
import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { MOTION, usePresence, useTraceStroke } from "@/lib/motion";
import { FONTS } from "@/hooks/use-app-theme";

/** Micro-label mono uppercase — signature typographique FIXED. */
export function MonoLabel({ children, color, size = 10.5 }: { children: React.ReactNode; color: string; size?: number }) {
  return (
    <Text style={{ fontFamily: FONTS.mono, fontSize: size, letterSpacing: 1.6, textTransform: "uppercase", color }}>
      {children}
    </Text>
  );
}

/** Entrée échelonnée — fade + 14px up, easing charte. */
export function Reveal({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  // Cascade : chaque bloc entre `delay` ms après le précédent, sur le ressort
  // de volet (moment 8) — le regard finit sur le total.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const { style } = usePresence(mounted, { from: "bottom", preset: MOTION.pane, delayMs: delay });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Sceau : coche qui se trace à l'acceptation (moment 9). */
const AnimatedPath = Animated.createAnimatedComponent(Path);
/** Longueur du tracé « M5 12.5 L10 17.5 L19 7 » : √50 + √191,25 ≈ 20,9. */
const CHECK_LENGTH = 21;
export function SealCheck({ color }: { color: string }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { setDrawn(true); }, []);
  const { animatedProps } = useTraceStroke(drawn, { length: CHECK_LENGTH });
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <AnimatedPath
        d="M5 12.5 L10 17.5 L19 7" fill="none" stroke={color} strokeWidth={2.4}
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray={CHECK_LENGTH}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
