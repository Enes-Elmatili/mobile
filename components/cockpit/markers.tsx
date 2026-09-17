// components/cockpit/markers.tsx — les marqueurs de l'accueil, sans halo.
//   MeMarker    : un disque plein — gris hors ligne, blanc en ligne, rouge sans
//                 GPS ; en mission il devient une flèche de cap, tournée vers la
//                 porte (le seul moment où l'orientation est vraie).
//   DemandDot   : un point ambre plein, qui arrive par un rebond d'échelle.
//   DoorMarker  : la porte du client, verte, avec la maison.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, COLORS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';

export type MeTone = 'off' | 'on' | 'gps';

export function MeMarker({ tone, heading, arrow }: { tone: MeTone; heading: number; arrow: boolean }) {
  const theme = useAppTheme();
  const bg = tone === 'gps' ? COLORS.red : tone === 'on' ? (theme.accent as string) : (theme.textMuted as string);
  const size = arrow ? 28 : 22;
  return (
    <View style={[s.me, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderColor: theme.cardBg }]}>
      {arrow ? (
        <View style={{ transform: [{ rotate: `${Math.round(heading)}deg` }] }}>
          <Feather name="navigation-2" size={14} color={theme.accentText} />
        </View>
      ) : null}
    </View>
  );
}

export function DemandDot({ index = 0, big = false }: { index?: number; big?: boolean }) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const sc = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { sc.value = 1; return; }
    sc.value = withDelay(120 * Math.min(index, 6), withSpring(1, MOTION.land));
  }, [reduced, index, sc]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  const size = big ? 14 : 10;
  return <Animated.View style={[{ width: size + 4, height: size + 4, borderRadius: (size + 4) / 2, backgroundColor: COLORS.amber, borderWidth: 2, borderColor: theme.cardBg }, style]} />;
}

export function DoorMarker({ visible }: { visible: boolean }) {
  const reduced = useReduceMotion();
  const sc = useSharedValue(visible ? 1 : 0);
  useEffect(() => { sc.value = reduced ? withTiming(visible ? 1 : 0, { duration: 150 }) : withSpring(visible ? 1 : 0, MOTION.land); }, [visible, reduced, sc]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Animated.View style={[s.door, style]}>
      <Feather name="home" size={16} color="#0A0A0A" />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  me: { borderWidth: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  door: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.greenBrand, alignItems: 'center', justifyContent: 'center' },
});
