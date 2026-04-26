// mobile/components/searching/LiveMapSearching.tsx
// Dark-first replacement for the SEARCHING phase in /request/[id]/missionview.tsx.
// Uses the app design tokens (useAppTheme / FONTS / COLORS) — no hardcoded palette.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Circle } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withDelay, Easing, withSequence,
  FadeInDown, FadeOut, LinearTransition,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useSocket } from '@/lib/SocketContext';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { formatEUR } from '@/lib/format';

// ── Types ────────────────────────────────────────────────────────────────────
interface NearbyProvider {
  id: string;
  name?: string | null;
  lat: number;
  lng: number;
  rating?: number | null;
}

interface FeedItem {
  id: string;
  text: string;
  createdAt: number; // epoch ms — formatted live via timeAgo()
  pulse?: boolean;   // true = latest event, dot pulses instead of filled
}

export interface LiveMapSearchingProps {
  missionId: string | number;
  missionCoord: { latitude: number; longitude: number };
  missionTitle?: string;
  missionAddress?: string;
  missionWhen?: string;
  missionPrice?: string | number | null;
  expiresAt?: string | null;
  cancelling?: boolean;
  isScheduled?: boolean;
  isQuote?: boolean;
  onCancel: () => void;
}

// Live "X s / X min" formatter — re-rendered every 10s via useNow().
function timeAgo(ms: number, now: number): string {
  const diff = Math.max(0, Math.floor((now - ms) / 1000));
  if (diff < 5) return "à l'instant";
  if (diff < 60) return `il y a ${diff}s`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `il y a ${hours}h`;
}

