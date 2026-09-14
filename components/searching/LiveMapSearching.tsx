// components/searching/LiveMapSearching.tsx — l'attente d'un prestataire.
// « La carte devient le récit » (planche C, 13/09/2026) : plus rien de
// décoratif — ni halo, ni cercle, ni fil simulé. Ce qui bouge est un fait :
//   - les prestataires proches dorment sur la carte, à leur vraie position ;
//   - quand le serveur en prévient une vague (request:matching / wave), leurs
//     pastilles s'éveillent une à une (MOTION.take) et un trait les relie à
//     l'adresse ; un refus (declined) éteint la pastille et retire le trait ;
//   - la feuille dit l'état en une phrase (Bebas), montre la demande et
//     propose d'annuler ; une ligne mono compte le temps et la vague suivante.
// La carte est verrouillée et rembourrée de la hauteur de la feuille : les
// positions à l'écran sont stables, les pastilles et les traits sont des
// vues Reanimated (pas des Marker natifs), calculées avec pointForCoordinate.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { usePresence } from '@/lib/motion/usePresence';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { cleanName } from '@/lib/displayName';
import { MAP_STYLE_LIGHT, MAP_STYLE_DARK } from '@/constants/mapStyles';
import type { MissionBrief } from '@/lib/mission/brief';
import { MissionRow } from '@/components/mission/MissionRow';

// ── Types ────────────────────────────────────────────────────────────────────
type Pro = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  lat: number | null;
  lng: number | null;
  etaMin: number | null;
  /** 0 = pas encore prévenu (endormi), sinon la vague. */
  wave: number;
  declined: boolean;
};

type WaveEvent = {
  requestId: number | string; kind: 'wave'; round: number;
  providers: { id: string; name: string | null; avatarUrl: string | null; lat: number | null; lng: number | null; distanceKm: number | null; etaMin: number | null }[];
  remaining: number; nextWaveInMs: number | null;
};
type DeclinedEvent = { requestId: number | string; kind: 'declined'; providerId: string };

export interface LiveMapSearchingProps {
  missionId: string | number;
  missionCoord: { latitude: number; longitude: number };
  brief: MissionBrief;
  expiresAt?: string | null;
  cancelling?: boolean;
  isScheduled?: boolean;
  scheduledLabel?: string | null;
  acceptedName?: string | null;
  /** Prestataire qui a accepté : sa pastille prend, les autres s'éteignent, les traits se retirent. */
  acceptedProviderId?: string | null;
  onCancel: () => void;
}

