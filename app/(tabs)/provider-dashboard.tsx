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
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { devWarn, devLog } from '@/lib/logger';

const TIMER_DURATION = 60;

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
  calloutFee?: number;
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
    backgroundColor: '#34C759',
    borderWidth: 2, borderColor: '#FFFFFF',
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
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const slideUp    = useRef(new Animated.Value(400)).current;
  const arrowAnim  = useRef(new Animated.Value(0)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    Animated.spring(slideUp, { toValue: 0, tension: 55, friction: 11, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(arrowAnim, { toValue: 5, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(arrowAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(badgePulse, { toValue: 0.3, duration: 750, useNativeDriver: true }),
      Animated.timing(badgePulse, { toValue: 1, duration: 750, useNativeDriver: true }),
    ])).start();
  }, []);

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

  const isQuote = request.isQuote || request.pricingMode === 'estimate' || request.pricingMode === 'diagnostic';
  const netPrice = Math.round(request.price * 0.80);
  const etaMin = request.distance != null ? Math.round(request.distance * 3) : null;

  const progress = timeLeft / TIMER_DURATION;
  const timerColor = timeLeft <= 10 ? '#E85030' : COLORS.amber;
  const timerRotation = `${-90 + 360 * (1 - progress)}deg`;

  // Theme-aware palette
  const sheetBg   = theme.isDark ? '#0E0E0E' : '#F2F0EB';
  const borderCol = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const iconBg    = theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const labelCol  = theme.isDark ? '#444' : '#999';
  const valueCol  = theme.isDark ? '#B0B0B0' : '#666';
  const boldCol   = theme.isDark ? '#F4F4F2' : '#1A1A18';
  const passCol   = theme.isDark ? '#333' : '#BBB';
  const ctaBg     = theme.isDark ? '#F4F4F2' : '#1A1A18';
  const ctaText   = theme.isDark ? '#0A0A0A' : '#F4F4F2';

  // Address split: bold first part, muted rest
  const addrParts = request.address.split(',');
  const addrBold  = addrParts[0] || '';
  const addrRest  = addrParts.length > 1 ? `, ${addrParts.slice(1).join(',').trim()}` : '';

  return (
    <Animated.View style={[jc.wrap, { bottom: insets.bottom }, { transform: [{ translateY: slideUp }] }]}>
      {/* Gradient map → sheet */}
      <LinearGradient
        colors={['transparent', `${sheetBg}99`, sheetBg]}
        locations={[0, 0.4, 1]}
        style={jc.topFade}
        pointerEvents="none"
      />

      <View style={[jc.sheet, { backgroundColor: sheetBg }]}>
        <View style={[jc.handle, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)' }]} />

        {/* Timer row: "NOUVELLE MISSION" / "DERNIÈRE CHANCE" + ring */}
        <View style={jc.timerRow}>
          <Text style={[jc.newLabel, { color: expired ? '#E85030' : COLORS.amber }]}>
            {expired ? 'DERNIÈRE CHANCE' : 'NOUVELLE MISSION'}
          </Text>
          {!expired && (
            <View style={jc.timerWrap}>
              <View style={[jc.timerBg, { borderColor: 'rgba(232,160,48,0.12)' }]} />
              <View style={[jc.timerProgress, { borderColor: timerColor, borderTopColor: 'transparent', borderRightColor: 'transparent', transform: [{ rotate: timerRotation }] }]} />
              <Text style={[jc.timerNum, { color: timerColor }]}>{timeLeft}</Text>
            </View>
          )}
        </View>

        {/* Title — Bebas 30px */}
        <Text style={[jc.title, { color: boldCol }]} numberOfLines={2}>{request.title.toUpperCase()}</Text>

        {/* Badge */}
        <View style={jc.badgeRow}>
          <View style={[jc.badge, { backgroundColor: 'rgba(232,160,48,0.12)', borderColor: 'rgba(232,160,48,0.2)' }]}>
            <Animated.View style={[jc.badgeDot, { opacity: badgePulse }]} />
            <Text style={jc.badgeText}>
              {isQuote ? 'DEVIS — DIAGNOSTIC SUR PLACE' : 'PRIX FIXE'}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={[jc.divider, { backgroundColor: borderCol }]} />

        {/* Info rows */}
        <View style={jc.infoList}>
          {/* Address */}
          <View style={[jc.infoRow, { borderBottomColor: borderCol }]}>
            <View style={[jc.infoIcon, { backgroundColor: iconBg, borderColor: borderCol }]}>
              <Ionicons name="location-outline" size={15} color="#888" />
            </View>
            <View style={jc.infoContent}>
              <Text style={[jc.infoLabel, { color: labelCol }]}>ADRESSE</Text>
              <Text style={[jc.infoValue, { color: valueCol }]} numberOfLines={1}>
                <Text style={{ color: boldCol, fontWeight: '500' }}>{addrBold}</Text>
                {addrRest}
              </Text>
            </View>
            {etaMin != null && (
              <View style={jc.etaChip}>
                <Ionicons name="time-outline" size={12} color="#555" />
                <Text style={jc.etaChipText}>{etaMin} min</Text>
              </View>
            )}
          </View>

          {/* Client */}
          <View style={[jc.infoRow, { borderBottomColor: borderCol }]}>
            <View style={[jc.infoIcon, { backgroundColor: iconBg, borderColor: borderCol }]}>
              <Ionicons name="person-outline" size={15} color="#888" />
            </View>
            <View style={jc.infoContent}>
              <Text style={[jc.infoLabel, { color: labelCol }]}>CLIENT</Text>
              <Text style={[jc.infoValue, { color: boldCol, fontWeight: '500' }]}>{request.client.name}</Text>
            </View>
          </View>

          {/* Fee / Price — last row, no border */}
          {isQuote ? (
            <View style={[jc.infoRow, { borderBottomWidth: 0 }]}>
              <View style={[jc.infoIcon, { backgroundColor: 'rgba(232,160,48,0.12)', borderColor: 'rgba(232,160,48,0.15)' }]}>
                <Ionicons name="wallet-outline" size={15} color={COLORS.amber} />
              </View>
              <View style={jc.infoContent}>
                <Text style={[jc.infoLabel, { color: labelCol }]}>FRAIS DE DÉPLACEMENT</Text>
                <Text style={[jc.infoValue, { color: COLORS.amber, fontWeight: '500' }]}>Garanti à réception</Text>
              </View>
              {request.calloutFee != null && request.calloutFee > 0 && (
                <View style={[jc.feeBadge, { backgroundColor: iconBg, borderColor: borderCol }]}>
                  <Text style={[jc.feeBadgeNum, { color: boldCol }]}>{Math.round(request.calloutFee / 100)} €</Text>
                </View>
              )}
            </View>
          ) : request.price > 0 ? (
            <View style={[jc.infoRow, { borderBottomWidth: 0 }]}>
              <View style={[jc.infoIcon, { backgroundColor: 'rgba(61,139,61,0.10)', borderColor: 'rgba(61,139,61,0.15)' }]}>
                <Ionicons name="card-outline" size={15} color="#3D8B3D" />
              </View>
              <View style={jc.infoContent}>
                <Text style={[jc.infoLabel, { color: labelCol }]}>GAINS ESTIMÉS</Text>
                <Text style={[jc.infoValue, { color: '#3D8B3D', fontWeight: '500' }]}>Net après commission</Text>
              </View>
              <View style={[jc.feeBadge, { backgroundColor: iconBg, borderColor: borderCol }]}>
                <Text style={[jc.feeBadgeNum, { color: boldCol }]}>{netPrice} €</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* CTA */}
        <View style={jc.ctaArea}>
          <TouchableOpacity style={[jc.acceptBtn, { backgroundColor: ctaBg }]} onPress={onAccept} activeOpacity={0.85}>
            <Text style={[jc.acceptText, { color: ctaText }]}>ACCEPTER</Text>
            <Animated.View style={{ transform: [{ translateX: arrowAnim }] }}>
              <Ionicons name="arrow-forward" size={18} color={ctaText} />
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity style={jc.passBtn} onPress={onDecline} activeOpacity={0.4}>
            <Text style={[jc.passText, { color: expired ? '#E85030' : passCol }]}>
              {expired ? 'REFUSER' : 'Passer'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
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

  // Timer row
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20 },
  newLabel: { fontFamily: FONTS.bebas, fontSize: 11, letterSpacing: 2.5, opacity: 0.7 },
  timerWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  timerBg: { position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 3 },
  timerProgress: { position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 3 },
  timerNum: { fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 1 },

  // Title
  title: { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 0.5, lineHeight: 33, paddingHorizontal: 24, paddingTop: 12 },

  // Badge
  badgeRow: { paddingHorizontal: 24, paddingTop: 14 },
  badge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 7, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.amber },
  badgeText: { fontFamily: FONTS.sansMedium, fontSize: 10.5, letterSpacing: 1.8, color: COLORS.amber },

  // Divider
  divider: { height: 1, marginHorizontal: 24, marginVertical: 18 },

  // Info
  infoList: { paddingHorizontal: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, borderBottomWidth: 1 },
  infoIcon: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { fontFamily: FONTS.sansMedium, fontSize: 10, letterSpacing: 1, marginBottom: 2 },
  infoValue: { fontFamily: FONTS.sans, fontSize: 13.5 },

  etaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  etaChipText: { fontFamily: FONTS.sans, fontSize: 12, color: '#888' },

  feeBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  feeBadgeNum: { fontFamily: FONTS.bebas, fontSize: 18, letterSpacing: 0.5 },

  // CTA
  ctaArea: { paddingHorizontal: 24, paddingTop: 20, gap: 10 },
  acceptBtn: {
    height: 58, borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  acceptText: { fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 3 },
  passBtn: { alignItems: 'center', height: 40, justifyContent: 'center' },
  passText: { fontFamily: FONTS.sans, fontSize: 13, letterSpacing: 0.3 },
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

  // Load current incoming queue via REST — hydrates the card list on dashboard open
  // so the provider sees existing "now" + devis requests without waiting for the next
  // socket rebroadcast tick. Scheduled-for-future requests live in the missions tab.
  // Extracted as a stable callback so we can re-invoke on socket (re)connect.
  const fetchIncomingQueue = useCallback(async () => {
    if (!user?.id) return;
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
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    fetchIncomingQueue();
  }, [fetchIncomingQueue]);

  // Polling safety net : rafraîchit /requests/incoming toutes les 8s tant que
  // le provider est online. Garantit l'apparition des cards même si le socket
  // rate un event (cas : register pas encore enregistré sur le backend quand
  // le new_request est émis, latence réseau, buffering, etc.).
  useEffect(() => {
    if (!user?.id || !isOnline) return;
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
      isOnlineRef.current = true;
      setIsOnline(true);
      // Re-hydrate in case we missed a broadcast while disconnected.
      fetchIncomingQueue();
    };

    if (socket.connected) {
      registerAndRefresh();
    }

    const handleNewRequest = (data: any) => {
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
        calloutFee:  data.calloutFee ?? undefined,
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

    socket.on('connect',                registerAndRefresh);
    socket.on('new_request',            handleNewRequest);
    socket.on('request:claimed',        removeRequest);
    socket.on('request:expired',        removeRequest);
    socket.on('provider:status_update', handleStatusUpdate);

    return () => {
      socket.off('connect',                registerAndRefresh);
      socket.off('new_request',            handleNewRequest);
      socket.off('request:claimed',        removeRequest);
      socket.off('request:expired',        removeRequest);
      socket.off('provider:status_update', handleStatusUpdate);
    };
  }, [socket, user?.id, fetchIncomingQueue]);

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

  // Accept — REST call (reliable) + socket notification (real-time bonus)
  const handleAccept = useCallback(async (request: IncomingRequest) => {
    if (!user?.id) return;

    try {
      const res: any = await api.post(`/requests/${request.requestId}/accept`);
      if (res?.code === 'REQUEST_ACCEPTED' || res?.data) {
        Vibration.vibrate(100);
        setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
        router.replace(`/request/${request.requestId}/ongoing`);
      } else {
        throw new Error(res?.message || 'Erreur inconnue');
      }
    } catch (err: any) {
      const msg = err?.message || err?.data?.message || 'La mission n\u2019est plus disponible ou une erreur est survenue.';
      Alert.alert('Impossible d\u2019accepter', msg);
      declinedIdsRef.current.add(request.requestId);
      setIncomingRequests(prev => prev.filter(r => r.requestId !== request.requestId));
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
