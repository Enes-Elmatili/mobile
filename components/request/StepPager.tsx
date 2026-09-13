// components/request/StepPager.tsx
// Pager à poussée latérale, piloté à la main (pas d'animation de layout) :
// quand `page` change, la page courante et la précédente sont TOUTES DEUX
// montées, en position absolue, et une seule shared value les déplace sur
// MOTION.pane — la nouvelle entre par la droite (direction 1) ou la gauche
// (direction -1), l'ancienne sort de l'autre côté, puis est démontée.
//
// Pourquoi pas les animations de layout Reanimated (entering/exiting) :
// sur un sous-arbre lourd (MapView, autocomplétion Google, KeyboardAvoiding-
// View) la vue sortante restait parfois à l'écran à côté de l'entrante, et le
// retour n'était pas fluide. Ici tout est déterministe : deux calques, une
// valeur, une largeur mesurée. Interruptible : un changement de page pendant
// la transition repart de l'état courant (règle 1).
//
// `keepMounted` : les pages déjà visitées restent montées (display: none)
// pour qu'un retour n'ait rien à recharger — la carte de l'étape 1, le
// défilement d'une liste (spec § 4.3 « rien ne se recharge »).
// Reduce-motion : fondu croisé de 150 ms.
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';

export type PagerDirection = 1 | -1;
type PageKey = number | string;

type Props = {
  page: PageKey;
  direction: PagerDirection;
  render: (page: PageKey) => React.ReactNode;
  keepMounted?: boolean;
  style?: StyleProp<ViewStyle>;
};

type State = { current: PageKey; previous: PageKey | null; dir: PagerDirection; visited: PageKey[] };

export function StepPager({ page, direction, render, keepMounted = false, style }: Props) {
  const reduced = useReduceMotion();
  const [state, setState] = useState<State>({ current: page, previous: null, dir: direction, visited: [page] });
  // 1 = posé sur la page courante ; 0 = la précédente occupe encore l'écran.
  const progress = useSharedValue(1);
  const width = useSharedValue(0);

  const settle = useCallback(() => setState((s) => ({ ...s, previous: null })), []);

  useEffect(() => {
    if (page === state.current) return;
    setState((s) => ({
      current: page,
      previous: s.current,
      dir: direction,
      visited: s.visited.includes(page) ? s.visited : [...s.visited, page],
    }));
    progress.value = 0;
    const done = (finished?: boolean) => { if (finished) runOnJS(settle)(); };
    progress.value = reduced ? withTiming(1, { duration: 150 }, done) : withSpring(1, MOTION.pane, done);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagit qu'à `page`
  }, [page]);

  const dir = state.dir;
  const inStyle = useAnimatedStyle(
    () => (reduced ? { opacity: progress.value } : { transform: [{ translateX: (1 - progress.value) * dir * width.value }] }),
    [dir, reduced],
  );
  const outStyle = useAnimatedStyle(
    () => (reduced ? { opacity: 1 - progress.value } : { transform: [{ translateX: -progress.value * dir * width.value }] }),
    [dir, reduced],
  );

  // Ordre de rendu = ordre d'empilement : pages cachées, puis la sortante, puis la courante.
  const hidden = keepMounted ? state.visited.filter((p) => p !== state.current && p !== state.previous) : [];
  const layers: { key: PageKey; role: 'hidden' | 'previous' | 'current' }[] = [
    ...hidden.map((key) => ({ key, role: 'hidden' as const })),
    ...(state.previous !== null ? [{ key: state.previous, role: 'previous' as const }] : []),
    { key: state.current, role: 'current' as const },
  ];

  return (
    <View style={[s.container, style]} onLayout={(e) => { width.value = e.nativeEvent.layout.width; }}>
      {layers.map(({ key, role }) => (
        <Animated.View
          key={String(key)}
          pointerEvents={role === 'current' ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, role === 'current' ? inStyle : role === 'previous' ? outStyle : s.hidden]}
        >
          {render(key)}
        </Animated.View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  hidden: { display: 'none' },
});