// ── Temps ────────────────────────────────────────────────────────────────────
function useTick(ms: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const firstName = (name: string | null | undefined) => cleanName(name ?? '').split(/\s+/)[0] || '';

// ── Pastille d'un prestataire (vue à l'écran, pas un Marker) ─────────────────
const PIN = 40;
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

// ── Trait entre l'adresse et une pastille éveillée ───────────────────────────
// Un View fin dont la largeur grandit (sûr sur Android, contrairement à un
// trait SVG animé). Pivot au point de départ : on tourne autour du bord gauche
// en compensant par une translation.
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

// ── Titre qui change avec les faits ──────────────────────────────────────────
function Headline({ text, sub }: { text: string; sub: string }) {
  const theme = useAppTheme();
  const [shown, setShown] = useState({ text, sub });
  const [visible, setVisible] = useState(true);
  const presence = usePresence(visible, { from: 'bottom', preset: MOTION.pane });
  useEffect(() => {
    if (text === shown.text && sub === shown.sub) return;
    setVisible(false);
    const id = setTimeout(() => { setShown({ text, sub }); setVisible(true); }, 160);
    return () => clearTimeout(id);
  }, [text, sub, shown]);
  return (
    <Animated.View style={presence.style}>
      <Text style={[s.h1, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{shown.text}</Text>
      <Text style={[s.sub, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{shown.sub}</Text>
    </Animated.View>
  );
}

// ── Écran ────────────────────────────────────────────────────────────────────
export default function LiveMapSearching(props: LiveMapSearchingProps) {
  const { missionId, missionCoord: rawCoord, brief, expiresAt, cancelling, isScheduled, scheduledLabel, acceptedName, acceptedProviderId, onCancel } = props;
  const missionCoord = useMemo(() => ({ latitude: rawCoord.latitude, longitude: rawCoord.longitude }), [rawCoord.latitude, rawCoord.longitude]);
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { socket } = useSocket();
  const mapRef = useRef<MapView>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [pros, setPros] = useState<Pro[]>([]);
  const [round, setRound] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [nextWaveAt, setNextWaveAt] = useState<number | null>(null);
  const [startedAt] = useState(() => Date.now());
  const now = useTick(1000);

  // Prestataires proches : endormis tant que le serveur ne les a pas prévenus.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await api.providers.nearby(missionCoord.latitude, missionCoord.longitude, 5);
        const list: Pro[] = (res?.providers ?? [])
          .map((p: any) => ({ id: String(p.id), name: p.name ?? null, avatarUrl: p.avatarUrl ?? null, lat: Number(p.lat), lng: Number(p.lng), etaMin: null, wave: 0, declined: false }))
          .filter((p: Pro) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .slice(0, 8);
        if (!cancelled) {
          // Une vague a pu arriver avant la liste : on garde les éveillés.
          setPros((cur) => {
            const byId = new Map(list.map((p) => [p.id, p]));
            for (const c of cur) byId.set(c.id, { ...(byId.get(c.id) ?? c), ...c });
            return Array.from(byId.values());
          });
        }
      } catch (e: any) {
        devError('[LiveMapSearching] nearby providers failed:', e?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [missionCoord.latitude, missionCoord.longitude]);

  // Les faits : vagues et refus.
  useEffect(() => {
    if (!socket) return;
    const onMatching = (e: WaveEvent | DeclinedEvent) => {
      if (String(e?.requestId) !== String(missionId)) return;
      if (e.kind === 'wave') {
        setRound((r) => Math.max(r, e.round));
        setRemaining(e.remaining);
        setNextWaveAt(e.nextWaveInMs != null ? Date.now() + e.nextWaveInMs : null);
        setPros((cur) => {
          const byId = new Map(cur.map((p) => [p.id, p]));
          for (const p of e.providers) {
            const prev = byId.get(String(p.id));
            byId.set(String(p.id), {
              id: String(p.id), name: p.name ?? prev?.name ?? null, avatarUrl: p.avatarUrl ?? prev?.avatarUrl ?? null,
              lat: p.lat ?? prev?.lat ?? null, lng: p.lng ?? prev?.lng ?? null, etaMin: p.etaMin ?? prev?.etaMin ?? null,
              wave: Math.max(1, e.round), declined: false,
            });
          }
          return Array.from(byId.values());
        });
      } else if (e.kind === 'declined') {
        setPros((cur) => cur.map((p) => (p.id === String(e.providerId) ? { ...p, declined: true } : p)));
      }
    };
    socket.on('request:matching', onMatching);
    return () => { socket.off('request:matching', onMatching); };
  }, [socket, missionId]);

  // Positions à l'écran : la carte est verrouillée, on les calcule à chaque
  // changement de liste ou de rembourrage, avec pointForCoordinate.
  const [points, setPoints] = useState<Record<string, { x: number; y: number }>>({});
  const prosKey = pros.map((p) => `${p.id}:${p.lat}:${p.lng}`).join('|');
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, { x: number; y: number }> = {};
      const targets: { key: string; lat: number; lng: number }[] = [
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
  }, [mapReady, prosKey, missionCoord, sheetHeight]);

  // ── Le récit ──
  const awake = pros.filter((p) => p.wave > 0 && !p.declined);
  const declinedCount = pros.filter((p) => p.declined).length;
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const expiresIn = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : null;
  const nextIn = nextWaveAt ? Math.max(0, Math.ceil((nextWaveAt - now) / 1000)) : null;

  let headline: string;
  let sub: string;
  if (acceptedName) {
    headline = t('searching.h_accepted', { name: firstName(acceptedName) });
    sub = t('searching.s_accepted');
  } else if (isScheduled) {
    headline = t('searching.h_scheduled');
    sub = scheduledLabel ? t('searching.s_scheduled', { when: scheduledLabel }) : t('searching.s_scheduled_generic');
  } else if (awake.length === 0 && round === 0) {
    headline = t('searching.h_notifying');
    sub = t('searching.s_first');
  } else if (awake.length === 0 && remaining === 0) {
    headline = t('searching.h_wider');
    sub = t('searching.s_wider');
  } else if (awake.length === 0) {
    headline = t('searching.h_next_wave');
    sub = nextIn != null ? t('searching.s_next_wave', { time: mmss(nextIn) }) : t('searching.s_first');
  } else {
    headline = awake.length === 1 ? t('searching.h_one', { name: firstName(awake[0].name) }) : t('searching.h_many', { n: awake.length });
    sub = nextIn != null && remaining ? t('searching.s_first_next', { time: mmss(nextIn) }) : t('searching.s_first');
  }

  const eyebrow = [
    round > 0 ? t('searching.wave_n', { n: Math.max(1, round) }) : t('searching.searching'),
    mmss(elapsed),
    expiresIn != null && expiresIn < 300 ? t('searching.expires_in', { time: mmss(expiresIn) }) : null,
  ].filter(Boolean).join(' · ');

  const me = points.me;
  const mapStyle = theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
        initialRegion={{ ...missionCoord, latitudeDelta: 0.014, longitudeDelta: 0.014 }}
        showsCompass={false} showsMyLocationButton={false} showsPointsOfInterest={false} showsBuildings={false} showsTraffic={false}
        rotateEnabled={false} pitchEnabled={false} scrollEnabled={false} zoomEnabled={false}
        mapPadding={{ top: 0, right: 0, bottom: sheetHeight, left: 0 }}
        onMapReady={() => setMapReady(true)}
      />

      {/* Calque du récit : traits, pastilles, puis l'adresse par-dessus. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
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
      </View>

      {/* La feuille */}
      <View style={s.sheetWrap} pointerEvents="box-none" onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}>
        <View style={[s.sheet, { backgroundColor: theme.cardBg, shadowColor: theme.text, paddingBottom: insets.bottom + 12 }]}>
          <View style={[s.grabber, { backgroundColor: theme.borderLight }]} />
          <Text style={[s.eyebrow, { color: theme.textMuted }]} numberOfLines={1}>{eyebrow.toUpperCase()}</Text>
          <Headline text={headline} sub={sub} />
          {declinedCount > 0 && !acceptedName && !isScheduled ? (
            <Text style={[s.note, { color: theme.textMuted }]}>{t('searching.declined_n', { count: declinedCount })}</Text>
          ) : null}
          <View style={s.request}>
            <MissionRow brief={brief} amountMode="gross" standalone onPress={() => {}} />
          </View>
          <Text style={[s.reassurance, { color: theme.textMuted }]}>{t('searching.reassurance')}</Text>
          <Pressable
            style={({ pressed }) => [s.cancel, (pressed || cancelling) && { opacity: 0.55 }]}
            onPress={onCancel}
            disabled={cancelling}
            accessibilityRole="button"
            accessibilityLabel={t('ext.searching_cancel_search')}
            hitSlop={8}
          >
            <Text style={[s.cancelText, { color: cancelling ? theme.textMuted : COLORS.red }]}>
              {cancelling ? t('ext.searching_cancelling') : t('searching.cancel')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  me:           { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.greenBrand, borderWidth: 3 },
  pin:          { position: 'absolute', width: PIN, alignItems: 'center' },
  pinDisc:      { width: PIN, height: PIN, borderRadius: PIN / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  pinImg:       { width: '100%', height: '100%' },
  pinText:      { fontFamily: FONTS.sansMedium, fontSize: 12 },
  pinLabel:     { marginTop: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  pinLabelText: { fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 0.5 },
  linkPivot:    { position: 'absolute', width: 0, height: 0, overflow: 'visible' },
  link:         { position: 'absolute', left: 0, top: -0.75, height: 1.5 },
  sheetWrap:    { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet:        { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 10, shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 20 },
  grabber:      { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  eyebrow:      { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1.5, marginBottom: 6 },
  h1:           { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 0.3, includeFontPadding: false },
  sub:          { fontFamily: FONTS.sans, fontSize: 13, marginTop: 4 },
  note:         { fontFamily: FONTS.sans, fontSize: 12, marginTop: 6 },
  request:      { marginTop: 14, marginHorizontal: -16 },
  reassurance:  { fontFamily: FONTS.sans, fontSize: 11, textAlign: 'center', marginTop: 12 },
  cancel:       { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  cancelText:   { fontFamily: FONTS.sansMedium, fontSize: 13 },
});
