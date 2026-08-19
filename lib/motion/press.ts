// lib/motion/press.ts
// ─────────────────────────────────────────────────────────────────────────────
// Retour tactile à l'appui — règle 4 de CLAUDE.md § Interfaces fluides :
// « Feedback à l'appui (pressIn), pas au relâchement. Scale 0.97 instantané. »
//
// Le pattern fautif qu'on remplace :
//     onPress={() => Animated.sequence([shrink, springBack]).start()}
// Il joue l'animation APRÈS le relâchement — l'utilisateur a déjà levé le doigt
// quand l'interface réagit. Le doigt doit sentir la réponse au contact.
//
// 100% Reanimated : les springs tournent sur le thread UI, donc le retour reste
// instantané même si le JS est occupé (fetch, socket, re-render de liste).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { dampingFor, useReduceMotion } from './sheet';

/**
 * Enfoncement : très raide et critique (ζ = 1.0) → perçu comme instantané,
 * sans dépassement. C'est le « instantané » de la règle 4.
 */
const PRESS_IN_SPRING = {
  damping: dampingFor(1.0, 900, 1),
  stiffness: 900,
  mass: 1,
};

/**
 * Relâchement : critique aussi, un peu plus souple. Aucun rebond — un bouton
 * qui rebondit au relâchement fait jouet, pas outil.
 */
const PRESS_OUT_SPRING = {
  damping: dampingFor(1.0, 500, 1),
  stiffness: 500,
  mass: 1,
};

/** Échelle d'enfoncement par défaut (règle 4). */
export const PRESS_SCALE = 0.97;

export type PressScale = {
  style: { transform: { scale: number }[] };
  onPressIn: () => void;
  onPressOut: () => void;
};

/**
 * Retour d'appui prêt à brancher sur un `Pressable` / `TouchableOpacity` :
 *
 *     const press = usePressScale();
 *     <Pressable {...press.handlers}>
 *       <Reanimated.View style={press.style} />
 *     </Pressable>
 *
 * Sous reduce-motion, l'échelle ne bouge pas (règle 8) — le composant reste
 * responsable de fournir un autre signal (couleur, haptique).
 */
export function usePressScale(target: number = PRESS_SCALE) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    if (reduced) return;
    // Part de la valeur COURANTE (règle 1) : un ré-appui pendant le retour
    // reprend le mouvement en cours au lieu de sauter à 1.
    scale.value = withSpring(target, PRESS_IN_SPRING);
  }, [reduced, target, scale]);

  const onPressOut = useCallback(() => {
    if (reduced) return;
    scale.value = withSpring(1, PRESS_OUT_SPRING);
  }, [reduced, scale]);

  const handlers = useMemo(() => ({ onPressIn, onPressOut }), [onPressIn, onPressOut]);

  return { style, handlers, onPressIn, onPressOut };
}
