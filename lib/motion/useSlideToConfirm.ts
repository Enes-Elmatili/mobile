// lib/motion/useSlideToConfirm.ts
// Accepter une mission mérite un geste. Lâcher tôt : élastique. Flick : la
// vitesse est projetée et confirme avant le bout. Haptique light à 50 %,
// success au déclenchement — une fois chacune.
import { useCallback, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { rubberBand, shouldConfirm } from './gestures';
import { hapticOnFrame } from './haptics';
import { spring } from './springs';
import { SHEET_SPRING_MOMENTUM, useReduceMotion } from './sheet';

const SETTLE_SPRING = spring(300, 1.0);

export function useSlideToConfirm(opts: { trackWidth: number; knobSize: number; onConfirm: () => void }) {
  const { trackWidth, knobSize, onConfirm } = opts;
  const track = Math.max(0, trackWidth - knobSize);
  const reduced = useReduceMotion();
  const x = useSharedValue(0);
  const done = useSharedValue(0);
  const halfwayFired = useSharedValue(0);

  // Android : si onConfirm démonte le curseur (fermeture de feuille, carte
  // retirée) pendant que le callback du geste s'exécute encore, Gesture Handler
  // plante nativement. On sort donc du callback (tick suivant) avant d'agir.
  const confirm = useCallback(() => { setTimeout(() => onConfirm(), 0); }, [onConfirm]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          halfwayFired.value = 0;
        })
        .onUpdate((e) => {
          if (done.value) return;
          x.value = reduced ? Math.min(track, Math.max(0, e.translationX)) : rubberBand(e.translationX, 0, track);
          if (!halfwayFired.value && x.value >= track * 0.5) {
            halfwayFired.value = 1;
            hapticOnFrame('light');
          }
        })
        .onEnd((e) => {
          if (done.value) return;
          const ok = reduced ? x.value >= track * 0.9 : shouldConfirm(x.value, e.velocityX, track);
          if (ok) {
            done.value = 1;
            x.value = withSpring(track, SETTLE_SPRING);
            hapticOnFrame('success');
            runOnJS(confirm)();
          } else {
            // Règle 3 : la vitesse du doigt entre dans le ressort de retour.
            x.value = withSpring(0, { ...SHEET_SPRING_MOMENTUM, velocity: e.velocityX });
          }
        }),
    [track, reduced, x, done, halfwayFired, confirm],
  );

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: x.value + knobSize }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - (x.value / Math.max(1, track)) * 1.4) }));

  const reset = useCallback(() => {
    done.value = 0;
    x.value = withSpring(0, SETTLE_SPRING);
  }, [done, x]);

  return { gesture, knobStyle, fillStyle, labelStyle, reset };
}