function useNow(tickMs: number = 10000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

// ── Map styles (aligned with missionview.tsx) ────────────────────────────────
const MAP_STYLE_DARK = [
  { elementType: 'geometry', stylers: [{ color: '#1A1A1A' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2C2C2C' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#333333' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111111' }] },
];
const MAP_STYLE_LIGHT = [
  { elementType: 'geometry', stylers: [{ color: '#f0f0f0' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d0d0d0' }] },
];

// ── Hooks ────────────────────────────────────────────────────────────────────
function useCountdown(expiresAt?: string | null): string | null {
  const [left, setLeft] = useState<number | null>(() =>
    expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : null,
  );
  useEffect(() => {
    if (!expiresAt) { setLeft(null); return; }
    const compute = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    setLeft(compute());
    const t = setInterval(() => setLeft(compute()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (left == null) return null;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// ── Animated primitives ──────────────────────────────────────────────────────
function Blink({ children, period = 1000 }: { children: React.ReactNode; period?: number }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(
      withSequence(
        withTiming(1, { duration: period / 2 }),
        withTiming(0.2, { duration: period / 2 }),
      ),
      -1,
      false,
    );
  }, [period]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

function Float({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 2500, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: p.value }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

function Spinner({ color, track }: { color: string; track: string }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <View style={{ width: 22, height: 22 }}>
      <View style={{ position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: track }} />
      <Animated.View
        style={[
          { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'transparent', borderTopColor: color, borderRightColor: color },
          st,
        ]}
      />
    </View>
  );
}

// ── Markers ──────────────────────────────────────────────────────────────────
function initials(name?: string | null): string {
  if (!name) return '·';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '·';
}

function ProviderPin({ p, delay, theme }: { p: NearbyProvider; delay: number; theme: ReturnType<typeof useAppTheme> }) {
  return (
    <Marker coordinate={{ latitude: p.lat, longitude: p.lng }} anchor={{ x: 0.2, y: 1 }}>
      <Float delay={delay}>
        <View style={[s.pinCard, { backgroundColor: theme.cardBg, shadowColor: theme.text }]}>
          <View style={[s.pinAvatar, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
            <Text style={[s.pinAvatarText, { color: theme.text }]}>{initials(p.name)}</Text>
          </View>
          {typeof p.rating === 'number' && p.rating > 0 && (
            <View style={s.pinRating}>
              <Feather name="star" size={10} color={COLORS.amber} />
              <Text style={[s.pinRatingText, { color: theme.text }]}>{p.rating.toFixed(1)}</Text>
            </View>
          )}
          <View style={[s.pinBadge, { backgroundColor: COLORS.greenBrand, borderColor: theme.cardBg }]} />
          <View style={[s.pinTail, { backgroundColor: theme.cardBg }]} />
        </View>
      </Float>
    </Marker>
  );
}

function UserPin({ coord, surface }: { coord: { latitude: number; longitude: number }; surface: string }) {
  // Halo + radar rings removed — visually noisy on Apple Maps / low zoom and
  // duplicates the Circle overlay. Only the green dot remains to anchor the
  // mission address.
  return (
    <Marker coordinate={coord} anchor={{ x: 0.5, y: 0.5 }}>
      <View
        style={{
          width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.greenBrand,
          borderWidth: 3, borderColor: surface,
          shadowColor: COLORS.greenBrand, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
          elevation: 6,
        }}
      />
    </Marker>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function LiveMapSearching(props: LiveMapSearchingProps) {
  const {
    missionId, missionCoord: rawCoord, missionTitle, missionAddress, missionWhen,
    missionPrice, expiresAt, cancelling, isScheduled, isQuote,
    onCancel,
  } = props;

  // Stabilize the coordinate reference: the parent rebuilds `clientLocation`
  // every render (elapsed timer ticks every 1s upstream), which would hand a
  // new object to <Marker coordinate> and make react-native-maps think the
  // pin moved. Rebuild only when lat/lng actually change.
  const missionCoord = useMemo(
    () => ({ latitude: rawCoord.latitude, longitude: rawCoord.longitude }),
    [rawCoord.latitude, rawCoord.longitude],
  );

  const theme = useAppTheme();
  const { socket } = useSocket();
  const mapRef = useRef<MapView>(null);
  const timer = useCountdown(expiresAt);
  const insets = useSafeAreaInsets();

  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  // Three-phase state machine drives pill copy, Circle radius, and feed
  // collapsing. 0-45s searching, 45-60s expanding, 60s+ widened (calm).
  const [phase, setPhase] = useState<'searching' | 'expanding' | 'widened'>('searching');
  const [circleRadius, setCircleRadius] = useState(2000);
  const radiusRef = useRef(2000);
  useEffect(() => { radiusRef.current = circleRadius; }, [circleRadius]);

  // Live-searching accent pulls from the design charter's monochrome accent
  // (white in dark mode, ink in light). Red is reserved for destructive
  // actions (cancel button) per the palette.
  const accent = theme.accent as string;
  const fgMuted = theme.textMuted as string;
  const mapStyle = theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

  // Real providers around the mission coord.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await api.providers.nearby(missionCoord.latitude, missionCoord.longitude, 5);
        const list: NearbyProvider[] = (res?.providers ?? []).map((p: any) => ({
          id: String(p.id),
          name: p.name,
          lat: Number(p.lat),
          lng: Number(p.lng),
          rating: typeof p.rating === 'number' ? p.rating : null,
        })).filter((p: NearbyProvider) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        if (!cancelled) setProviders(list.slice(0, 6));
      } catch (e: any) {
        devError('[LiveMapSearching] nearby providers failed:', e?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [missionCoord.latitude, missionCoord.longitude]);

  // Seed feed once at mount. We never expose the raw provider count because
  // "0 prestataires" is a psychological kill-signal during matching — we tell
  // the user the algorithm is working, not whether there's currently supply.
  useEffect(() => {
    const base = Date.now();
    setFeed([
      {
        id: 'seed-1',
        text: isScheduled ? 'Mission planifiée — en attente de créneau' : 'Mission publiée sur le réseau',
        createdAt: base - 8_000,
      },
      {
        id: 'seed-2',
        text: isScheduled
          ? 'Nous activerons votre mission au bon moment'
          : 'Recherche des prestataires disponibles',
        createdAt: base - 2_000,
        pulse: true,
      },
    ]);
  }, [isScheduled]);

  // Real socket: status updates → terminal lines appended to the feed.
  useEffect(() => {
    if (!socket) return;
    const push = (text: string, pulse = false) =>
      setFeed(prev => {
        const demoted = prev.map(it => ({ ...it, pulse: false }));
        return [{ id: `evt-${Date.now()}`, text, createdAt: Date.now(), pulse }, ...demoted].slice(0, 4);
      });
    const onStatusUpdated = (d: any) => {
      if (String(d?.requestId ?? d?.id) !== String(missionId)) return;
      const status = String(d?.status || '').toUpperCase();
      if (status === 'ACCEPTED') push('Prestataire trouvé — mission acceptée', true);
      else if (status === 'CANCELLED' || status === 'QUOTE_EXPIRED') push('Demande clôturée');
    };
    socket.on('request:statusUpdated', onStatusUpdated);
    return () => { socket.off('request:statusUpdated', onStatusUpdated); };
  }, [socket, missionId]);

  // Simulated matching progress — no client-facing socket event broadcasts
  // the per-provider notification cadence today, so we surface a plausible
  // progression to match user expectation of live activity. Timings tuned so
  // the "expansion" signal lands at 45s (not before) to avoid panicking the
  // client on a normal matching delay in a small beta zone.
  useEffect(() => {
    if (isScheduled) return;
    const pushFeed = (msg: string) =>
      setFeed(prev => {
        const demoted = prev.map(it => ({ ...it, pulse: false }));
        return [
          { id: `sim-${Date.now()}`, text: msg, createdAt: Date.now(), pulse: true },
          ...demoted,
        ].slice(0, 4);
      });
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => pushFeed('Un prestataire notifié'), 8_000));
    timers.push(setTimeout(() => pushFeed('2 prestataires notifiés'), 20_000));
    timers.push(setTimeout(() => pushFeed('3 prestataires notifiés'), 32_000));
    timers.push(setTimeout(() => {
      pushFeed('Expansion du rayon de recherche');
      setPhase('expanding');
    }, 45_000));
    timers.push(setTimeout(() => setPhase('widened'), 60_000));
    return () => { timers.forEach(clearTimeout); };
  }, [isScheduled]);

  // Smooth Circle radius transition on phase change (2000m → 3500m on
  // expansion). Uses setInterval at 50ms to cap map re-renders.
  useEffect(() => {
    const target = phase === 'searching' ? 2000 : 3500;
    const startValue = radiusRef.current;
    if (Math.abs(startValue - target) < 5) return;
    const duration = 1200;
    const startTime = Date.now();
    const t = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCircleRadius(startValue + (target - startValue) * eased);
      if (progress >= 1) clearInterval(t);
    }, 50);
    return () => clearInterval(t);
  }, [phase]);

  const now = useNow(10000);

  const recenter = () => {
    mapRef.current?.animateToRegion({
      ...missionCoord, latitudeDelta: 0.012, longitudeDelta: 0.012,
    }, 400);
  };

  const priceLabel = useMemo(() => {
    if (missionPrice == null || missionPrice === '') return null;
    const n = typeof missionPrice === 'number' ? missionPrice : parseFloat(String(missionPrice));
    if (!Number.isFinite(n) || n <= 0) return null;
    return formatEUR(n);
  }, [missionPrice]);

  // Pill carries the phase (state), not the counter — the counter lives in
  // the activity feed below. Duplicating it in the pill doubles the anxiety
  // on long waits. Scheduled missions bypass the phase machine entirely.
  const pillTitle = isScheduled
    ? 'Mission planifiée'
    : phase === 'searching'
      ? 'Recherche en cours…'
      : phase === 'expanding'
        ? 'Expansion du rayon…'
        : 'Recherche élargie';
  const pillSub = isScheduled
    ? 'Un prestataire acceptera bientôt'
    : phase === 'searching'
      ? 'Nous contactons les prestataires disponibles'
      : phase === 'expanding'
        ? 'Recherche élargie autour de votre adresse'
        : 'Un prestataire va répondre sous peu';

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      {/* Carte */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
        initialRegion={{ ...missionCoord, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
        showsCompass={false}
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Circle
          center={missionCoord}
          radius={circleRadius}
          strokeColor={accent + '55'}
          fillColor={accent + '10'}
          strokeWidth={1}
        />
        {providers.map((p, i) => (
          <ProviderPin key={p.id} p={p} delay={i * 300} theme={theme} />
        ))}
        <UserPin coord={missionCoord} surface={theme.cardBg as string} />
      </MapView>

      {/* Top bar — no back button during active search. Accidentally tapping
          back mid-matching would surface the dashboard while the user is
          still "in flight", which is confusing. Cancel lives in the sheet. */}
      <SafeAreaView edges={['top']} style={s.topArea} pointerEvents="box-none">
        <View style={s.topBar}>
          <BlurView
            intensity={40}
            tint={theme.isDark ? 'dark' : 'light'}
            style={[s.searchPill, { backgroundColor: theme.isDark ? 'rgba(20,20,20,0.6)' : 'rgba(255,255,255,0.7)', shadowColor: theme.text }]}
          >
            <Spinner color={accent} track={theme.borderLight as string} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.pillTitle, { color: theme.text }]} numberOfLines={1}>
                {pillTitle}
              </Text>
              <Text style={[s.pillSub, { color: fgMuted }]} numberOfLines={1}>
                {pillSub}
              </Text>
            </View>
            {timer ? (
              <View style={[s.timerChip, { backgroundColor: theme.text }]}>
                <Blink><View style={[s.timerDot, { backgroundColor: accent }]} /></Blink>
                <Text style={[s.timerText, { color: theme.bg, fontFamily: FONTS.mono }]}>{timer}</Text>
              </View>
            ) : null}
          </BlurView>
        </View>

        <View style={s.floaters}>
          <Pressable
            style={[s.iconBtn, { backgroundColor: theme.cardBg, shadowColor: theme.text }]}
            onPress={recenter}
            hitSlop={8}
            accessibilityLabel="Recentrer"
          >
            <Feather name="crosshair" size={18} color={theme.text} />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Bottom sheet — single container; safe area inset folded into the
          sheet's own paddingBottom so the rounded top corners and the home
          indicator strip share one continuous surface (no bolted-on band). */}
      <View style={s.sheetWrap} pointerEvents="box-none">
        <View
          style={[
            s.sheet,
            {
              backgroundColor: theme.cardBg,
              shadowColor: theme.text,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <View style={[s.grabber, { backgroundColor: theme.borderLight }]} />

          {/* Mission */}
          <View style={[s.mission, { borderBottomColor: theme.border }]}>
            <Text style={[s.kicker, { color: fgMuted, fontFamily: FONTS.mono }]}>
              Mission · #{String(missionId).slice(-6).toUpperCase()}
            </Text>
            <Text style={[s.missionTitle, { color: theme.text, fontFamily: FONTS.bebas }]} numberOfLines={1}>
              {missionTitle || 'Mission'}
            </Text>
            <View style={s.metaRow}>
              {!!missionAddress && (
                <View style={s.metaItem}>
                  <Feather name="map-pin" size={12} color={fgMuted} />
                  <Text style={[s.metaText, { color: theme.textSub, fontFamily: FONTS.sans }]} numberOfLines={1}>
                    {missionAddress.split(',')[0]}
                  </Text>
                </View>
              )}
              <View style={s.metaItem}>
                <Feather name="clock" size={12} color={fgMuted} />
                <Text style={[s.metaText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
                  {missionWhen || 'Dès maintenant'}
                </Text>
              </View>
              {priceLabel && (
                <View style={s.metaItem}>
                  <Feather name="tag" size={12} color={fgMuted} />
                  <Text style={[s.metaText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
                    {priceLabel}
                  </Text>
                </View>
              )}
              {isQuote && !priceLabel && (
                <View style={s.metaItem}>
                  <Feather name="file-text" size={12} color={COLORS.amber} />
                  <Text style={[s.metaText, { color: COLORS.amber, fontFamily: FONTS.sansMedium }]}>Devis</Text>
                </View>
              )}
            </View>
          </View>

          {/* Activité */}
          <View style={{ marginBottom: 16 }}>
            <View style={s.activityHead}>
              <Text style={[s.kicker, { color: fgMuted, fontFamily: FONTS.mono }]}>Activité</Text>
              <View style={s.liveTag}>
                <Blink period={1200}><View style={[s.liveDot, { backgroundColor: accent }]} /></Blink>
                <Text style={[s.liveText, { color: accent, fontFamily: FONTS.sansMedium }]}>En direct</Text>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              {feed.slice(0, phase === 'widened' ? 1 : 3).map(it => (
                <Animated.View
                  key={it.id}
                  entering={FadeInDown.duration(320).springify().damping(18)}
                  exiting={FadeOut.duration(180)}
                  layout={LinearTransition.springify().damping(20).stiffness(140)}
                  style={s.feedItem}
                >
                  {it.pulse ? (
                    <Blink period={1100}>
                      <View style={[s.feedDot, { borderWidth: 1.5, borderColor: accent, backgroundColor: 'transparent' }]} />
                    </Blink>
                  ) : (
                    <View style={[s.feedDot, { backgroundColor: fgMuted }]} />
                  )}
                  <Text style={[s.feedText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
                    {it.text}
                    <Text style={[s.feedTime, { color: fgMuted, fontFamily: FONTS.mono }]}>  {timeAgo(it.createdAt, now)}</Text>
                  </Text>
                </Animated.View>
              ))}
            </View>
          </View>

          {/* Reassurance — the price card above can be heavy (€€€), so remind
              the user that we don't debit until the provider accepts. */}
          <View style={s.reassurance}>
            <Feather name="shield" size={12} color={fgMuted} />
            <Text style={[s.reassuranceText, { color: fgMuted, fontFamily: FONTS.sans }]}>
              Paiement sécurisé Stripe · débit à l'acceptation
            </Text>
          </View>

          {/* Cancel — ghost, secondary. Waiting is the primary action, there
              is no primary CTA to press during matching. */}
          <Pressable
            style={({ pressed }) => [s.cancelGhost, (pressed || cancelling) && { opacity: 0.55 }]}
            onPress={onCancel}
            disabled={cancelling}
            accessibilityRole="button"
            accessibilityLabel="Annuler la recherche"
            hitSlop={8}
          >
            <Text style={[s.cancelGhostText, { color: cancelling ? fgMuted : COLORS.red, fontFamily: FONTS.sansMedium }]}>
              {cancelling ? 'Annulation…' : 'Annuler la recherche'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  topArea: { position: 'absolute', top: 0, left: 0, right: 0 },
  topBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 6 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, height: 44, borderRadius: 22, overflow: 'hidden',
    shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pillTitle: { fontSize: 13, fontFamily: FONTS.sansMedium, letterSpacing: -0.2 },
  pillSub: { fontSize: 11, marginTop: 1 },
  timerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, height: 28, borderRadius: 14,
  },
  timerDot: { width: 5, height: 5, borderRadius: 2.5 },
  timerText: { fontSize: 11, fontWeight: '600' },

  floaters: { position: 'absolute', top: 110, right: 12, gap: 8 },

  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 8,
    // paddingBottom is applied inline (insets.bottom + 12) to keep the home
    // indicator strip on the same opaque surface as the sheet.
    shadowOpacity: 0.12, shadowRadius: 40, shadowOffset: { width: 0, height: -12 },
    elevation: 12,
  },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

  mission: { paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1 },
  kicker: { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  missionTitle: { fontSize: 26, letterSpacing: 0.4, marginTop: 4, marginBottom: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12 },

  activityHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5 },
  liveText: { fontSize: 10, letterSpacing: 0.3, textTransform: 'uppercase' },
  feedItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  feedDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  feedText: { flex: 1, fontSize: 12, lineHeight: 17 },
  feedTime: { fontSize: 10 },

  reassurance: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8,
  },
  reassuranceText: { fontSize: 11, letterSpacing: 0.1 },

  cancelGhost: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, marginBottom: 6,
  },
  cancelGhostText: { fontSize: 13, letterSpacing: 0.2, textDecorationLine: 'underline' },

  pinCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 24, padding: 4, minHeight: 40,
    shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pinAvatar: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  pinAvatarText: { fontSize: 12, fontFamily: FONTS.sansMedium },
  pinRating: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8 },
  pinRatingText: { fontSize: 11, fontFamily: FONTS.sansMedium },
  pinBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 12, height: 12, borderRadius: 6, borderWidth: 2,
  },
  pinTail: {
    position: 'absolute', bottom: -5, left: 18,
    width: 10, height: 10, transform: [{ rotate: '45deg' }],
  },
});
