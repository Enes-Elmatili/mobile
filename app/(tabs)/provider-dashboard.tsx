/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// app/(tabs)/provider-dashboard.tsx

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
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { PulseDot } from '@/components/ui/PulseDot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { devWarn } from '@/lib/logger';

const TIMER_DURATION = 15;

// -- Map style "Light Mono" --
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

// -- Map style "Dark Mono" --
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
  isQuote?: boolean;
  pricingMode?: string;
}

// ============================================================================
// AVATAR MARKER
// ============================================================================

function AvatarMarker(_props: { heading?: number }) {
  const theme = useAppTheme();
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
      <Animated.View style={[av.pulse, { backgroundColor: theme.accent, transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
      <View style={[av.accuracyRing, { borderColor: theme.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(26,26,26,0.2)', backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,26,0.06)' }]} />
      <View style={[av.core, { backgroundColor: theme.accent, borderColor: theme.cardBg }]}>
        <View style={[av.dot, { backgroundColor: theme.accentText }]} />
      </View>
    </View>
  );
}

const av = StyleSheet.create({
  wrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  pulse: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
  },
  accuracyRing: {
    position: 'absolute',
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5,
  },
  core: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    position: 'absolute',
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
  const slideUp   = useRef(new Animated.Value(400)).current;
  const timerAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);

  useEffect(() => {
    Animated.spring(slideUp, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 4, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
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

  const netPrice = Math.round(request.price * 0.85);
  const isQuote = request.isQuote;
  const etaMin = request.distance !== undefined ? Math.round(request.distance * 3) : null;

  // Timer ring progress (0→1 = full→empty)
  const progress = timeLeft / TIMER_DURATION;
  const circumference = 2 * Math.PI * 21; // r=21
  const strokeDashoffset = circumference * (1 - progress);
  const timerColor = timeLeft <= 5 ? COLORS.red : COLORS.amber;

  return (
    <Animated.View style={[jc.wrap, { bottom: insets.bottom + 20, backgroundColor: theme.bg, shadowOpacity: theme.shadowOpacity > 0.1 ? theme.shadowOpacity : 0.18 }, { transform: [{ translateY: slideUp }] }]}>
      <View style={jc.content}>
        {/* Handle */}
        <View style={[jc.handle, { backgroundColor: theme.borderLight }]} />

        {/* Top row: service name + timer ring */}
        <View style={jc.topRow}>
          <Text style={[jc.title, { color: theme.text }]} numberOfLines={2}>{request.title}</Text>
          <View style={jc.timerRing}>
            <View style={jc.timerSvgWrap}>
              {/* Background circle */}
              <View style={[jc.timerCircleBg, { borderColor: theme.border }]} />
              {/* Progress circle (approximated with border) */}
              <View style={[jc.timerCircleProgress, { borderColor: timerColor, borderTopColor: 'transparent', transform: [{ rotate: `${360 * progress}deg` }] }]} />
            </View>
            <Text style={[jc.timerText, { color: timerColor }]}>{timeLeft}</Text>
          </View>
        </View>

        {/* Mode badge */}
        <View style={[jc.modeBadge, isQuote
          ? { backgroundColor: 'rgba(232,168,56,0.12)', borderColor: 'rgba(232,168,56,0.15)' }
          : { backgroundColor: 'rgba(61,139,61,0.10)', borderColor: 'rgba(61,139,61,0.15)' }
        ]}>
          <View style={[jc.modeDot, { backgroundColor: isQuote ? COLORS.amber : '#3D8B3D' }]} />
          <Text style={[jc.modeLabel, { color: isQuote ? COLORS.amber : '#3D8B3D' }]}>
            {isQuote ? 'DEVIS — DIAGNOSTIC SUR PLACE' : 'PRIX FIXE'}
          </Text>
        </View>

        {/* Price (only for fixed price) */}
        {!isQuote && request.price > 0 && (
          <View style={jc.priceBlock}>
            <Text style={[jc.priceAmount, { color: theme.text }]}>{netPrice},00 €</Text>
            <Text style={[jc.priceSuffix, { color: theme.textMuted }]}>net estimé</Text>
          </View>
        )}

        {/* Info rows */}
        <View style={jc.infoGrid}>
          <View style={jc.infoRow}>
            <View style={[jc.infoIcon, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="location-outline" size={14} color={theme.textMuted} />
            </View>
            <Text style={[jc.infoText, { color: theme.textSub }]} numberOfLines={1}>{request.address}</Text>
          </View>
          {etaMin !== null && (
            <View style={jc.infoRow}>
              <View style={[jc.infoIcon, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="time-outline" size={14} color={theme.textMuted} />
              </View>
              <Text style={[jc.infoText, { color: theme.textSub }]}>~{etaMin} min · {request.distance!.toFixed(1)} km</Text>
            </View>
          )}
          <View style={jc.infoRow}>
            <View style={[jc.infoIcon, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="person-outline" size={14} color={theme.textMuted} />
            </View>
            <Text style={[jc.infoText, { color: theme.textSub }]}>{request.client.name}</Text>
          </View>
        </View>

        {/* CTA Accept */}
        <TouchableOpacity style={[jc.acceptBtn, { backgroundColor: theme.accent }]} onPress={onAccept} activeOpacity={0.88}>
          <Text style={[jc.acceptText, { color: theme.accentText }]}>ACCEPTER</Text>
          <Animated.View style={{ transform: [{ translateX: arrowAnim }] }}>
            <Ionicons name="arrow-forward" size={18} color={theme.accentText as string} />
          </Animated.View>
        </TouchableOpacity>

        {/* Pass */}
        <TouchableOpacity style={jc.declineBtn} onPress={onDecline} activeOpacity={0.7}>
          <Text style={[jc.declineText, { color: theme.textMuted }]}>Passer</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const jc = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000', shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  // Top row
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  title: { fontSize: 18, fontFamily: FONTS.sansMedium, lineHeight: 24, flex: 1 },

  // Timer ring
  timerRing: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  timerSvgWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  timerCircleBg: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  timerCircleProgress: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  timerText: { fontFamily: FONTS.bebas, fontSize: 18, letterSpacing: 1 },

  // Mode badge
  modeBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 6, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100, borderWidth: 1, marginBottom: 20,
  },
  modeDot: { width: 8, height: 8, borderRadius: 4 },
  modeLabel: { fontSize: 11, fontFamily: FONTS.sansMedium, letterSpacing: 1.5, textTransform: 'uppercase' },

  // Price block
  priceBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 20 },
  priceAmount: { fontFamily: FONTS.bebas, fontSize: 40, lineHeight: 44 },
  priceSuffix: { fontFamily: FONTS.sans, fontSize: 14 },

  // Info grid
  infoGrid: { gap: 10, marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  infoText: { fontFamily: FONTS.sans, fontSize: 14, flex: 1 },

  // CTA
  acceptBtn: {
    height: 56, borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10,
    marginBottom: 12,
  },
  acceptText: { fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 2 },

  declineBtn: { alignItems: 'center', paddingVertical: 8 },
  declineText: { fontSize: 14, fontFamily: FONTS.sansMedium, letterSpacing: 0.5 },
});

// ============================================================================
// COCKPIT ISLAND
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
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotGlowAnim, { toValue: 1,   duration: 1400, useNativeDriver: true }),
          Animated.timing(dotGlowAnim, { toValue: 0.4, duration: 1400, useNativeDriver: true }),
        ])
      ).start();
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
    <Animated.View style={[ci.island, { backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', shadowOpacity: theme.shadowOpacity > 0.06 ? theme.shadowOpacity : 0.1 }, { transform: [{ scale: scaleAnim }] }]}>

      {/* Statut */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={[ci.statusSection, isOnline ? { backgroundColor: theme.cardBg } : { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : theme.surface }]}
        accessibilityLabel={isOnline ? t('provider.online') : t('provider.offline')}
        accessibilityRole="switch"
      >
        <View style={ci.dotWrap}>
          {isOnline && (
            <Animated.View style={[ci.dotGlow, { opacity: dotOpacity, backgroundColor: theme.text }]} />
          )}
          <Animated.View style={[ci.pulseRing, { transform: [{ scale: pulseAnim }], opacity: pulseOpacity, backgroundColor: isOnline ? theme.text : theme.textMuted }]} />
          <View style={[ci.dot, { backgroundColor: isOnline ? theme.text : theme.textMuted }]} />
        </View>
        <Text style={[ci.statusText, { color: isOnline ? theme.text : theme.textMuted }]}>
          {isOnline ? t('provider.online') : t('provider.offline')}
        </Text>
      </TouchableOpacity>

      {/* Separateur */}
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
    borderRadius: 16, padding: 16,
  },
  shimmer: {
    flex: 1, height: 28, borderRadius: 6,
  },
  kpiRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, padding: 14,
    borderWidth: 1,
  },
  kpiItem:  { flex: 1, alignItems: 'center', gap: 4 },
  kpiSep:   { width: 1, height: 32 },
  kpiNum:   { fontSize: 16, fontFamily: FONTS.bebas, letterSpacing: -0.3 },
  kpiGold:  { color: COLORS.amber },
  kpiStar:  { fontSize: 12, color: COLORS.amber },
  kpiLabel: { fontSize: 10, fontFamily: FONTS.mono, letterSpacing: 0.4 },
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
  const insets = useSafeAreaInsets();

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
  const isOnlineRef = useRef(false);
  const [activeMission, setActiveMission]  = useState<any>(null);
  const declinedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

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
        { accuracy: Location.Accuracy.High, distanceInterval: 50, timeInterval: 15000 },
        (l) => {
          const c = { latitude: l.coords.latitude, longitude: l.coords.longitude };
          setLocation(c);
          if (l.coords.heading != null) setHeading(l.coords.heading);
          const now = Date.now();
          if (now - dashLastEmitRef.current >= 15_000 && socket && isOnline && networkOnline && user?.id) {
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

  // Data
  const loadData = useCallback(async () => {
    const results = await Promise.allSettled([
      api.wallet.balance(),
      api.user.me(),
      api.dashboard.provider(),
    ]);

    const dashData = results[2].status === 'fulfilled' ? (results[2].value as any) : null;
    const monthEarnings = dashData?.stats?.monthEarnings?.total || 0;

    // Active mission (ACCEPTED or ONGOING)
    const activeReqs = dashData?.activeRequests || [];
    if (activeReqs.length > 0) {
      setActiveMission(activeReqs[0]);
    } else {
      setActiveMission(null);
    }

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
      devWarn('Wallet failed:', (results[0] as PromiseRejectedResult).reason?.message);
    }

    if (results[1].status === 'fulfilled') {
      const u = (results[1].value as any)?.user || (results[1].value as any)?.data || results[1].value;
      setStats({
        jobsCompleted: u.jobsCompleted ?? u.completedMissions ?? u.totalCompleted ?? 0,
        avgRating:     u.avgRating     ?? u.averageRating      ?? u.rating        ?? 5.0,
        rankScore:     u.rankScore     ?? u.rank               ?? u.score         ?? 0,
      });
    } else {
      devWarn('Stats failed:', (results[1] as PromiseRejectedResult).reason?.message);
    }

    setStatsLoading(false);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Socket
  useEffect(() => {
    if (!socket || !user?.id) return;
    if (socket.connected) {
      socket.emit('provider:register', { providerId: user.id });
      isOnlineRef.current = true;
      setIsOnline(true);
    }

    const handleNewRequest = (data: any) => {
      if (!isOnlineRef.current) return;
      const rid = String(data.requestId ?? data.id);
      if (declinedIdsRef.current.has(rid)) return; // already declined, ignore rebroadcast
      Vibration.vibrate([0, 200, 100, 200]);
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
        client:      { name: data.client?.name || data.clientName || t('provider.client') },
        latitude:    lat,
        longitude:   lng,
        isQuote:     data.isQuote || false,
        pricingMode: data.pricingMode || null,
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

    const handleStatusUpdate = (data: { providerId: string; status: string }) => {
      if (data.providerId === user.id) {
        const online = ['ONLINE', 'READY'].includes(data.status);
        isOnlineRef.current = online;
        setIsOnline(online);
      }
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
    isOnlineRef.current = next;
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
    if (!user?.id || !socket) return;

    // Wait for backend confirmation before navigating
    const onSuccess = (data: any) => {
      socket.off('provider:accept_success', onSuccess);
      socket.off('error', onError);
      Vibration.vibrate(100);
      setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
      router.push(`/request/${request.requestId}/ongoing`);
    };
    const onError = (err: any) => {
      socket.off('provider:accept_success', onSuccess);
      socket.off('error', onError);
      declinedIdsRef.current.add(request.requestId);
      setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
    };

    socket.on('provider:accept_success', onSuccess);
    socket.on('error', onError);
    socket.emit('provider:accept', { requestId: request.requestId, providerId: user.id, clientId: request.clientId });

    // Timeout fallback — if no response in 8s, clean up
    setTimeout(() => {
      socket.off('provider:accept_success', onSuccess);
      socket.off('error', onError);
    }, 8000);
  }, [socket, user?.id, router]);

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
        <Ionicons name="navigate-circle" size={52} color={theme.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,26,0.25)'} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} translucent backgroundColor="transparent" />

      {/* -- Carte plein ecran -- */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={(theme.isDark || activeJob) ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        pitchEnabled={false}
        toolbarEnabled={false}
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
                <Ionicons name="flash" size={14} color="#FFF" />
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
        <Animated.View style={[s.topIsland, { top: insets.top + 8, backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', shadowOpacity: theme.shadowOpacity > 0.06 ? theme.shadowOpacity : 0.1 }, { opacity: fadeAnim }]}>

          {/* Ligne 1 -- CockpitIsland + Recenter + Notifs */}
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

          {/* Separateur */}
          <View style={[s.tiSep, { backgroundColor: theme.border }]} />

          {/* Mission active */}
          {activeMission && (
            <TouchableOpacity
              style={[s.activeBanner, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}
              activeOpacity={0.85}
              onPress={() => router.push(`/request/${activeMission.id}/ongoing`)}
            >
              <PulseDot size={8} color={activeMission.status === 'ONGOING' ? COLORS.green : COLORS.amber} />
              <View style={{ flex: 1 }}>
                <Text style={[s.activeBannerTitle, { color: theme.text }]} numberOfLines={1}>
                  {activeMission.category?.name || activeMission.serviceType || t('missions.mission')}
                </Text>
                <Text style={[s.activeBannerSub, { color: theme.textMuted }]} numberOfLines={1}>
                  {activeMission.status === 'ONGOING' ? t('provider.mission_ongoing') : t('provider.mission_accepted')} · {activeMission.client?.name || t('provider.client')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}

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
          <StatsSection loading={statsLoading} />

        </Animated.View>
      )}

      {/* -- Pop-up mission entrante -- */}
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
    fontSize: 34, fontFamily: FONTS.bebas,
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
