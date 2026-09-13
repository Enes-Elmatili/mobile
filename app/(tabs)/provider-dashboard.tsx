/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// app/(tabs)/provider-dashboard.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  StatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  cancelAnimation,
  LinearTransition,
  Easing as REasing,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import { useReduceMotion, dampingFor } from '@/lib/motion/sheet';
import { spring } from '@/lib/motion/springs';
import { useBreathe } from '@/lib/motion/useBreathe';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import { briefOf, type MissionBrief } from '@/lib/mission/brief';
import { IncomingMissionCard } from '@/components/mission/IncomingMissionCard';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { TAB_BAR_HEIGHT } from './_layout';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { useNetwork } from '@/lib/NetworkContext';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAppTheme, FONTS, COLORS, darkTokens } from '@/hooks/use-app-theme';
import { formatEURCents as formatEuros } from '@/lib/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { devWarn, devLog } from '@/lib/logger';
import { cleanName } from '@/lib/displayName';
import { isOnlineStatus, gateCopyFor } from '@/lib/providerGate';

const TIMER_DURATION = 60;

// Entrée de la carte de mission entrante : spring critique (ζ = 1.0).
// Remplace `tension: 55, friction: 11`, qui était sous-amorti — la carte
// dépassait sa position et revenait. Une notification de mission doit se poser,
// pas rebondir (CLAUDE.md § Interfaces fluides, règle 2).
const CARD_ENTER_SPRING = {
  damping: dampingFor(1.0, 180, 1),
  stiffness: 180,
  mass: 1,
};

// -- Map style "Light Mono" --
// -- Map styles (source unique) --
import { MAP_STYLE_LIGHT, MAP_STYLE_DARK } from '@/constants/mapStyles';

// ============================================================================
// UTILS
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

interface WalletData {
  balance: number;
  pendingAmount: number;
  totalEarnings: number;
  monthEarnings: number;
  escrowAmount: number;
  stripeAvailable: number; // solde Stripe réel (cents) — cohérent avec l'onglet Gains
}

interface ProviderStats {
  jobsCompleted: number;
  avgRating: number;
  totalRatings: number;
  rank: number | null;
}

interface IncomingRequest {
  requestId: string;
  title: string;
  description: string;
  price: number;
  address: string;
  urgent: boolean;
  distance?: number;
  clientId?: string;
  client: { name: string; avatarUrl?: string | null; city?: string | null };
  latitude?: number;
  longitude?: number;
  isQuote?: boolean;
  pricingMode?: string;
  calloutFee?: number;
  /** Fiche mission (services/missionBrief) — celle du serveur, sinon le repli. */
  brief: MissionBrief;
}

// ============================================================================
// AVATAR MARKER
// ============================================================================

// Marker GPS provider — exactement le même style que le marker d'adresse dans
// NewRequestStepper côté client : halo vert translucide + dot vert bordure blanche.
// Statique, pas d'animation.
function AvatarMarker(_props: { heading?: number }) {
  return (
    <View style={av.wrap}>
      <View style={av.halo} />
      <View style={av.dot} />
    </View>
  );
}

const av = StyleSheet.create({
  wrap: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  halo: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(52,199,89,0.2)',
  },
  dot: {
    position: 'absolute',
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.green,
    borderWidth: 2, borderColor: darkTokens.bg,
  },
});

// ============================================================================
// INCOMING JOB CARD
// ============================================================================

function IncomingJobCard({
  request,
  onAccept,
  onDecline,
}: {
  request: IncomingRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduced    = useReduceMotion();
  const slideUp    = useSharedValue(400);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (reduced) {
      // Règle 8 : pas de course, on pose l'état final.
      slideUp.value = 0;
      return;
    }
    // Entrée : spring critique (ζ = 1.0) — arrive vite, ne dépasse pas.
    slideUp.value = withSpring(0, CARD_ENTER_SPRING);
    return () => { cancelAnimation(slideUp); };
  }, [reduced, slideUp]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideUp.value }] }));

  useEffect(() => {
    const iv = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(iv); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // When countdown reaches 0, switch to "last chance" mode instead of dismissing
  useEffect(() => {
    if (timeLeft === 0) setExpired(true);
  }, [timeLeft]);

  const sheetBg = theme.bg;

  return (
    <Reanimated.View style={[jc.wrap, { bottom: insets.bottom }, cardStyle]}>
      {/* Gradient map → sheet */}
      <LinearGradient
        colors={['transparent', `${sheetBg}99`, sheetBg]}
        locations={[0, 0.4, 1]}
        style={jc.topFade}
        pointerEvents="none"
      />
      <View style={[jc.sheet, { backgroundColor: sheetBg }]}>
        <View style={[jc.handle, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)' }]} />
        {/* Fiche mission (planche 2A) : quoi, photos, faits, gain, glissé. */}
        <IncomingMissionCard
          brief={request.brief}
          timeLeft={timeLeft}
          total={TIMER_DURATION}
          expired={expired}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      </View>
    </Reanimated.View>
  );
}

const jc = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0,
    shadowColor: '#000', shadowRadius: 40, shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.3,
    elevation: 28,
  },
  topFade: { height: 56 },
  sheet: { paddingBottom: 56 },
  handle: { width: 36, height: 3, borderRadius: 2, alignSelf: 'center', marginTop: 14 },


  // Title


  // Divider

  // Info



  // CTA
  passText: { fontFamily: FONTS.sans, fontSize: 13, letterSpacing: 0.3 },
});

