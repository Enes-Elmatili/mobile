/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// app/(tabs)/provider-dashboard.tsx
// Palette : même monochrome que le dashboard client (#F8F9FB / #FFF / #111)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Vibration,
  StatusBar,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSocket } from '@/lib/SocketContext';
import { useNetwork } from '@/lib/NetworkContext';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAppTheme } from '@/hooks/use-app-theme';

const TIMER_DURATION = 15;

// ── Map style "Light Mono" — routes blanches sur fond gris clair ──
const LIGHT_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#F0F0F0' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#888888' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F5F5F5' }] },
  { featureType: 'landscape',          elementType: 'geometry',         stylers: [{ color: '#F8F9FB' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry',         stylers: [{ color: '#EFEFEF' }] },
  { featureType: 'road',               elementType: 'geometry',         stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road',               elementType: 'geometry.stroke',  stylers: [{ color: '#E8E8E8' }] },
  { featureType: 'road',               elementType: 'labels.text.fill', stylers: [{ color: '#ADADAD' }] },
  { featureType: 'road.arterial',      elementType: 'geometry',         stylers: [{ color: '#F5F5F5' }] },
  { featureType: 'road.highway',       elementType: 'geometry',         stylers: [{ color: '#EBEBEB' }] },
  { featureType: 'road.highway',       elementType: 'geometry.stroke',  stylers: [{ color: '#DEDEDE' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill', stylers: [{ color: '#999999' }] },
  { featureType: 'road.local',         elementType: 'geometry',         stylers: [{ color: '#FAFAFA' }] },
  { featureType: 'water',              elementType: 'geometry',         stylers: [{ color: '#D1D5DB' }] },
  { featureType: 'water',              elementType: 'labels.text.fill', stylers: [{ color: '#ADADAD' }] },
  { featureType: 'administrative',     elementType: 'geometry',         stylers: [{ color: '#E0E0E0' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { featureType: 'poi',      stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',  stylers: [{ visibility: 'off' }] },
];

// ── Map style "Dark Mono" — routes sombres sur fond noir ──
const DARK_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#1A1A1A' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#666666' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'landscape',          elementType: 'geometry',         stylers: [{ color: '#141414' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry',         stylers: [{ color: '#1C1C1C' }] },
  { featureType: 'road',               elementType: 'geometry',         stylers: [{ color: '#2A2A2A' }] },
  { featureType: 'road',               elementType: 'geometry.stroke',  stylers: [{ color: '#222222' }] },
  { featureType: 'road',               elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { featureType: 'road.arterial',      elementType: 'geometry',         stylers: [{ color: '#282828' }] },
  { featureType: 'road.highway',       elementType: 'geometry',         stylers: [{ color: '#303030' }] },
  { featureType: 'road.highway',       elementType: 'geometry.stroke',  stylers: [{ color: '#282828' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { featureType: 'road.local',         elementType: 'geometry',         stylers: [{ color: '#242424' }] },
  { featureType: 'water',              elementType: 'geometry',         stylers: [{ color: '#111111' }] },
  { featureType: 'water',              elementType: 'labels.text.fill', stylers: [{ color: '#444444' }] },
  { featureType: 'administrative',     elementType: 'geometry',         stylers: [{ color: '#222222' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
  { featureType: 'poi',      stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',  stylers: [{ visibility: 'off' }] },
];

// ============================================================================
// UTILS
// ============================================================================

const formatEuros = (cents: number): string =>
  (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

// ============================================================================
// TYPES
// ============================================================================

interface WalletData {
  balance: number;
  pendingAmount: number;
  totalEarnings: number;
  monthEarnings: number;
  escrowAmount: number;
}

interface ProviderStats {
  jobsCompleted: number;
  avgRating: number;
  rankScore: number;
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
  client: { name: string };
  latitude?: number;
  longitude?: number;
}

// ============================================================================
// AVATAR MARKER
// ============================================================================

function AvatarMarker(_props: { heading?: number }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const pulseScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.35, 0.1, 0] });

  return (
    <View style={av.wrap}>
      <Animated.View style={[av.pulse, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
      <View style={av.accuracyRing} />
      <View style={av.core}>
        <View style={av.dot} />
      </View>
    </View>
  );
}

const av = StyleSheet.create({
  wrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  pulse: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1A1A1A',
  },
  accuracyRing: {
    position: 'absolute',
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(26,26,26,0.2)',
    backgroundColor: 'rgba(26,26,26,0.06)',
  },
  core: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#1A1A1A',
    borderWidth: 2.5, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#FFF',
    position: 'absolute',
  },
});

// ============================================================================
// INCOMING JOB CARD — Uber Driver style
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
  const slideUp   = useRef(new Animated.Value(400)).current;
  const timerAnim = useRef(new Animated.Value(1)).current;
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);

  useEffect(() => {
    Animated.spring(slideUp, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); onDecline(); return 0; }
        return prev - 1;
      });
    }, 1000);
    Animated.timing(timerAnim, { toValue: 0, duration: TIMER_DURATION * 1000, useNativeDriver: false }).start();
    return () => clearInterval(interval);
  }, []);

  const netPrice      = Math.round(request.price * 0.85);
  const timerBarColor = timerAnim.interpolate({
    inputRange: [0, 0.33, 1],
    outputRange: ['#FF3B30', '#ADADAD', '#1A1A1A'],
  });
  const countdownColor = timeLeft <= 5 ? '#FF3B30' : timeLeft <= 10 ? '#FF9500' : '#111';

  return (
    <Animated.View style={[jc.wrap, { backgroundColor: theme.cardBg }, { transform: [{ translateY: slideUp }] }]}>

      {/* Thin timer progress bar */}
      <View style={[jc.timerTrack, { backgroundColor: theme.border }]}>
        <Animated.View style={[jc.timerFill, {
          width: timerAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: timerBarColor,
        }]} />
      </View>

      <View style={jc.content}>

        {/* Top row: service title + countdown */}
        <View style={jc.topRow}>
          <View style={jc.titleWrap}>
            <Text style={[jc.title, { color: theme.textAlt }]} numberOfLines={2}>{request.title}</Text>
            {request.urgent && (
              <View style={jc.urgentPill}>
                <Ionicons name="flash" size={10} color="#FFF" />
                <Text style={jc.urgentText}>{t('provider.urgent')}</Text>
              </View>
            )}
          </View>
          <View style={jc.countdownWrap}>
            <Text style={[jc.countdown, { color: countdownColor }]}>{timeLeft}</Text>
            <Text style={jc.countdownUnit}>s</Text>
          </View>
        </View>

        {/* Price hero */}
        <View style={jc.priceRow}>
          <Text style={[jc.priceNet, { color: theme.textAlt }]}>{netPrice}€</Text>
          <Text style={[jc.priceCaption, { color: theme.textMuted }]}>{t('provider.net_gross', { gross: request.price })}</Text>
        </View>

        {/* Metas */}
        <View style={jc.metas}>
          <View style={jc.meta}>
            <Ionicons name="location-outline" size={14} color="#ADADAD" />
            <Text style={[jc.metaText, { color: theme.textSub }]} numberOfLines={1}>{request.address}</Text>
          </View>
          {request.distance !== undefined && (
            <View style={jc.meta}>
              <Ionicons name="time-outline" size={14} color="#ADADAD" />
              <Text style={[jc.metaText, { color: theme.textSub }]}>~{Math.round(request.distance * 3)} min · {request.distance.toFixed(1)} km</Text>
            </View>
          )}
          <View style={jc.meta}>
            <Ionicons name="person-outline" size={14} color="#ADADAD" />
            <Text style={[jc.metaText, { color: theme.textSub }]}>{request.client.name}</Text>
          </View>
        </View>

        {/* Full-width Accept CTA */}
        <TouchableOpacity style={[jc.acceptBtn, { backgroundColor: theme.accent }]} onPress={onAccept} activeOpacity={0.88} accessibilityLabel={t('provider.accept')} accessibilityRole="button">
          <Text style={[jc.acceptText, { color: theme.accentText }]}>{t('provider.accept')}</Text>
          <Ionicons name="arrow-forward" size={18} color={theme.accentText} />
        </TouchableOpacity>

        {/* Ghost Decline */}
        <TouchableOpacity style={jc.declineBtn} onPress={onDecline} activeOpacity={0.7} accessibilityLabel={t('provider.decline')} accessibilityRole="button">
          <Text style={[jc.declineText, { color: theme.textMuted }]}>{t('provider.decline')}</Text>
        </TouchableOpacity>

      </View>
    </Animated.View>
  );
}

const jc = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 83 : 60,
    left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  timerTrack: { height: 4, backgroundColor: '#F0F0F0', overflow: 'hidden' },
  timerFill:  { height: '100%' },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  titleWrap:    { flex: 1, gap: 8 },
  title:        { fontSize: 20, fontWeight: '800', color: '#111', letterSpacing: -0.3, lineHeight: 26 },
  urgentPill:   {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF3B30', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
  },
  urgentText:   { fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  countdownWrap:  { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  countdown:      { fontSize: 40, fontWeight: '900', letterSpacing: -2, lineHeight: 44 },
  countdownUnit:  { fontSize: 14, fontWeight: '600', color: '#ADADAD', marginBottom: 2 },

  priceRow:    { marginBottom: 20 },
  priceNet:    { fontSize: 52, fontWeight: '900', color: '#111', letterSpacing: -3, lineHeight: 56 },
  priceCaption:{ fontSize: 12, color: '#ADADAD', fontWeight: '500', marginTop: 2 },

  metas:   { gap: 10, marginBottom: 24 },
  meta:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText:{ fontSize: 14, color: '#555', fontWeight: '500', flex: 1 },

  acceptBtn: {
    height: 56, backgroundColor: '#111',
    borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10,
    marginBottom: 12,
  },
  acceptText: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },

  declineBtn:  { alignItems: 'center', paddingVertical: 8 },
  declineText: { fontSize: 14, fontWeight: '600', color: '#ADADAD' },
});

// ============================================================================
// COCKPIT ISLAND — palette claire
// ============================================================================

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
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const dotGlowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOnline) {
      // Dot glow breathing
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotGlowAnim, { toValue: 1,   duration: 1400, useNativeDriver: true }),
          Animated.timing(dotGlowAnim, { toValue: 0.4, duration: 1400, useNativeDriver: true }),
        ])
      ).start();
      // Continuous pulse ring
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim,   { toValue: 3, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim,   { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();
    } else {
      dotGlowAnim.stopAnimation();
      dotGlowAnim.setValue(0);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      pulseOpacity.stopAnimation();
      pulseOpacity.setValue(0);
    }
  }, [isOnline]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 60,  useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,    tension: 300, friction: 8, useNativeDriver: true }),
    ]).start();
    onToggle();
  };

  const dotOpacity = dotGlowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Animated.View style={[ci.island, { backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }, { transform: [{ scale: scaleAnim }] }]}>

      {/* Statut */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={[ci.statusSection, isOnline ? [ci.bgOnline, { backgroundColor: theme.cardBg }] : [ci.bgOffline, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#E0E0E0' }]]}
        accessibilityLabel={isOnline ? t('provider.online') : t('provider.offline')}
        accessibilityRole="switch"
      >
        <View style={ci.dotWrap}>
          {isOnline && (
            <Animated.View style={[ci.dotGlow, { opacity: dotOpacity }]} />
          )}
          <Animated.View style={[ci.pulseRing, { transform: [{ scale: pulseAnim }], opacity: pulseOpacity, backgroundColor: isOnline ? theme.text : '#AAAAAA' }]} />
          <View style={[ci.dot, isOnline ? [ci.dotOn, { backgroundColor: theme.text }] : ci.dotOff]} />
        </View>
        <Text style={[ci.statusText, isOnline ? [ci.statusOn, { color: theme.text }] : ci.statusOff]}>
          {isOnline ? t('provider.online') : t('provider.offline')}
        </Text>
      </TouchableOpacity>

      {/* Séparateur */}
      <View style={[ci.sep, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />

      {/* Wallet */}
      <TouchableOpacity onPress={onWalletPress} activeOpacity={0.75} style={ci.walletBtn} accessibilityLabel={t('provider.balance_label')} accessibilityRole="button">
        <Ionicons name="wallet" size={16} color={theme.text} />
        <Text style={[ci.walletAmount, { color: theme.text }]}>{formatEuros(wallet?.balance || 0)}</Text>
      </TouchableOpacity>

    </Animated.View>
  );
}

const ci = StyleSheet.create({
  island: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 36,
    height: 40,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
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
  bgOnline:  { backgroundColor: '#FFFFFF' },
  bgOffline: { backgroundColor: '#E0E0E0' },
  dotWrap:   { width: 7, height: 7, alignItems: 'center', justifyContent: 'center' },
  dotGlow:   { position: 'absolute', width: 15, height: 15, borderRadius: 7.5, backgroundColor: '#1A1A1A' },
  pulseRing: { position: 'absolute', width: 7, height: 7, borderRadius: 3.5 },
  dot:       { width: 7, height: 7, borderRadius: 3.5 },
  dotOn:     { backgroundColor: '#1A1A1A' },
  dotOff:    { backgroundColor: '#AAAAAA' },
  statusText:  { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  statusOn:    { color: '#1A1A1A' },
  statusOff:   { color: '#AAAAAA' },
  sep: { width: 1, height: 11, backgroundColor: 'rgba(0,0,0,0.06)', marginHorizontal: 2 },
  walletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 12,
    marginRight: 3,
  },
  walletAmount: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 },
});

// ============================================================================
// STATS KPI
// ============================================================================

function StatsSection({ loading }: { loading: boolean }) {
  const t = useAppTheme();
  if (loading) {
    return (
      <View style={[ss.loadingRow, { backgroundColor: t.surface }]}>
        {[0,1,2,3].map(i => (
          <View key={i} style={[ss.shimmer, { backgroundColor: t.border }]} />
        ))}
      </View>
    );
  }
}

const ss = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 16, padding: 16,
  },
  shimmer: {
    flex: 1, height: 28, borderRadius: 6,
    backgroundColor: '#EBEBEB',
  },
  kpiRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
  },
  kpiItem:  { flex: 1, alignItems: 'center', gap: 4 },
  kpiSep:   { width: 1, height: 32, backgroundColor: 'rgba(0,0,0,0.06)' },
  kpiNum:   { fontSize: 16, fontWeight: '900', color: '#111', letterSpacing: -0.3 },
  kpiGold:  { color: '#F59E0B' },
  kpiStar:  { fontSize: 12, color: '#F59E0B' },
  kpiLabel: { fontSize: 10, fontWeight: '400', color: '#ADADAD', letterSpacing: 0.4 },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProviderDashboard() {
  const router           = useRouter();
  const { t }            = useTranslation();
  const { user }         = useAuth();
  const { socket, unreadCount } = useSocket();
  const { isOnline: networkOnline } = useNetwork();
  const theme = useAppTheme();

  const mapRef   = useRef<MapView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [location,      setLocation]      = useState<{ latitude: number; longitude: number } | null>(null);
  const [heading,       setHeading]        = useState(0);
  const [, setLocationError] = useState(false);
  const [wallet,        setWallet]         = useState<WalletData | null>(null);
  const [, setStats]          = useState<ProviderStats>({ jobsCompleted: 0, avgRating: 5.0, rankScore: 100 });
  const [statsLoading,  setStatsLoading]  = useState(true);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [loading,       setLoading]        = useState(true);
  const [isOnline,      setIsOnline]       = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  // Géolocalisation
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationError(true); return; }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setLocation(coords);
      if (loc.coords.heading != null) setHeading(loc.coords.heading);

      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.035, longitudeDelta: 0.035 }, 900);

      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 15 },
        (l) => {
          const c = { latitude: l.coords.latitude, longitude: l.coords.longitude };
          setLocation(c);
          if (l.coords.heading != null) setHeading(l.coords.heading);
          if (socket && isOnline && networkOnline && user?.id) {
            socket.emit('provider:location', { providerId: user.id, ...c });
          }
        }
      );
    })();
  }, []);

  // Data
  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      api.wallet.balance(),
      api.user.me(),
      api.dashboard.provider(),
    ]);

    const dashData = results[2].status === 'fulfilled' ? (results[2].value as any) : null;
    const monthEarnings = dashData?.stats?.monthEarnings?.total || 0;

    if (results[0].status === 'fulfilled') {
      const w = results[0].value as any;
      setWallet({
        balance:       w.balance        || 0,
        pendingAmount: w.pendingAmount  || 0,
        totalEarnings: w.totalEarnings  || 0,
        monthEarnings,
        escrowAmount:  w.escrowAmount   || 0,
      });
    } else {
      console.warn('Wallet failed:', (results[0] as PromiseRejectedResult).reason?.message);
    }

    if (results[1].status === 'fulfilled') {
      const u = (results[1].value as any)?.user || (results[1].value as any)?.data || results[1].value;
      setStats({
        jobsCompleted: u.jobsCompleted ?? u.completedMissions ?? u.totalCompleted ?? 0,
        avgRating:     u.avgRating     ?? u.averageRating      ?? u.rating        ?? 5.0,
        rankScore:     u.rankScore     ?? u.rank               ?? u.score         ?? 0,
      });
    } else {
      console.warn('Stats failed:', (results[1] as PromiseRejectedResult).reason?.message);
    }

    setStatsLoading(false);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Socket
  useEffect(() => {
    if (!socket || !user?.id) return;
    if (socket.connected) socket.emit('provider:register', { providerId: user.id });

    const handleNewRequest = (data: any) => {
      Vibration.vibrate([0, 200, 100, 200]);
      const req: IncomingRequest = {
        requestId:   data.requestId || data.id,
        title:       data.title,
        description: data.description,
        price:       data.price,
        address:     data.location?.address || data.address || t('provider.unknown_address'),
        urgent:      data.urgent || false,
        distance:    data.distance,
        clientId:    data.clientId || data.client?.id,
        client:      { name: data.client?.name || t('provider.client') },
        latitude:    data.location?.latitude  || data.latitude,
        longitude:   data.location?.longitude || data.longitude,
      };
      setIncomingRequests(prev => prev.some(r => r.requestId === req.requestId) ? prev : [req, ...prev]);
      if (req.latitude && req.longitude) {
        mapRef.current?.animateToRegion({
          latitude: req.latitude, longitude: req.longitude,
          latitudeDelta: 0.02, longitudeDelta: 0.02,
        }, 600);
      }
    };

    const removeRequest = (id: string | number) =>
      setIncomingRequests(prev => prev.filter(r => r.requestId !== String(id)));

    const handleStatusUpdate = (data: { providerId: string; status: string }) => {
      if (data.providerId === user.id) setIsOnline(['ONLINE', 'READY'].includes(data.status));
    };

    socket.on('new_request',           handleNewRequest);
    socket.on('request:claimed',       removeRequest);
    socket.on('request:expired',       removeRequest);
    socket.on('provider:status_update', handleStatusUpdate);

    return () => {
      socket.off('new_request',           handleNewRequest);
      socket.off('request:claimed',       removeRequest);
      socket.off('request:expired',       removeRequest);
      socket.off('provider:status_update', handleStatusUpdate);
    };
  }, [socket, user?.id]);

  // Toggle online
  const handleToggleOnline = useCallback(() => {
    if (!user?.id) return;
    const next = !isOnline;
    setIsOnline(next);
    Vibration.vibrate(next ? [0, 60, 30, 60] : 40);
    if (socket) socket.emit('provider:set_status', { providerId: user.id, status: next ? 'READY' : 'OFFLINE' });
    if (!next) setIncomingRequests([]);
    if (next && location) {
      mapRef.current?.animateToRegion({ ...location, latitudeDelta: 0.035, longitudeDelta: 0.035 }, 700);
    }
  }, [isOnline, socket, user?.id, location]);

  // Accept / Decline
  const handleAccept = useCallback(async (request: IncomingRequest) => {
    if (!user?.id) return;
    if (socket) socket.emit('provider:accept', { requestId: request.requestId, providerId: user.id, clientId: request.clientId });
    Vibration.vibrate(100);
    setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
    router.push(`/request/${request.requestId}/ongoing`);
  }, [socket, user?.id, router]);

  const handleDecline = useCallback(async (requestId: string) => {
    try { await api.post(`/requests/${requestId}/refuse`); } catch { /* silent */ }
    setIncomingRequests(prev => prev.filter(r => r.requestId !== requestId));
  }, []);

  const activeJob = incomingRequests[0] || null;

  // ── Loading screen ──
  if (loading) {
    return (
      <View style={[s.loadingScreen, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <Ionicons name="navigate-circle" size={52} color={theme.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,26,0.25)'} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} translucent backgroundColor="transparent" />

      {/* ── Carte Light Mono plein écran ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={theme.isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        initialRegion={{
          latitude:      location?.latitude  ?? 48.8566,
          longitude:     location?.longitude ?? 2.3522,
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
              <View style={s.missionMarker}>
                <Ionicons name="flash" size={14} color="#FFF" />
              </View>
            </Marker>
          ) : null
        )}
      </MapView>

      {/* ── Vignette top — dégradé clair derrière le Top Island ── */}
      <LinearGradient
        colors={theme.isDark ? ['rgba(10,10,10,0.95)', 'rgba(10,10,10,0.6)', 'transparent'] : ['rgba(248,249,251,0.95)', 'rgba(248,249,251,0.6)', 'transparent']}
        style={s.vignetteTop}
        pointerEvents="none"
      />

      {/* ══════════════════════════════════════════════
          TOP ISLAND
      ══════════════════════════════════════════════ */}
      {!activeJob && (
        <Animated.View style={[s.topIsland, { backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }, { opacity: fadeAnim }]}>

          {/* Ligne 1 — CockpitIsland + Recenter + Notifs */}
          <View style={s.tiRow}>
            <CockpitIsland
              isOnline={isOnline}
              wallet={wallet}
              onToggle={handleToggleOnline}
              onWalletPress={() => router.push('/wallet')}
            />
            <TouchableOpacity
              style={[s.recenterBtn, { backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }]}
              onPress={() => location && mapRef.current?.animateToRegion({
                ...location, latitudeDelta: 0.035, longitudeDelta: 0.035,
              }, 700)}
              activeOpacity={0.8}
              accessibilityLabel="Recenter"
              accessibilityRole="button"
            >
              <Ionicons name="locate" size={20} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.recenterBtn, { backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }]}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.8}
              accessibilityLabel={t('common.notifications')}
              accessibilityRole="button"
            >
              <Ionicons name="notifications-outline" size={20} color={theme.text} />
              {unreadCount > 0 && (
                <View style={[s.notifBadge, { backgroundColor: theme.accent, borderColor: theme.cardBg }]}>
                  <Text style={[s.notifBadgeText, { color: theme.accentText }]}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Séparateur */}
          <View style={[s.tiSep, { backgroundColor: theme.border }]} />

          {/* Ligne 2 — Gains hero */}
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

          {/* Ligne 3 — KPIs */}
          <StatsSection loading={statsLoading} />

        </Animated.View>
      )}

      {/* ── Pop-up mission entrante ── */}
      {activeJob && (
        <IncomingJobCard
          request={activeJob}
          onAccept={() => handleAccept(activeJob)}
          onDecline={() => handleDecline(activeJob.requestId)}
        />
      )}
    </View>
  );
}

// ============================================================================
// STYLES PRINCIPAUX — palette claire identique au dashboard client
// ============================================================================

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#FFFFFF' },
  loadingScreen: {
    flex: 1, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },

  vignetteTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: Platform.OS === 'ios' ? 340 : 310,
    zIndex: 9000,
  },

  // ── TOP ISLAND ──
  topIsland: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 44,
    left: 14, right: 14,
    zIndex: 9999,
    backgroundColor: '#FFF',
    borderRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 0,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 12 },
    }),
  },

  tiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  tiSep: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 8,
  },

  recenterBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },

  // Earnings
  earningsLeft: { alignItems: 'center', paddingVertical: 4 },
  earningsCaptionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  earningsCaption: {
    fontSize: 10, fontWeight: '600',
    color: '#ADADAD',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  earningsHero: {
    fontSize: 34, fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -1.5, lineHeight: 40,
    textAlign: 'center',
  },
  pendingSubtext: { fontSize: 12, fontWeight: '500', color: '#ADADAD', marginTop: 4, textAlign: 'center' },
  invoicedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  invoicedText: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] as any },

  // Mission marker
  missionMarker: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FF3B30',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#FFF',
    shadowColor: '#FF3B30', shadowOpacity: 0.5, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
});
