// components/cockpit/markers.tsx — les marqueurs de l'accueil, sans halo.
//   MeMarker    : ma photo — anneau blanc en ligne, gris et photo éteinte hors
//                 ligne, rouge sans GPS ; en mission, ma photo dans une goutte
//                 qui pointe le cap (le seul moment où l'orientation est vraie).
//   DemandDot   : un disque ambre, qui arrive par un rebond d'échelle ; plus
//                 gros avec un cœur blanc quand la demande est pour vous.
//   DoorMarker  : la porte du client, une goutte verte avec la maison.
//   RouteTrace  : l'itinéraire, révélé point par point — dans son propre
//                 composant pour que la révélation ne re-rende que lui.
//
// Les épingles passent par MapPin (components/map) : photographiées le temps
// de leur animation, puis figées — jamais carrées, jamais une capture par frame.
import React, { memo, useEffect, useMemo } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { Polyline } from 'react-native-maps';
import { MapPin } from '@/components/map/MapPin';
import { COLORS } from '@/hooks/use-app-theme';
import { PersonPin, DropPin, DotPin, DropGlyph } from '@/components/map/pins';
import Avatar from '@/components/ui/Avatar';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { useRevealCount } from '@/lib/motion/useRevealCount';
import type { LatLng } from '@/lib/mission/route';

export type MeTone = 'off' | 'on' | 'gps';

type Me = { name?: string | null; avatarUrl?: string | null };

function MeMarkerBase({ tone, heading, arrow, me }: { tone: MeTone; heading: number; arrow: boolean; me: Me }) {
  if (arrow) {
    return (
      <DropPin size={44} color="#1A1A1A" heading={heading}>
        <Avatar name={me.name || '?'} size={34} avatarUrl={me.avatarUrl} />
      </DropPin>
    );
  }
  return <PersonPin name={me.name} avatarUrl={me.avatarUrl} size={34} tone={tone === 'gps' ? 'red' : tone === 'off' ? 'grey' : 'white'} dim={tone === 'off'} />;
}
export const MeMarker = memo(MeMarkerBase);

function DemandDotBase({ index = 0, big = false }: { index?: number; big?: boolean }) {
  const reduced = useReduceMotion();
  const sc = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { sc.value = 1; return; }
    sc.value = withDelay(120 * Math.min(index, 6), withSpring(1, MOTION.land));
  }, [reduced, index, sc]);
  // « Elle est pour vous » : le disque grandit (14 → 22) et prend un cœur blanc.
  const emph = useSharedValue(big ? 1 : 0);
  useEffect(() => { emph.value = reduced ? withTiming(big ? 1 : 0, { duration: 150 }) : withSpring(big ? 1 : 0, MOTION.take); }, [big, reduced, emph]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: sc.value * (0.64 + emph.value * 0.36) }] }));
  return (
    <Animated.View style={style}>
      <DotPin size={22} color={COLORS.amber} core={big} />
    </Animated.View>
  );
}
export const DemandDot = memo(DemandDotBase);

function DoorMarkerBase({ visible }: { visible: boolean }) {
  const reduced = useReduceMotion();
  const sc = useSharedValue(visible ? 1 : 0);
  useEffect(() => { sc.value = reduced ? withTiming(visible ? 1 : 0, { duration: 150 }) : withSpring(visible ? 1 : 0, MOTION.land); }, [visible, reduced, sc]);
  // La goutte se pose sur sa pointe : l'échelle part du bas.
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: 0 }, { scale: sc.value }] }));
  return (
    <Animated.View style={style}>
      <DropPin size={40} color={COLORS.greenBrand}><DropGlyph name="home" /></DropPin>
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

function MePinBase({ coordinate, tone, heading, arrow, me }: { coordinate: LatLng; tone: MeTone; heading: number; arrow: boolean; me: Me }) {
  // Le cap n'est suivi qu'en mission, et arrondi à 10° : pas une capture par degré.
  const h = arrow ? Math.round(heading / 10) * 10 : 0;
  // La goutte s'ancre sur sa pointe ; la photo, en son centre.
  return (
    <MapPin coordinate={coordinate} flat={false} anchor={arrow ? { x: 0.5, y: 1 } : { x: 0.5, y: 0.5 }} trackKey={`${tone}-${arrow}-${h}-${me.avatarUrl ?? ''}`} trackMs={1600}>
      <MeMarker tone={tone} heading={h} arrow={arrow} me={me} />
    </MapPin>
  );
}
export const MePin = memo(MePinBase);

function DemandPinBase({ id, coordinate, index, big }: { id: string; coordinate: LatLng; index: number; big: boolean }) {
  return (
    <MapPin coordinate={coordinate} trackKey={`${id}-${big}`} trackMs={1200 + 120 * Math.min(index, 6)}>
      <DemandDot index={index} big={big} />
    </MapPin>
  );
}
export const DemandPin = memo(DemandPinBase);

function DoorPinBase({ coordinate }: { coordinate: LatLng }) {
  return (
    <MapPin coordinate={coordinate} anchor={{ x: 0.5, y: 1 }}>
      <DoorMarker visible />
    </MapPin>
  );
}
export const DoorPin = memo(DoorPinBase);

