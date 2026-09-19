// components/cockpit/markers.tsx — les marqueurs de l'accueil, sans halo.
//   MeMarker    : un disque plein — gris hors ligne, blanc en ligne, rouge sans
//                 GPS ; en mission il devient une flèche de cap, tournée vers la
//                 porte (le seul moment où l'orientation est vraie).
//   DemandDot   : un point ambre plein, qui arrive par un rebond d'échelle.
//   DoorMarker  : la porte du client, verte, avec la maison.
//   RouteTrace  : l'itinéraire, révélé point par point — dans son propre
//                 composant pour que la révélation ne re-rende que lui.
//
// react-native-maps rasterise chaque marqueur : `tracksViewChanges` à vrai en
// permanence coûte une capture par frame. `useTracksViewChanges` ne le laisse
// vrai que le temps d'une animation (≈ 900 ms) après un changement.
import React, { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { Marker, Polyline } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, COLORS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { useRevealCount } from '@/lib/motion/useRevealCount';
import type { LatLng } from '@/lib/mission/route';

export type MeTone = 'off' | 'on' | 'gps';

/** Vrai pendant `ms` après chaque changement de `key` : le temps de l'animation du marqueur. */
export function useTracksViewChanges(key: string | number | boolean, ms = 900): boolean {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const t = setTimeout(() => setTracking(false), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return tracking;
}

function MeMarkerBase({ tone, heading, arrow }: { tone: MeTone; heading: number; arrow: boolean }) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const bg = tone === 'gps' ? theme.danger : tone === 'on' ? (theme.accent as string) : (theme.textMuted as string);
  // Le disque grandit un peu en mission (22 → 28) : une échelle, pas une taille.
  const grow = useSharedValue(arrow ? 1 : 0);
  useEffect(() => { grow.value = reduced ? withTiming(arrow ? 1 : 0, { duration: 150 }) : withSpring(arrow ? 1 : 0, MOTION.take); }, [arrow, reduced, grow]);
  const disc = useAnimatedStyle(() => ({ transform: [{ scale: 1 + grow.value * (28 / 22 - 1) }] }));
  const icon = useAnimatedStyle(() => ({ opacity: grow.value, transform: [{ scale: 0.6 + grow.value * 0.4 }] }));
  return (
    <View style={s.meBox}>
      <Animated.View style={[s.me, { backgroundColor: bg, borderColor: theme.cardBg }, disc]}>
        <Animated.View style={[{ transform: [{ rotate: `${heading}deg` }] }, icon]}>
          <Feather name="navigation-2" size={12} color={theme.accentText} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
export const MeMarker = memo(MeMarkerBase);

function DemandDotBase({ index = 0, big = false }: { index?: number; big?: boolean }) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const sc = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { sc.value = 1; return; }
    sc.value = withDelay(120 * Math.min(index, 6), withSpring(1, MOTION.land));
  }, [reduced, index, sc]);
  // « Elle est pour vous » : le point grandit (10 → 14) par l'échelle.
  const emph = useSharedValue(big ? 1 : 0);
  useEffect(() => { emph.value = reduced ? withTiming(big ? 1 : 0, { duration: 150 }) : withSpring(big ? 1 : 0, MOTION.take); }, [big, reduced, emph]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: sc.value * (0.72 + emph.value * 0.28) }] }));
  return (
    <View style={s.dotBox}>
      <Animated.View style={[s.dot, { borderColor: theme.cardBg }, style]} />
    </View>
  );
}
export const DemandDot = memo(DemandDotBase);

function DoorMarkerBase({ visible }: { visible: boolean }) {
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
export const DoorMarker = memo(DoorMarkerBase);

/** L'itinéraire révélé par paquets de points : moins de rendus, même geste. */
function RouteTraceBase({ coords, color }: { coords: LatLng[]; color: string }) {
  const STEP = 6;
  const chunks = Math.ceil(coords.length / STEP);
  const visibleChunks = useRevealCount(chunks, coords.length > 0);
  const visible = useMemo(() => coords.slice(0, Math.min(coords.length, visibleChunks * STEP)), [coords, visibleChunks]);
  if (visible.length < 2) return null;
  return <Polyline coordinates={visible} strokeColor={color} strokeWidth={3} />;
}
export const RouteTrace = memo(RouteTraceBase);

// ─── Les épingles : un Marker qui ne capture sa vue que le temps d'animer ───

function MePinBase({ coordinate, tone, heading, arrow }: { coordinate: LatLng; tone: MeTone; heading: number; arrow: boolean }) {
  // Le cap n'est suivi qu'en mission, et arrondi à 10° : pas une capture par degré.
  const h = arrow ? Math.round(heading / 10) * 10 : 0;
  const tracks = useTracksViewChanges(`${tone}-${arrow}-${h}`);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} flat={false} tracksViewChanges={tracks}>
      <MeMarker tone={tone} heading={h} arrow={arrow} />
    </Marker>
  );
}
export const MePin = memo(MePinBase);

function DemandPinBase({ id, coordinate, index, big }: { id: string; coordinate: LatLng; index: number; big: boolean }) {
  const tracks = useTracksViewChanges(`${id}-${big}`, 900 + 120 * Math.min(index, 6));
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracks}>
      <DemandDot index={index} big={big} />
    </Marker>
  );
}
export const DemandPin = memo(DemandPinBase);

function DoorPinBase({ coordinate }: { coordinate: LatLng }) {
  const tracks = useTracksViewChanges('door');
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracks}>
      <DoorMarker visible />
    </Marker>
  );
}
export const DoorPin = memo(DoorPinBase);

const s = StyleSheet.create({
  meBox: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  me: { width: 22, height: 22, borderRadius: 11, borderWidth: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dotBox: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.amber, borderWidth: 2 },
  door: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.greenBrand, alignItems: 'center', justifyContent: 'center' },
});
