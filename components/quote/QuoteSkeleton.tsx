// components/quote/QuoteSkeleton.tsx — Squelette de chargement de la revue de devis.
import React, { useEffect } from "react";
import { View, type DimensionValue } from "react-native";
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import type { AppTheme } from "@/hooks/use-app-theme";

/** Bloc du squelette — au niveau module : déclaré dans le rendu, il serait
 *  recréé (donc remonté) à chaque passage. */
function SkeletonBlock({ h, w = "100%", r = 14, mt = 0, color, pulseStyle }: {
  h: number; w?: DimensionValue; r?: number; mt?: number; color: string; pulseStyle: ReturnType<typeof useAnimatedStyle>;
}) {
  return <Animated.View style={[{ height: h, width: w, borderRadius: r, marginTop: mt, backgroundColor: color }, pulseStyle]} />;
}

/** Squelette de chargement — reprend la silhouette réelle de la page (héro + ledger).
 *  `part` : la page gauche (contexte, prestataire) ou droite (héro, ledger) du
 *  Duo déplié — en une colonne, les blocs pleine largeur passaient sur le pli. */
export function QuoteSkeleton({ theme, part = "all" }: { theme: AppTheme; part?: "all" | "context" | "quote" }) {
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const block = { color: theme.surface, pulseStyle };
  if (part === "context") {
    return (
      <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
        <SkeletonBlock {...block} h={16} w={140} r={8} />
        <SkeletonBlock {...block} h={30} w={220} r={8} mt={14} />
        <SkeletonBlock {...block} h={76} r={20} mt={18} />
      </View>
    );
  }
  if (part === "quote") {
    return (
      <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
        <SkeletonBlock {...block} h={168} r={26} />
        <SkeletonBlock {...block} h={150} r={20} mt={12} />
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
      <SkeletonBlock {...block} h={16} w={140} r={8} />
      <SkeletonBlock {...block} h={30} w={220} r={8} mt={14} />
      <SkeletonBlock {...block} h={168} r={26} mt={18} />
      <SkeletonBlock {...block} h={150} r={20} mt={12} />
      <SkeletonBlock {...block} h={76} r={20} mt={12} />
    </View>
  );
}
