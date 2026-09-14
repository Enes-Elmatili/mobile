// components/searching/SearchingOverlay.tsx — le calque du récit de recherche.
// « La carte devient le récit » (13/09/2026) : les prestataires proches
// dorment à leur vraie position ; une vague les éveille un à un (MOTION.take)
// et un trait les relie à l'adresse ; un refus éteint la pastille ; quand
// l'un accepte, sa pastille prend une dernière fois, les autres s'éteignent,
// les traits se retirent, puis tout le calque s'efface au profit du marqueur
// natif du suivi — sur la même carte, sans changer d'écran.
// Les positions à l'écran viennent de pointForCoordinate (carte verrouillée).
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type MapView from 'react-native-maps';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { cleanName } from '@/lib/displayName';
import type { Pro } from '@/lib/mission/useSearching';

const PIN = 40;
const firstName = (name: string | null | undefined) => cleanName(name ?? '').split(/\s+/)[0] || '';

function ProPin({ pro, x, y, order, accepted, dimmed }: { pro: Pro; x: number; y: number; order: number; accepted?: boolean; dimmed?: boolean }) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const awake = (pro.wave > 0 && !pro.declined) || !!accepted;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(pro.declined ? 0.3 : 1);
  useEffect(() => {
    if (awake && !reduced) {
      // Le réveil : la pastille « prend » (MOTION.take), en cascade dans la vague.
      scale.value = withDelay(order * 110, withSpring(1.12, MOTION.take, () => { scale.value = withSpring(1, MOTION.take); }));
    }
    opacity.value = withTiming(pro.declined || dimmed ? 0.28 : 1, { duration: 250 });
  }, [awake, pro.declined, dimmed, reduced, order, scale, opacity]);
  useEffect(() => {
    // Le moment « accepté » : la pastille prend une fois de plus, un cran plus grand.
    if (accepted && !reduced) scale.value = withSpring(1.22, MOTION.take, () => { scale.value = withSpring(1.08, MOTION.take); });
  }, [accepted, reduced, scale]);
  const st = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const initials = cleanName(pro.name ?? '').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '·';
  return (
    <Animated.View pointerEvents="none" style={[s.pin, { left: x - PIN / 2, top: y - PIN / 2 }, st]}>
      <View style={[s.pinDisc, { backgroundColor: awake ? theme.accent : theme.surface, borderColor: awake ? theme.accent : theme.border }]}>
        {pro.avatarUrl ? (
          <Image source={{ uri: pro.avatarUrl }} style={s.pinImg} contentFit="cover" />
        ) : (
          <Text style={[s.pinText, { color: awake ? theme.accentText : theme.textMuted }]}>{initials}</Text>
        )}
      </View>
      {awake && (pro.etaMin != null || accepted) ? (
        <View style={[s.pinLabel, { backgroundColor: theme.isDark ? 'rgba(20,20,20,0.85)' : 'rgba(255,255,255,0.9)' }]}>
          <Text style={[s.pinLabelText, { color: accepted ? theme.text : theme.textSub }]}>{pro.etaMin != null ? `${firstName(pro.name).toUpperCase()} · ${pro.etaMin} MIN` : firstName(pro.name).toUpperCase()}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

// Un View fin dont la largeur grandit (sûr sur Android). Pivot au point de départ.
function Link({ from, to, visible, order, color }: { from: { x: number; y: number }; to: { x: number; y: number }; visible: boolean; order: number; color: string }) {
  const reduced = useReduceMotion();
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = reduced ? (visible ? 1 : 0) : withDelay(visible ? order * 110 + 120 : 0, withTiming(visible ? 1 : 0, { duration: visible ? 480 : 220 }));
  }, [visible, reduced, order, p]);
  const st = useAnimatedStyle(() => ({ width: length * p.value, opacity: 0.35 * p.value }));
  return (
    <View pointerEvents="none" style={[s.linkPivot, { left: from.x, top: from.y, transform: [{ rotate: `${angle}deg` }] }]}>
      <Animated.View style={[s.link, { backgroundColor: color }, st]} />
    </View>
  );
}

type Props = {
  pros: Pro[];
  mapRef: React.RefObject<MapView | null>;
  mapReady: boolean;
  missionCoord: { latitude: number; longitude: number };
  /** Rembourrage bas de la carte (hauteur de la feuille) : les points bougent avec. */
  sheetHeight: number;
  acceptedProviderId?: string | null;
  /** Faux = le calque s'efface (fondu) avant de disparaître. */
  visible: boolean;
};

export function SearchingOverlay({ pros, mapRef, mapReady, missionCoord, sheetHeight, acceptedProviderId, visible }: Props) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const [points, setPoints] = useState<Record<string, { x: number; y: number }>>({});
  const prosKey = pros.map((p) => `${p.id}:${p.lat}:${p.lng}`).join('|');
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, { x: number; y: number }> = {};
      const targets = [
        { key: 'me', lat: missionCoord.latitude, lng: missionCoord.longitude },
        ...pros.filter((p) => p.lat != null && p.lng != null).map((p) => ({ key: p.id, lat: p.lat as number, lng: p.lng as number })),
      ];
      for (const tg of targets) {
        try {
          const pt = await mapRef.current!.pointForCoordinate({ latitude: tg.lat, longitude: tg.lng });
          next[tg.key] = { x: pt.x, y: pt.y };
        } catch { /* hors carte */ }
      }
      if (!cancelled) setPoints(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prosKey résume la liste
  }, [mapReady, prosKey, missionCoord.latitude, missionCoord.longitude, sheetHeight]);

  const fade = useSharedValue(visible ? 1 : 0);
  useEffect(() => { fade.value = withTiming(visible ? 1 : 0, { duration: reduced ? 0 : 320 }); }, [visible, reduced, fade]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const me = points.me;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fadeStyle]}>
      {me ? pros.map((p, i) => {
        const pt = points[p.id];
        if (!pt) return null;
        return <Link key={`l-${p.id}`} from={me} to={pt} visible={p.wave > 0 && !p.declined && !acceptedProviderId} order={i} color={theme.text as string} />;
      }) : null}
      {pros.map((p, i) => {
        const pt = points[p.id];
        if (!pt) return null;
        const accepted = !!acceptedProviderId && p.id === acceptedProviderId;
        return <ProPin key={p.id} pro={p} x={pt.x} y={pt.y} order={i} accepted={accepted} dimmed={!!acceptedProviderId && !accepted} />;
      })}
      {me ? <View style={[s.me, { left: me.x - 9, top: me.y - 9, borderColor: theme.cardBg }]} /> : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  me:           { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.greenBrand, borderWidth: 3 },
  pin:          { position: 'absolute', width: PIN, alignItems: 'center' },
  pinDisc:      { width: PIN, height: PIN, borderRadius: PIN / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  pinImg:       { width: '100%', height: '100%' },
  pinText:      { fontFamily: FONTS.sansMedium, fontSize: 12 },
  pinLabel:     { marginTop: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  pinLabelText: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.5 },
  linkPivot:    { position: 'absolute', width: 0, height: 0, overflow: 'visible' },
  link:         { position: 'absolute', left: 0, top: -0.75, height: 1.5 },
});