// ============================================================================
// COCKPIT ISLAND
// ============================================================================

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

function CockpitIsland({
  isOnline,
  wallet,
  onToggle,
  onWalletPress,
}: {
  isOnline: boolean;
  wallet: WalletData | null;
  onToggle: () => void;
  onWalletPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  // Règle 4 : le retour part de l'appui, pas du relâchement.
  const press = usePressScale();
  // Règle 1 : shared values Reanimated (thread UI) — le pouls ne saccade plus
  // quand le JS est occupé par un fetch ou une rafale d'événements socket.
  const dotGlow      = useSharedValue(0.5);
  const pulseScale   = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOnline && !reduced) {
      // Respiration du point : opacité 0.5 ↔ 1, aller-retour infini.
      dotGlow.value = withRepeat(
        withTiming(1, { duration: 1400, easing: REasing.inOut(REasing.ease) }),
        -1,
        true,
      );
      // Ping radar : anneau qui part du centre et s'efface, puis reset instantané.
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(3, { duration: 1200, easing: REasing.out(REasing.ease) }),
        ),
        -1,
        false,
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 0 }),
          withTiming(0, { duration: 1200, easing: REasing.out(REasing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      // Sortie douce : on coupe la boucle puis on ramène en fondu, au lieu du
      // `setValue` sec de l'ancienne version qui faisait disparaître d'un coup.
      cancelAnimation(dotGlow);
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      dotGlow.value      = withTiming(0.5, { duration: 180 });
      pulseOpacity.value = withTiming(0, { duration: 180 });
      pulseScale.value   = withTiming(1, { duration: 180 });
    }
  }, [isOnline, reduced, dotGlow, pulseScale, pulseOpacity]);

  const dotGlowStyle = useAnimatedStyle(() => ({ opacity: dotGlow.value }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  // Moment 7 : le passage en ligne se réchauffe. Le fond et le texte
  // glissent vers leur couleur « en ligne » (k 200), le point prend (1,25 → 1),
  // et le libellé ne change que quand la couleur est arrivée. Hors ligne joue
  // l'inverse, plus vite (k 600) : on ne fête pas une déconnexion.
  const online01 = useSharedValue(isOnline ? 1 : 0);
  const [labelOnline, setLabelOnline] = useState(isOnline);
  const dotTake = useBreathe(1.25);
  useEffect(() => {
    if (reduced) { online01.value = isOnline ? 1 : 0; setLabelOnline(isOnline); return; }
    if (isOnline) dotTake.pulse();
    online01.value = withSpring(isOnline ? 1 : 0, spring(isOnline ? 200 : 600, 1.0), (finished) => {
      if (finished) runOnJS(setLabelOnline)(isOnline);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dotTake est stable
  }, [isOnline, reduced, online01]);
  const offBg = theme.isDark ? 'rgba(255,255,255,0.08)' : (theme.surface as string);
  const sectionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(online01.value, [0, 1], [offBg, theme.cardBg as string]),
  }));
  const onlineTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(online01.value, [0, 1], [theme.textMuted as string, theme.text as string]),
  }));
  const dotColorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(online01.value, [0, 1], [theme.textMuted as string, theme.text as string]),
  }));

  const handlePress = () => {
    // L'haptique est déjà émise par handleToggleOnline, sur la même frame que
    // le changement d'état — on ne double pas le retour (règle 6).
    onToggle();
  };

  return (
    <Reanimated.View
      layout={reduced ? undefined : LinearTransition.springify().damping(28).stiffness(200)}
      style={[ci.island, { backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', shadowOpacity: theme.shadowOpacity > 0.06 ? theme.shadowOpacity : 0.1 }, press.style]}
    >

      {/* Statut */}
      <AnimatedPressable
        onPress={handlePress}
        {...press.handlers}
        style={[ci.statusSection, sectionStyle]}
        accessibilityLabel={isOnline ? t('provider.online') : t('provider.offline')}
        accessibilityRole="switch"
        accessibilityState={{ checked: isOnline }}
        hitSlop={{ top: 6, bottom: 6 }}
      >
        <View style={ci.dotWrap}>
          {isOnline && (
            <Reanimated.View style={[ci.dotGlow, dotGlowStyle, { backgroundColor: theme.text }]} />
          )}
          <Reanimated.View style={[ci.pulseRing, pulseStyle, { backgroundColor: isOnline ? theme.text : theme.textMuted }]} />
          <Reanimated.View style={[ci.dot, dotColorStyle, dotTake.style]} />
        </View>
        <Reanimated.Text style={[ci.statusText, onlineTextStyle]}>
          {labelOnline ? t('provider.online') : t('provider.offline')}
        </Reanimated.Text>
      </AnimatedPressable>

      {/* Separateur */}
      <View style={[ci.sep, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />

      {/* Wallet */}
      <TouchableOpacity onPress={onWalletPress} activeOpacity={0.75} style={ci.walletBtn} accessibilityLabel={t('provider.balance_label')} accessibilityRole="button" hitSlop={{ top: 6, bottom: 6 }}>
        <Feather name="credit-card" size={16} color={theme.text} />
        <Text style={[ci.walletAmount, { color: theme.text }]} numberOfLines={1}>{formatEuros((wallet?.stripeAvailable ?? 0) / 100, 0)}</Text>
      </TouchableOpacity>

    </Reanimated.View>
  );
}

const ci = StyleSheet.create({
  island: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 36,
    height: 40,
    paddingHorizontal: 4,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 114,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    gap: 5,
    justifyContent: 'center',
  },
  dotWrap:   { width: 7, height: 7, alignItems: 'center', justifyContent: 'center' },
  dotGlow:   { position: 'absolute', width: 15, height: 15, borderRadius: 7.5 },
  pulseRing: { position: 'absolute', width: 7, height: 7, borderRadius: 3.5 },
  dot:       { width: 7, height: 7, borderRadius: 3.5 },
  statusText:  { fontSize: 10.5, fontFamily: FONTS.sansMedium, letterSpacing: 0.3 },
  sep: { width: 1, height: 11, marginHorizontal: 2 },
  walletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 12,
    marginRight: 3,
  },
  walletAmount: { fontSize: 13, fontFamily: FONTS.monoMedium, letterSpacing: -0.3 },
});

// ============================================================================
// STATS KPI
// ============================================================================

function StatsSection({ loading, stats }: { loading: boolean; stats: ProviderStats }) {
  const t = useAppTheme();
  if (loading) {
    return (
      <View style={[ss.loadingRow, { backgroundColor: t.surface }]}>
        {[0,1,2].map(i => (
          <View key={i} style={[ss.shimmer, { backgroundColor: t.border }]} />
        ))}
      </View>
    );
  }
  return (
    <View style={[ss.kpiRow, { backgroundColor: t.cardBg, borderColor: t.borderLight }]}>
      <View style={ss.kpiItem}>
        <Text style={[ss.kpiNum, { color: t.text }]}>{stats.jobsCompleted}</Text>
        <Text style={[ss.kpiLabel, { color: t.textMuted }]}>MISSIONS</Text>
      </View>
      <View style={[ss.kpiSep, { backgroundColor: t.border }]} />
      <View style={ss.kpiItem}>
        <Text style={[ss.kpiNum, ss.kpiGold]}>
          {stats.totalRatings > 0
            ? <>{stats.avgRating.toFixed(1)} <Feather name="star" size={12} color={COLORS.amber} /></>
            : <Text style={{ color: t.textMuted }}>—</Text>}
        </Text>
        <Text style={[ss.kpiLabel, { color: t.textMuted }]}>NOTE</Text>
      </View>
      <View style={[ss.kpiSep, { backgroundColor: t.border }]} />
      <View style={ss.kpiItem}>
        <Text style={[ss.kpiNum, { color: t.text }]}>{stats.rank != null ? `#${stats.rank}` : '—'}</Text>
        <Text style={[ss.kpiLabel, { color: t.textMuted }]}>RANG</Text>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row', gap: 8,
    borderRadius: 18, padding: 16,
  },
  shimmer: {
    flex: 1, height: 28, borderRadius: 6,
  },
  kpiRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, padding: 14,
    borderWidth: 1,
  },
  kpiItem:  { flex: 1, alignItems: 'center', gap: 4 },
  kpiSep:   { width: 1, height: 32 },
  kpiNum:   { fontSize: 16, fontFamily: FONTS.bebas, includeFontPadding: false, letterSpacing: -0.3 },
  kpiGold:  { color: COLORS.amber },
  kpiLabel: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 0.4 },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProviderDashboard() {
  const router           = useRouter();
  const { t }            = useTranslation();
  const { user }         = useAuth();
  const { socket, unreadCount, unreadMessages } = useSocket();
  const { isOnline: networkOnline } = useNetwork();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const mapRef   = useRef<MapView>(null);
  const fadeAnim = useSharedValue(0);
  const [mapReady, setMapReady] = useState(false);


  const [location,      setLocation]      = useState<{ latitude: number; longitude: number } | null>(null);
  const [heading,       setHeading]        = useState(0);
  const [, setLocationError] = useState(false);
  const [wallet,        setWallet]         = useState<WalletData | null>(null);
  const [stats, setStats]     = useState<ProviderStats>({ jobsCompleted: 0, avgRating: 0, totalRatings: 0, rank: null });
  const [statsLoading,  setStatsLoading]  = useState(true);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);

  // Mission active actuelle (acceptée et en cours, non planifiée future) →
  // permet au provider qui revient sur le dashboard de re-rentrer dans la mission.
  const [currentMission, setCurrentMission] = useState<{
    id: number; serviceType: string | null; status: string; address: string | null;
  } | null>(null);
  const [loading,       setLoading]        = useState(true);
  const [isOnline,      setIsOnline]       = useState(false);
  const isOnlineRef = useRef(false);
  const declinedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 700, easing: REasing.out(REasing.ease) });
  }, [fadeAnim]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

  // Geolocalisation
  const dashLocSubRef = useRef<Location.LocationSubscription | null>(null);
  const dashLastEmitRef = useRef(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) { if (!cancelled) setLocationError(true); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (cancelled) return;
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setLocation(coords);
      if (loc.coords.heading != null) setHeading(loc.coords.heading);

      // Sync initial position to backend so matching can find this provider
      if (socket && user?.id) {
        socket.emit('provider:location_update', { providerId: user.id, ...coords });
      }

      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.035, longitudeDelta: 0.035 }, 900);

      const sub = await Location.watchPositionAsync(
        // distanceInterval réduit (10 m) + timeInterval court (3 s) pour que
        // l'auto-recenter de la map suive bien les mouvements. Le throttle du
        // socket emit reste à 15s pour ne pas spammer le backend.
        { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 3000 },
        (l) => {
          const c = { latitude: l.coords.latitude, longitude: l.coords.longitude };
          setLocation(c);
          if (l.coords.heading != null) setHeading(l.coords.heading);

          const now = Date.now();
          if (now - dashLastEmitRef.current >= 15_000 && socket && isOnlineRef.current && networkOnline && user?.id) {
            dashLastEmitRef.current = now;
            socket.emit('provider:location_update', { providerId: user.id, ...c });
          }
        }
      );
      if (cancelled) { sub.remove(); return; }
      dashLocSubRef.current = sub;
    })();
    return () => {
      cancelled = true;
      if (dashLocSubRef.current) { dashLocSubRef.current.remove(); dashLocSubRef.current = null; }
    };
  }, []);

  // Auto-recenter la map à chaque mise à jour de position.
  // Bloqué par mapReady : react-native-maps 1.20+ avec PROVIDER_GOOGLE ignore
  // silencieusement animateToRegion tant que onMapReady n'a pas été émis,
  // c'est pourquoi le premier auto-center sautait sans erreur.
  useEffect(() => {
    if (!location || !mapReady) return;
    mapRef.current?.animateToRegion(
      { ...location, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      700,
    );
  }, [location, mapReady]);

  // Fallback : si onMapReady ne fire pas dans les 3 secondes (Google Maps SDK
  // qui silencie parfois l'event sur iOS / simulateur), on force mapReady=true
  // pour débloquer l'auto-recenter. animateToRegion no-op si réellement pas prêt.
  useEffect(() => {
    if (mapReady) return;
    const t = setTimeout(() => setMapReady(true), 3000);
    return () => clearTimeout(t);
  }, [mapReady]);

  // Data
  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      api.wallet.balance(),
      api.user.me(),
      api.dashboard.provider(),
      api.providers.missions(),
      api.connect.balance(),
    ]);

    const dashData = results[2].status === 'fulfilled' ? (results[2].value as any) : null;
    const monthEarnings = dashData?.stats?.monthEarnings?.total || 0;
    // Vrai solde Stripe (cents) — même source que l'onglet Gains
    const stripeAvailable = results[4].status === 'fulfilled' ? ((results[4].value as any)?.available ?? 0) : 0;

    if (results[0].status === 'fulfilled') {
      const w = results[0].value as any;
      setWallet({
        balance:         w.balance        || 0,
        pendingAmount:   w.pendingAmount  || 0,
        totalEarnings:   w.totalEarnings  || 0,
        monthEarnings,
        escrowAmount:    w.escrowAmount   || 0,
        stripeAvailable,
      });
    } else {
      devWarn('Wallet failed:', (results[0] as PromiseRejectedResult).reason?.message);
    }

    // KPI stats depuis /provider/dashboard (results[2]) : /auth/me ne renvoie PAS
    // ces champs (jobsCompleted/avgRating/totalRatings/rankScore) → d'où les zéros.
    if (dashData?.provider) {
      const pv = dashData.provider;
      setStats({
        jobsCompleted: pv.jobsCompleted ?? 0,
        avgRating:     pv.avgRating     ?? 0,
        totalRatings:  pv.totalRatings  ?? 0,
        rank:          pv.rank          ?? null,
      });
    } else if (results[2].status === 'rejected') {
      devWarn('Stats failed:', (results[2] as PromiseRejectedResult).reason?.message);
    }

    // Mission active : ACCEPTED/ONGOING/QUOTE_SENT/QUOTE_ACCEPTED, non planifiée future.
    // On ouvre le re-entry dans la mission pour le provider qui revient sur le dashboard.
    if (results[3].status === 'fulfilled') {
      const m = (results[3].value as any)?.items || [];
      const ACTIVE = ['ACCEPTED', 'ONGOING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'];
      const found = m.find((r: any) => {
        if (!ACTIVE.includes(r.status)) return false;
        if (r.preferredTimeStart) {
          const startTs = new Date(r.preferredTimeStart).getTime();
          if (startTs > Date.now() + 30 * 60 * 1000) return false; // >30 min futur → "à venir"
        }
        return true;
      });
      setCurrentMission(found ? {
        id: found.id, serviceType: found.serviceType, status: found.status, address: found.address,
      } : null);
    }

    setStatsLoading(false);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  // Refetch quand le provider revient sur le dashboard (après /ongoing par ex.)
  // pour rafraîchir la bannière "mission en cours".
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Load current incoming queue via REST — hydrates the card list on dashboard open
  // so the provider sees existing "now" + devis requests without waiting for the next
  // socket rebroadcast tick. Scheduled-for-future requests live in the missions tab.
  // Extracted as a stable callback so we can re-invoke on socket (re)connect.
  // In-flight guard: mount, socket 'connect', and the 20s polling timer can
  // all fire this within a few ms of each other; coalesce to a single GET.
  const incomingInFlightRef = useRef(false);
  // Hard-stop guard: once the backend tells us this account isn't a provider
  // (token has PROVIDER role flag but no provider profile exists), there's no
  // point re-trying every 20s and spamming logs. Latch it for the session and
  // bounce the user back to the client dashboard.
  const notProviderRef = useRef(false);
  const fetchIncomingQueue = useCallback(async () => {
    if (!user?.id) return;
    if (notProviderRef.current) return;
    if (incomingInFlightRef.current) return;
    incomingInFlightRef.current = true;
    try {
      const res: any = await api.get('/requests/incoming');
      const items = res?.data || res || [];
      if (Array.isArray(items) && items.length > 0) {
        const mapped: IncomingRequest[] = items.map((r: any) => ({
          requestId: String(r.id),
          title: r.serviceType || r.category?.name || 'Mission',
          description: r.description || '',
          price: r.price || 0,
          address: r.address || '',
          latitude: r.lat,
          longitude: r.lng,
          urgent: r.urgent || false,
          pricingMode: r.pricingMode,
          isQuote: r.status === 'QUOTE_PENDING',
          calloutFee: r.calloutFee ?? undefined,
          brief: briefOf(r),
          client: { name: r.client?.name || 'Client' },
        }));
        setIncomingRequests(prev => {
          const existingIds = new Set(prev.map(r => r.requestId));
          const newOnes = mapped.filter((r: any) =>
            !existingIds.has(r.requestId) && !declinedIdsRef.current.has(r.requestId)
          );
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
        });
      }
    } catch (e: any) {
      if (e?.status === 403 && e?.data?.code === 'NOT_PROVIDER') {
        notProviderRef.current = true;
        devWarn('⚠️ Account is not a provider — redirecting to client dashboard');
        router.replace('/(tabs)/dashboard');
      }
    } finally {
      incomingInFlightRef.current = false;
    }
  }, [user?.id, router]);

  useEffect(() => {
    fetchIncomingQueue();
  }, [fetchIncomingQueue]);

  // Polling safety net : rafraîchit /requests/incoming toutes les 20s tant que
  // le provider est online. Garantit l'apparition des cards même si le socket
  // rate un event (cas : register pas encore enregistré sur le backend quand
  // le new_request est émis, latence réseau, buffering, etc.).
  useEffect(() => {
    if (!user?.id || !isOnline) return;
    if (notProviderRef.current) return;
    const iv = setInterval(() => {
      fetchIncomingQueue();
    }, 20000);
    return () => clearInterval(iv);
  }, [user?.id, isOnline, fetchIncomingQueue]);

  // Socket
  useEffect(() => {
    if (!socket || !user?.id) return;

    // Helper: register + refresh incoming queue. Called on mount (if already connected)
    // AND on every (re)connect, so a brief network blip doesn't leave the provider in a
    // zombie state where the server doesn't know their socket and they miss new_request
    // events. Without this, the provider could wait up to 45s (next rebroadcast tick)
    // before seeing an incoming card.
    const registerAndRefresh = () => {
      socket.emit('provider:register', { providerId: user.id });
      // Ne PAS présumer « en ligne » ici : le serveur ne met en READY qu'un
      // prestataire validé. Affirmer true à chaque (re)connexion affichait
      // « En ligne » à un prestataire que le backend gardait OFFLINE — le
      // switch mentait sans qu'aucune action de l'utilisateur ne l'explique.
      // L'état réel arrive via provider:registered ci-dessous.
      fetchIncomingQueue();
    };

    if (socket.connected) {
      registerAndRefresh();
    }

    const handleNewRequest = (data: any) => {
      const rid = String(data.requestId ?? data.id);
      if (declinedIdsRef.current.has(rid)) return; // already declined, ignore rebroadcast
      feedback.haptic('warning');
      const lat = data.latitude ?? data.lat;
      const lng = data.longitude ?? data.lng;
      const req: IncomingRequest = {
        requestId:   String(data.requestId ?? data.id),
        title:       data.title || data.serviceType || t('provider.mission'),
        description: data.description || '',
        price:       data.price ?? 0,
        address:     data.address || t('provider.unknown_address'),
        urgent:      data.urgent || false,
        distance:    data.distance,
        clientId:    data.clientId || data.client?.id,
        client:      { name: data.client?.name || data.clientName || t('provider.client'), avatarUrl: data.client?.avatarUrl || null, city: data.client?.city || null },
        latitude:    lat,
        longitude:   lng,
        isQuote:     data.isQuote || false,
        pricingMode: data.pricingMode || null,
        calloutFee:  data.calloutFee ?? undefined,
        brief:       briefOf(data),
      };
      setIncomingRequests(prev => prev.some(r => r.requestId === req.requestId) ? prev : [req, ...prev]);
      if (lat && lng) {
        mapRef.current?.animateToRegion({
          latitude: lat, longitude: lng,
          latitudeDelta: 0.02, longitudeDelta: 0.02,
        }, 600);
      }
    };

    const removeRequest = (id: string | number) =>
      setIncomingRequests(prev => prev.filter(r => r.requestId !== String(id)));

    // Client a annulé → retirer la carte (payload objet { id, ... })
    const handleCancelled = (data: any) => removeRequest(data?.id ?? data);

    const handleStatusUpdate = (data: { providerId: string; status: string }) => {
      if (data.providerId === user.id) {
        const online = isOnlineStatus(data.status);
        isOnlineRef.current = online;
        setIsOnline(online);
      }
    };

    // Réponse du serveur à provider:register — porte le statut réel du compte.
    // Un dossier non validé revient en 'pending_validation' : le switch doit
    // refléter ça, pas un optimisme local.
    const handleRegistered = (data: any) => {
      // server.js émet { providerId, status, blocked? } ; on accepte aussi la
      // forme imbriquée au cas où un ancien serveur répondrait { provider }.
      const online = isOnlineStatus(data?.status ?? data?.provider?.status);
      isOnlineRef.current = online;
      setIsOnline(online);
      if (!online) setIncomingRequests([]);
    };

    // Le serveur refuse le passage en ligne (dossier incomplet ou Stripe non
    // finalisé). On remet le switch sur la vérité serveur et on propose
    // d'aller finir l'étape manquante — volet coulissant, pas d'alerte système.
    const handleStatusRejected = async (data: { code?: string; message?: string; status?: string }) => {
      const online = isOnlineStatus(data?.status);
      isOnlineRef.current = online;
      setIsOnline(online);
      if (!online) setIncomingRequests([]);
      feedback.haptic('warning');

      const copy = gateCopyFor(data?.code);
      const go = await feedback.confirm({
        titleKey:   copy.titleKey,
        messageKey: copy.messageKey,
        confirmKey: copy.confirmKey,
        cancelKey:  copy.cancelKey,
      });
      if (go) router.push(copy.route);
    };

    socket.on('connect',                registerAndRefresh);
    socket.on('new_request',            handleNewRequest);
    socket.on('request:claimed',        removeRequest);
    socket.on('request:expired',        removeRequest);
    socket.on('request:cancelled',      handleCancelled);
    socket.on('provider:status_update', handleStatusUpdate);
    socket.on('provider:registered',      handleRegistered);
    socket.on('provider:status_rejected', handleStatusRejected);

    return () => {
      socket.off('connect',                registerAndRefresh);
      socket.off('new_request',            handleNewRequest);
      socket.off('request:claimed',        removeRequest);
      socket.off('request:expired',        removeRequest);
      socket.off('request:cancelled',      handleCancelled);
      socket.off('provider:status_update', handleStatusUpdate);
      socket.off('provider:registered',      handleRegistered);
      socket.off('provider:status_rejected', handleStatusRejected);
    };
  }, [socket, user?.id, fetchIncomingQueue]);

  // Toggle online
  const handleToggleOnline = useCallback(() => {
    if (!user?.id) return;
    const next = !isOnline;
    isOnlineRef.current = next;
    setIsOnline(next);
    feedback.haptic(next ? 'medium' : 'light');
    // providerId retiré du payload : le serveur prend l'identité sur le socket
    // authentifié (il l'ignore désormais côté backend).
    if (socket) socket.emit('provider:set_status', { status: next ? 'READY' : 'OFFLINE' });
    if (!next) setIncomingRequests([]);
    if (next && location) {
      mapRef.current?.animateToRegion({ ...location, latitudeDelta: 0.035, longitudeDelta: 0.035 }, 700);
    }
  }, [isOnline, socket, user?.id, location]);

  // Accept — REST call (reliable) + socket notification (real-time bonus)
  const handleAccept = useCallback(async (request: IncomingRequest) => {
    if (!user?.id) return;

    try {
      const res: any = await api.post(`/requests/${request.requestId}/accept`);
      if (res?.code === 'REQUEST_ACCEPTED' || res?.data) {
        feedback.haptic('success');
        setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));

        // Mission planifiée pour plus tard ? Pas de redirection vers /ongoing — la mission
        // n'est pas encore active (pas sur place, pas de PIN à vérifier). Elle ira dans
        // l'onglet « À venir » de Missions, le provider la lancera depuis là le jour J.
        const startTs = res?.data?.preferredTimeStart ? new Date(res.data.preferredTimeStart).getTime() : null;
        const isFutureScheduled = startTs != null && startTs > Date.now() + 30 * 60 * 1000;

        if (isFutureScheduled) {
          feedback.info('provider.mission_accepted_scheduled_msg');
        } else {
          router.replace(`/request/${request.requestId}/ongoing`);
        }
      } else {
        throw new Error(res?.message || t('common.error'));
      }
    } catch (err: any) {
      const code = err?.response?.data?.code || err?.data?.code;
      declinedIdsRef.current.add(request.requestId);
      setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
      if (code === 'INVALID_STATE' || code === 'ALREADY_TAKEN') {
        feedback.error('provider.mission_unavailable_msg');
      } else {
        const msg = err?.message || err?.data?.message || t('common.error');
        feedback.error(msg);
      }
    }
  }, [user?.id, router]);

  // Explicit decline ("Passer") — refuse backend + never show again
  const handleDecline = useCallback(async (requestId: string) => {
    declinedIdsRef.current.add(requestId);
    try { await api.post(`/requests/${requestId}/refuse`); } catch { /* silent */ }
    setIncomingRequests(prev => prev.filter(r => r.requestId !== requestId));
  }, []);

  const activeJob = incomingRequests[0] || null;

  // -- Loading screen --
  if (loading) {
    return (
      <View style={[s.loadingScreen, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <Feather name="navigation" size={52} color={theme.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,26,0.25)'} />
        <ActivityIndicator size="small" color={theme.textMuted} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* -- Carte plein ecran -- */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={(theme.isDark || activeJob) ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        onMapReady={() => setMapReady(true)}
        initialRegion={{
          latitude:      location?.latitude  ?? 50.8466,
          longitude:     location?.longitude ?? 4.3528,
          latitudeDelta:  0.035,
          longitudeDelta: 0.035,
        }}
      >
        {location && (
          <Marker
            coordinate={location}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={false}
            tracksViewChanges={true}
          >
            <AvatarMarker heading={heading} />
          </Marker>
        )}

        {incomingRequests.map(req =>
          req.latitude && req.longitude ? (
            <Marker
              key={req.requestId}
              coordinate={{ latitude: req.latitude, longitude: req.longitude }}
              title={req.title}
              description={req.address}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={[s.missionMarker, { backgroundColor: COLORS.red, shadowColor: COLORS.red, borderColor: theme.cardBg }]}>
                <Feather name="zap" size={14} color={darkTokens.heroText} />
              </View>
            </Marker>
          ) : null
        )}
      </MapView>

      {/* -- Vignette top -- */}
      <LinearGradient
        colors={theme.isDark ? ['rgba(10,10,10,0.95)', 'rgba(10,10,10,0.6)', 'transparent'] : ['rgba(248,249,251,0.95)', 'rgba(248,249,251,0.6)', 'transparent']}
        style={s.vignetteTop}
        pointerEvents="none"
      />

      {/* == TOP ISLAND == */}
      {!activeJob && (
        <Reanimated.View
          layout={LinearTransition.springify().damping(28).stiffness(200)}
          style={[s.topIsland, { top: insets.top + 8, backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', shadowOpacity: theme.shadowOpacity > 0.06 ? theme.shadowOpacity : 0.1 }, fadeStyle]}
        >

          {/* Ligne 1 -- CockpitIsland + Recenter + Notifs */}
          <View style={s.tiRow}>
            <CockpitIsland
              isOnline={isOnline}
              wallet={wallet}
              onToggle={handleToggleOnline}
              onWalletPress={() => router.push('/wallet')}
            />
            <View style={s.tiActions}>
            <TouchableOpacity
              style={[s.recenterBtn, { backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }]}
              onPress={() => router.push('/messages')}
              activeOpacity={0.8}
              accessibilityLabel="Messages"
              accessibilityRole="button"
              hitSlop={8}
            >
              <Feather name="message-square" size={20} color={theme.text} />
              {unreadMessages > 0 && (
                <View style={[s.notifBadge, { backgroundColor: theme.accent, borderColor: theme.cardBg }]}>
                  <Text style={[s.notifBadgeText, { color: theme.accentText }]}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.recenterBtn, { backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }]}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.8}
              accessibilityLabel={t('common.notifications')}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Feather name="bell" size={20} color={theme.text} />
              {unreadCount > 0 && (
                <View style={[s.notifBadge, { backgroundColor: theme.accent, borderColor: theme.cardBg }]}>
                  <Text style={[s.notifBadgeText, { color: theme.accentText }]}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            </View>
          </View>

          {/* Separateur */}
          <View style={[s.tiSep, { backgroundColor: theme.border }]} />

          {/* Ligne 2 -- Gains hero */}
          <View style={s.earningsLeft}>
            <View style={s.earningsCaptionRow}>
              <Text style={[s.earningsCaption, { color: theme.textMuted }]}>{t('provider.net_earnings_month')}</Text>
            </View>
            <Text style={[s.earningsHero, { color: theme.text }]}>
              {statsLoading ? '—' : formatEuros(wallet?.monthEarnings || 0)}
            </Text>
            {!statsLoading && (wallet?.pendingAmount || 0) + (wallet?.escrowAmount || 0) > 0 && (
              <Text style={[s.pendingSubtext, { color: theme.textMuted }]}>
                +{formatEuros((wallet?.pendingAmount || 0) + (wallet?.escrowAmount || 0))} {t('provider.pending')}
              </Text>
            )}
          </View>

          {/* Ligne 3 -- KPIs */}
          <StatsSection loading={statsLoading} stats={stats} />

        </Reanimated.View>
      )}

      {/* == Pill discrète "mission en cours" — re-entry depuis le dashboard ==
            Floutante en bas (au-dessus de la tab bar). Centrée horizontalement,
            largeur auto. Volontairement minimaliste pour ne pas masquer la map. */}
      {!activeJob && currentMission && (
        <Reanimated.View
          style={[
            s.cmbWrap,
            { bottom: insets.bottom + TAB_BAR_HEIGHT + 12 },
            fadeStyle,
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={[
              s.cmbPill,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                shadowOpacity: theme.shadowOpacity > 0.06 ? theme.shadowOpacity : 0.08,
              },
            ]}
            onPress={() => router.push(`/request/${currentMission.id}/ongoing`)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('provider.resume_mission')}
          >
            <View style={[s.cmbDot, { backgroundColor: COLORS.greenBrand }]} />
            <Text style={[s.cmbLabel, { color: theme.textMuted, fontFamily: FONTS.monoMedium }]}>
              {t('provider.mission_ongoing').toUpperCase()} · #{currentMission.id}
            </Text>
            <Text style={[s.cmbService, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
              {currentMission.serviceType || t('missions.mission')}
            </Text>
            <Feather name="chevron-right" size={14} color={theme.textMuted} />
          </TouchableOpacity>
        </Reanimated.View>
      )}

      {/* -- Pop-up mission entrante -- */}
      {activeJob && (
        <IncomingJobCard
          // Une nouvelle carte = un nouveau compte à rebours et un curseur
          // vierge : sans clé, l'instance (et son état « confirmé ») survit
          // quand la demande suivante prend la place de la précédente.
          key={activeJob.requestId}
          request={activeJob}
          onAccept={() => handleAccept(activeJob)}
          onDecline={() => handleDecline(activeJob.requestId)}
        />
      )}
    </View>
  );
}

// ============================================================================
// STYLES PRINCIPAUX
// ============================================================================

const s = StyleSheet.create({
  root:          { flex: 1 },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center', alignItems: 'center',
  },

  vignetteTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 310,
    zIndex: 9000,
  },

  // -- TOP ISLAND --
  topIsland: {
    position: 'absolute',
    left: 14, right: 14,
    zIndex: 9999,
    borderRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 0,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 12 },
    }),
  },

  tiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tiActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  tiSep: {
    height: 1,
    marginVertical: 8,
  },

  recenterBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { fontSize: 9, fontFamily: FONTS.sansMedium },

  // Earnings
  earningsLeft: { alignItems: 'center', paddingVertical: 4 },
  earningsCaptionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  earningsCaption: {
    fontSize: 10, fontFamily: FONTS.sansMedium,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  earningsHero: {
    fontSize: 34, fontFamily: FONTS.bebas, includeFontPadding: false,
    letterSpacing: -1.5, lineHeight: 40,
    textAlign: 'center',
  },
  pendingSubtext: { fontSize: 12, fontFamily: FONTS.mono, marginTop: 4, textAlign: 'center' },
  invoicedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  invoicedText: { fontSize: 11, fontFamily: FONTS.mono, fontVariant: ['tabular-nums'] as any },

  // Active mission banner (inside island)
  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
    marginTop: 10,
  },
  activeBannerTitle: { fontSize: 14, fontFamily: FONTS.sansMedium },
  activeBannerSub: { fontSize: 11, fontFamily: FONTS.sans, marginTop: 1 },

  // Pill "mission en cours" — minimaliste, centrée bas, ne masque pas la map
  cmbWrap: {
    position: 'absolute',
    left: 0, right: 0,
    // `bottom` calcule dynamiquement (insets.bottom + TAB_BAR_HEIGHT) a l'usage.
    alignItems: 'center',
  },
  cmbPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1,
    maxWidth: '88%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 4 },
    }),
  },
  cmbDot: { width: 6, height: 6, borderRadius: 3 },
  cmbLabel: { fontSize: 10, letterSpacing: 1.2 },
  cmbService: { fontSize: 13, flexShrink: 1 },
  activePulseWrap: {
    width: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  activePulseRing: {
    position: 'absolute',
    width: 8, height: 8, borderRadius: 4,
  },

  // Mission marker
  missionMarker: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5,
    shadowOpacity: 0.5, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
});
