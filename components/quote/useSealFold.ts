// components/quote/useSealFold.ts — Moment 9 de la revue de devis : à
// l'acceptation la bordure du héro passe d'ambre à vert et la coche se trace ;
// au refus la carte se plie et se range, sans rouge.
import { useEffect } from "react";
import { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { MOTION } from "@/lib/motion";
import { COLORS, alpha } from "@/hooks/use-app-theme";

// Les deux couleurs sont calculées ICI, sur le thread JS : `alpha` n'est pas
// un worklet, l'appeler dans useAnimatedStyle plante le runtime UI en release
// (l'app se fermait à la réception du devis).
const HERO_BORDER_PENDING = alpha(COLORS.amber, 0.45);
const HERO_BORDER_ACCEPTED = alpha(COLORS.greenBrand, 0.6);

export function useSealFold(sealOn: boolean, foldOn: boolean) {
  const seal = useSharedValue(sealOn ? 1 : 0);
  const fold = useSharedValue(foldOn ? 1 : 0);
  useEffect(() => { seal.value = withSpring(sealOn ? 1 : 0, MOTION.trace); }, [sealOn, seal]);
  useEffect(() => { fold.value = withSpring(foldOn ? 1 : 0, MOTION.pane); }, [foldOn, fold]);
  const heroBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(seal.value, [0, 1], [HERO_BORDER_PENDING, HERO_BORDER_ACCEPTED]),
  }));
  const foldStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.35 * fold.value,
    transform: [{ perspective: 600 }, { rotateX: `${-12 * fold.value}deg` }, { scale: 1 - 0.04 * fold.value }],
  }));
  return { heroBorderStyle, foldStyle };
}
