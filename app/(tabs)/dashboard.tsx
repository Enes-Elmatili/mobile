/* eslint-disable react-hooks/exhaustive-deps */
// app/(tabs)/dashboard.tsx
import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { InteractionManager } from 'react-native';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../lib/auth/AuthContext';
import { useSocket } from '../../lib/SocketContext';
import { api } from '../../lib/api';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProviderDashboard from '../../app/(tabs)/provider-dashboard';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/hooks/use-app-theme';
import { PulseDot } from '@/components/ui/PulseDot';
import InvoiceSheet from '@/components/sheets/InvoiceSheet';
import { useInvoice } from '@/hooks/useInvoice';
import { devError } from '@/lib/logger';
import {
  Card as FixedCard,
  SectionHeader as FixedSectionHeader,
  IconBtn as FixedIconBtn,
  StatusChip as FixedStatusChip,
  Avatar as FixedAvatar,
  Price as FixedPrice,
} from '@/components/fixed';

// ─── Press feel constants (tier-1 haptic + opacity) ─────────────────────────
const PRESS_PRIMARY   = 0.85;  // CTAs, cards, mission island
const PRESS_SECONDARY = 0.7;   // Text links, icon buttons, list items
const hapticLight  = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const hapticMedium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// ============================================================================
// TYPES
// ============================================================================

interface DashboardData {
  me: { id: string; email: string; name?: string; city?: string; roles: string[] };
  stats: { activeRequests: number; completedRequests: number; totalSpent: number };
  requests: {
    id: string;
    title: string;
    serviceType?: string;
    status: string;
    description?: string;
    price?: number;
    address?: string;
    lat?: number;
    lng?: number;
    createdAt: string;
    expiresAt?: string;
    preferredTimeStart?: string | null;
    pricingMode?: string | null;
    calloutFee?: number | null;
    category?: { id: number; name: string; icon?: string };
    subcategory?: { id: number; name: string };
    provider?: { id: string; name?: string; avatarUrl?: string | null } | null;
  }[];
}

// ─── Helper : une request est "planifiée future" si preferredTimeStart > now ────
const isScheduledFuture = (r: { preferredTimeStart?: string | null }): boolean => {
  if (!r?.preferredTimeStart) return false;
  return new Date(r.preferredTimeStart).getTime() > Date.now();
};

// ============================================================================
// UTILS
// ============================================================================

const getStatusInfo = (status: string, t: (key: string) => string) => {
  const s = (status || 'PENDING').toUpperCase();
  const map: Record<string, { label: string; icon: string; ledColor: string }> = {
    DONE:            { label: t('dashboard.status_done'),      icon: 'check-circle', ledColor: COLORS.green },
    CANCELLED:       { label: t('dashboard.status_cancelled'), icon: 'x-circle',     ledColor: COLORS.red },
    ONGOING:         { label: t('dashboard.status_ongoing'),   icon: 'clock',        ledColor: COLORS.green },
    PUBLISHED:       { label: t('dashboard.status_published'), icon: 'radio',        ledColor: COLORS.amber },
    ACCEPTED:        { label: t('dashboard.status_accepted'),  icon: 'check',        ledColor: COLORS.green },
    PENDING_PAYMENT: { label: t('dashboard.status_payment'),   icon: 'credit-card',  ledColor: COLORS.amber },
    QUOTE_PENDING:   { label: 'Devis en cours',                icon: 'file-text',    ledColor: COLORS.amber },
    QUOTE_SENT:      { label: 'Devis reçu',                   icon: 'file-text',    ledColor: COLORS.green },
    QUOTE_ACCEPTED:  { label: 'Devis accepté',                icon: 'check-circle', ledColor: COLORS.green },
    QUOTE_REFUSED:   { label: 'Devis refusé',                 icon: 'x-circle',     ledColor: COLORS.red },
    QUOTE_EXPIRED:   { label: 'Devis expiré — remboursé',     icon: 'clock',        ledColor: COLORS.red },
    EXPIRED:         { label: t('dashboard.status_expired'),   icon: 'clock',        ledColor: COLORS.red },
  };
  return map[s] || { label: s, icon: 'help-circle', ledColor: COLORS.amber };
};

const getGreeting = (t: (key: string) => string) => {
  const h = new Date().getHours();
  if (h < 12) return t('dashboard.greeting_morning');
  if (h < 18) return t('dashboard.greeting_afternoon');
  return t('dashboard.greeting_evening');
};

const getServiceIcon = (label?: string): string => {
  if (!label) return 'tool';
  const t = label.toLowerCase();
  if (t.includes('bricol'))                             return 'tool';
  if (t.includes('jardin') || t.includes('pelouse'))    return 'feather';
  if (t.includes('ménage') || t.includes('nettoyage'))  return 'star';
  if (t.includes('démén') || t.includes('demen'))       return 'package';
  if (t.includes('peint'))                              return 'edit-2';
  if (t.includes('plomb'))                              return 'droplet';
  if (t.includes('électr') || t.includes('electr'))     return 'zap';
  if (t.includes('chauff'))                             return 'zap';
  if (t.includes('serrur'))                             return 'key';
  if (t.includes('urgence'))                            return 'tool';
  if (t.includes('rénov') || t.includes('renov'))       return 'tool';
  return 'tool';
};

// ============================================================================
// STATUS LED — using shared PulseDot component
// ============================================================================

// ============================================================================
// RUNWAY CAROUSEL — service category cards
// ============================================================================

const CARD_WIDTH = 128;
const CARD_HEIGHT = 138;
const CARD_GAP = 10;

const SERVICE_CARDS = [
  { key: 'plomberie',   label: 'Plomberie',   icon: 'droplet',  theme: 'black' as const, led: COLORS.green,  category: 'plomberie',   providers: 8  },
  { key: 'electricite', label: 'Électricité',  icon: 'zap',      theme: 'light' as const, led: COLORS.green,  category: 'electricite', providers: 5  },
  { key: 'serrurerie',  label: 'Serrurerie',   icon: 'key',      theme: 'light' as const, led: COLORS.amber,  category: 'serrurerie',  providers: 2  },
  { key: 'chauffage',   label: 'Chauffage',    icon: 'zap',      theme: 'light' as const, led: COLORS.green,  category: 'chauffage',   providers: 6  },
  { key: 'bricolage',   label: 'Bricolage',    icon: 'tool',     theme: 'light' as const, led: COLORS.amber,  category: 'bricolage',   providers: 3  },
  { key: 'peinture',    label: 'Peinture',     icon: 'edit-2',   theme: 'light' as const, led: COLORS.red,    category: 'peinture',    providers: 0  },
];

// Phase test : uniquement Plomberie et Serrurerie
const LAUNCH_CARDS = SERVICE_CARDS.filter(c => c.key === 'plomberie' || c.key === 'serrurerie');

function RunwayCarousel({ onPress, theme }: { onPress: (category: string) => void; theme: AppTheme }) {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP));
    setActiveIndex(Math.min(idx, LAUNCH_CARDS.length - 1));
  };

  return (
    <>
      {/* Section header */}
      <View style={runway.header}>
        <Text style={[runway.headerTitle, { color: theme.textMuted }]}>SERVICES DISPONIBLES</Text>
        <View style={runway.headerHint}>
          <Feather name="chevron-right" size={9} color={theme.textMuted} />
          <Text style={[runway.headerHintText, { color: theme.textMuted }]}>glisser</Text>
        </View>
      </View>

      {/* Cards */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={runway.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {LAUNCH_CARDS.map((card, index) => {
          const isBlack = card.theme === 'black';
          const cardBg = isBlack
            ? theme.accent
            : theme.cardBg;
          const cardBorder = isBlack
            ? theme.accent
            : theme.borderLight;
          const textColor = isBlack ? theme.accentText : theme.text;
          const iconBg = isBlack
            ? 'rgba(255,255,255,0.1)'
            : theme.surface;
          const arrowBg = isBlack
            ? 'rgba(255,255,255,0.12)'
            : theme.surface;

          return (
            <TouchableOpacity
              key={card.key}
              style={[runway.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={() => onPress(card.category)}
              activeOpacity={PRESS_PRIMARY}
            >
              {/* Ghost number */}
              <Text style={[runway.ghostNum, {
                color: isBlack ? 'rgba(255,255,255,0.04)' : (theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.045)'),
              }]}>
                {index + 1}
              </Text>

              <View style={runway.cardInner}>
                {/* Top row: icon + LED + count */}
                <View style={runway.cardTop}>
                  <View style={[runway.iconBox, { backgroundColor: iconBg }]}>
                    <Feather name={card.icon as any} size={14} color={textColor} />
                  </View>
                  <View style={runway.ledRow}>
                    <PulseDot size={6} color={card.led} />
                    <Text style={[runway.providerCount, { color: isBlack ? 'rgba(255,255,255,0.5)' : theme.textMuted }]}>
                      {card.providers}
                    </Text>
                  </View>
                </View>

                {/* Service name */}
                <Text style={[runway.serviceName, { color: textColor }]}>{card.label}</Text>

                {/* Bottom arrow */}
                <View style={runway.cardBottom}>
                  <View style={{ flex: 1 }} />
                  <View style={[runway.cardArrow, { backgroundColor: arrowBg }]}>
                    <Feather name="arrow-right" size={8} color={textColor} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Dots */}
      <View style={runway.dots}>
        {LAUNCH_CARDS.map((_, i) => (
          <View key={i} style={[
            runway.dot,
            { backgroundColor: theme.borderLight },
            i === activeIndex && { width: 20, borderRadius: 2, backgroundColor: theme.accent },
          ]} />
        ))}
      </View>
    </>
  );
}

const runway = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8,
  },
  headerTitle: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.2 },
  headerHint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  headerHintText: { fontFamily: FONTS.mono, fontSize: 10 },

  scrollContent: { paddingHorizontal: 16, gap: CARD_GAP, paddingBottom: 4 },

  card: {
    width: CARD_WIDTH, height: CARD_HEIGHT,
    borderRadius: 20, overflow: 'hidden',
    position: 'relative', borderWidth: 1.5,
  },

  ghostNum: {
    position: 'absolute', bottom: -8, right: 4,
    fontFamily: FONTS.bebas, fontSize: 54, lineHeight: 54,
  },

  cardInner: {
    position: 'relative', zIndex: 2,
    padding: 14, flex: 1,
    justifyContent: 'space-between',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },

  iconBox: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  ledRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  providerCount: { fontFamily: FONTS.mono, fontSize: 10, fontWeight: '600' },

  serviceName: { fontFamily: FONTS.bebas, fontSize: 19, letterSpacing: 0.6, lineHeight: 20 },

  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  cardArrow: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 10, paddingBottom: 4 },
  dot: { width: 4, height: 3, borderRadius: 2 },
});

// ============================================================================
// MISSION ISLAND — active request or empty state
// ============================================================================

function MissionIsland({
  activeMission,
  searchingMission,
  quoteMission,
  onActiveMissionPress,
  onSearchingPress,
  onQuotePress,
  theme,
}: {
  activeMission: DashboardData['requests'][0] | null;
  searchingMission: DashboardData['requests'][0] | null;
  quoteMission?: DashboardData['requests'][0] | null;
  onActiveMissionPress: () => void;
  onSearchingPress: () => void;
  onQuotePress?: () => void;
  theme: AppTheme;
}) {
  const { t } = useTranslation();
  const pulseScale = useRef(new Animated.Value(0)).current;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [etaLabel, setEtaLabel] = useState<string>(t('dashboard.loading_eta'));
  const SEARCH_TIMEOUT = 15 * 60;
  const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Pulse animation
  useEffect(() => {
    if (!activeMission && !searchingMission && !quoteMission) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [activeMission?.id, searchingMission?.id, quoteMission?.id]);

  // Countdown for search
  useEffect(() => {
    if (!searchingMission) { setSecondsLeft(null); return; }
    const compute = () => searchingMission.expiresAt
      ? Math.max(0, Math.floor((new Date(searchingMission.expiresAt).getTime() - Date.now()) / 1000))
      : SEARCH_TIMEOUT;
    setSecondsLeft(compute());
    const iv = setInterval(() => setSecondsLeft(p => (p !== null && p > 0) ? p - 1 : 0), 1000);
    return () => clearInterval(iv);
  }, [searchingMission?.id]);

  // ETA from API
  useEffect(() => {
    if (!activeMission) return;
    const st = activeMission.status.toUpperCase();
    if (['COMPLETED', 'DONE', 'CANCELLED', 'EXPIRED'].includes(st)) return;
    if (st === 'ONGOING') { setEtaLabel(t('dashboard.mission_ongoing')); return; }
    if (st !== 'ACCEPTED') return;

    let cancelled = false;
    const fetchETA = async () => {
      try {
        const details = await api.get(`/requests/${activeMission.id}`);
        const req = details?.data || details;
        const provider = req?.provider;
        if (!provider?.lat || !provider?.lng || !req?.lat || !req?.lng) {
          setEtaLabel(t('dashboard.provider_on_way'));
          return;
        }
        if (GOOGLE_MAPS_API_KEY) {
          const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${provider.lat},${provider.lng}&destination=${req.lat},${req.lng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
          const res = await fetch(url);
          const data = await res.json();
          if (!cancelled && data.status === 'OK' && data.routes?.length > 0) {
            const match = data.routes[0].legs[0].duration.text.match(/(\d+)/);
            const min = match ? parseInt(match[1]) : null;
            setEtaLabel(min !== null && min <= 1 ? t('dashboard.arrival_imminent') : t('dashboard.arrival_in_min', { min }));
            return;
          }
        }
        const R = 6371;
        const dLat = (req.lat - provider.lat) * Math.PI / 180;
        const dLon = (req.lng - provider.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(provider.lat * Math.PI / 180) * Math.cos(req.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const min = Math.ceil((dist * 1.4 / 30) * 60);
        if (!cancelled) setEtaLabel(min <= 1 ? t('dashboard.arrival_imminent') : t('dashboard.arrival_in_min', { min }));
      } catch {
        if (!cancelled) setEtaLabel(t('dashboard.provider_on_way'));
      }
    };
    fetchETA();
    const iv = setInterval(fetchETA, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [activeMission?.id, activeMission?.status]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const pulseOpacity = pulseScale.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0],
  });

  // ── ACCEPTED / ONGOING — HERO mission island (ETA dominant)
  if (activeMission) {
    const isOngoing = activeMission.status.toUpperCase() === 'ONGOING';
    // Extract ETA minutes from etaLabel (e.g. "Arrivée dans 21 min" → "21")
    const etaMinMatch = etaLabel.match(/(\d+)/);
    const etaMin = etaMinMatch ? etaMinMatch[1] : null;

    return (
      <TouchableOpacity
        onPress={onActiveMissionPress}
        activeOpacity={PRESS_PRIMARY}
      >
        <View style={{ padding: 20 }}>
          {/* Status row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <FixedStatusChip variant="ongoing" label={isOngoing ? 'EN COURS' : 'EN ROUTE'} t={theme} />
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.heroSubFaint, letterSpacing: 0.8 }}>
              LIVE · GPS
            </Text>
          </View>

          {/* ETA — the star of the show */}
          {!isOngoing && etaMin ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <Text style={{ fontFamily: FONTS.bebas, fontSize: 56, color: theme.heroText, lineHeight: 56 }}>
                {etaMin}
              </Text>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 13, color: theme.heroSub, letterSpacing: 0.5 }}>
                MIN
              </Text>
            </View>
          ) : null}

          {/* Service name */}
          <Text style={{ fontFamily: FONTS.bebas, fontSize: 22, color: theme.heroText, letterSpacing: 0.4 }} numberOfLines={1}>
            {(activeMission.serviceType || activeMission.title || '').toUpperCase()}
          </Text>

          {/* Address */}
          {activeMission.address ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Feather name="map-pin" size={12} color={theme.heroSub} />
              <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: theme.heroSub }} numberOfLines={1}>
                {activeMission.address}
              </Text>
            </View>
          ) : null}

          {/* Provider row */}
          {activeMission.provider && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              marginTop: 16, paddingTop: 16,
              borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
            }}>
              <FixedAvatar
                name={activeMission.provider.name || 'P'}
                avatarUrl={activeMission.provider.avatarUrl}
                size={40}
                verified
                t={theme}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: theme.heroText }}>
                  {activeMission.provider.name}
                </Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: theme.heroSub }}>
                  {t('dashboard.provider_on_way')}
                </Text>
              </View>
              <TouchableOpacity style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: COLORS.greenBrand,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Feather name="phone" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Feather name="message-square" size={18} color={theme.heroText} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // ── PUBLISHED — searching (même gabarit que active)
  if (searchingMission) {
    return (
      <TouchableOpacity onPress={onSearchingPress} activeOpacity={PRESS_PRIMARY}>
        <View style={{ padding: 20 }}>
          {/* Status row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <FixedStatusChip variant="warning" label="RECHERCHE EN COURS" t={theme} />
            {secondsLeft !== null && (
              <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: theme.heroSubFaint, letterSpacing: 0.5 }}>
                {fmt(secondsLeft)}
              </Text>
            )}
          </View>

          {/* Service name — hero */}
          <Text style={{ fontFamily: FONTS.bebas, fontSize: 26, color: theme.heroText, letterSpacing: 0.4, marginBottom: 4 }} numberOfLines={1}>
            {(searchingMission.serviceType || searchingMission.title || '').toUpperCase()}
          </Text>

          {/* Address */}
          {searchingMission.address ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Feather name="map-pin" size={12} color={theme.heroSub} />
              <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: theme.heroSub }} numberOfLines={1}>
                {searchingMission.address}
              </Text>
            </View>
          ) : null}

          {/* Searching indicator */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
            <PulseDot size={8} color={COLORS.amber} />
            <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: theme.heroSub, flex: 1 }}>
              Recherche d'un prestataire près de chez vous...
            </Text>
            <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.heroSubFaint, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="arrow-right" size={14} color={theme.heroSub} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ── QUOTE_PENDING / QUOTE_SENT — devis (même gabarit)
  if (quoteMission && onQuotePress) {
    const isQuoteSent = quoteMission.status?.toUpperCase() === 'QUOTE_SENT';
    return (
      <TouchableOpacity onPress={onQuotePress} activeOpacity={PRESS_PRIMARY}>
        <View style={{ padding: 20 }}>
          {/* Status row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <FixedStatusChip variant={isQuoteSent ? 'done' : 'pending'} label={isQuoteSent ? 'DEVIS REÇU' : 'DEVIS EN COURS'} t={theme} />
            <Feather name="file-text" size={14} color={theme.heroSubFaint} />
          </View>

          {/* Service name — hero */}
          <Text style={{ fontFamily: FONTS.bebas, fontSize: 26, color: theme.heroText, letterSpacing: 0.4, marginBottom: 4 }} numberOfLines={1}>
            {(quoteMission.serviceType || quoteMission.title || '').toUpperCase()}
          </Text>

          {/* Address */}
          {quoteMission.address ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Feather name="map-pin" size={12} color={theme.heroSub} />
              <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: theme.heroSub }} numberOfLines={1}>
                {quoteMission.address}
              </Text>
            </View>
          ) : null}

          {/* Action hint */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
            <PulseDot size={8} color={isQuoteSent ? COLORS.green : COLORS.amber} />
            <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: theme.heroSub, flex: 1 }}>
              {isQuoteSent ? 'Consultez et répondez au devis' : 'En attente du prestataire'}
            </Text>
            <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.heroSubFaint, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="arrow-right" size={14} color={theme.heroSub} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Empty — no active mission (parent shows "Besoin d'un pro?" instead)
  return null;
}

const islandStyles = StyleSheet.create({
  active: {
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  pulseWrap: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  textWrap: { flex: 1 },
  label: {
    fontFamily: FONTS.mono, fontSize: 11,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  mission: {
    fontFamily: FONTS.bebas, fontSize: 18, letterSpacing: 0.7,
    marginTop: 1, lineHeight: 20,
  },
  sub: { fontFamily: FONTS.sans, fontSize: 11, marginTop: 2 },
  arrow: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  empty: {
    borderWidth: 1.5, borderStyle: 'dashed',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  emptyIconBox: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontFamily: FONTS.sans, fontSize: 11, lineHeight: 16, flex: 1 },
});

// ============================================================================
// ACTIVITY ITEM — recent request row
// ============================================================================

function ActivityItem({
  request,
  onPress,
  isLast,
  theme,
}: {
  request: DashboardData['requests'][0];
  onPress: () => void;
  isLast: boolean;
  theme: AppTheme;
}) {
  const { t } = useTranslation();
  const status = getStatusInfo(request.status, t);
  const serviceName = request.serviceType || request.category?.name || request.title;
  const icon = getServiceIcon(serviceName);
  const date = new Date(request.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const statusKey = request.status?.toUpperCase();
  let badgeBg = theme.badgeDoneBg;
  let badgeTextColor = theme.badgeDoneText;
  if (statusKey === 'CANCELLED' || statusKey === 'EXPIRED') {
    badgeBg = theme.badgeCancelledBg;
    badgeTextColor = theme.badgeCancelledText;
  } else if (['PUBLISHED', 'PENDING', 'PENDING_PAYMENT', 'ACCEPTED', 'ONGOING', 'QUOTE_PENDING'].includes(statusKey || '')) {
    badgeBg = theme.badgePendingBg;
    badgeTextColor = theme.badgePendingText;
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={PRESS_PRIMARY} style={{ marginBottom: 8 }}>
      <FixedCard t={theme} pad={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name={icon as any} size={18} color={theme.textSub} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 13.5, color: theme.text }} numberOfLines={1}>
              {serviceName || t('common.service')}
            </Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.textMuted, letterSpacing: 0.6, marginTop: 2 }}>
              {date.toUpperCase()} · FIXED #{String(request.id).slice(-4)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {request.price ? (
              <FixedPrice amount={request.price} size={22} color={theme.text} />
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: badgeBg, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: badgeTextColor }} />
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: badgeTextColor, letterSpacing: 0.5 }}>{status.label}</Text>
            </View>
          </View>
        </View>
      </FixedCard>
    </TouchableOpacity>
  );
}

const actStyles = StyleSheet.create({
  card: {
    borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONTS.sansMedium, fontSize: 13.5, lineHeight: 16 },
  meta: { fontFamily: FONTS.mono, fontSize: 10.5, marginTop: 2, letterSpacing: 0.6 },
  right: { alignItems: 'flex-end', gap: 4 },
  price: { fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 0.4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5 },
});

// ============================================================================
// UPCOMING ISLAND CARD — demande planifiée future
// Même layout que MissionIsland.active, mais outlined (pas filled) pour marquer
// que la demande n'est pas encore active — juste planifiée pour plus tard.
// ============================================================================

// Live countdown: "2J 14H", "3H 45M", "45M", "< 1M"
function useCountdown(targetDate: Date | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetDate) return;
    const iv = setInterval(() => setNow(Date.now()), 60_000); // tick every minute
    return () => clearInterval(iv);
  }, [targetDate]);

  if (!targetDate) return { label: '', fraction: 0 };
  const diff = Math.max(0, targetDate.getTime() - now);
  const totalMin = Math.floor(diff / 60_000);
  const h = Math.floor(totalMin / 60);
  const d = Math.floor(h / 24);
  const m = totalMin % 60;

  let label: string;
  if (d >= 1) label = `${d}J ${h % 24}H`;
  else if (h >= 1) label = `${h}H ${String(m).padStart(2, '0')}M`;
  else if (totalMin >= 1) label = `${totalMin}M`;
  else label = '< 1M';

  // fraction 0→1 based on 48h window (visual only, clamps)
  const maxWindow = 48 * 60 * 60 * 1000;
  const fraction = Math.min(1, Math.max(0, diff / maxWindow));
  return { label, fraction };
}

function UpcomingIslandCard({
  request,
  onPress,
  theme,
}: {
  request: DashboardData['requests'][0];
  onPress: () => void;
  theme: AppTheme;
}) {
  const serviceName = request.serviceType || request.category?.name || request.title;
  const isQuote = request.pricingMode === 'estimate' || request.pricingMode === 'diagnostic';
  const statusUp = (request.status || '').toUpperCase();
  const isAccepted = statusUp === 'ACCEPTED';

  const scheduledDate = request.preferredTimeStart ? new Date(request.preferredTimeStart) : null;
  const { label: countdownLabel, fraction } = useCountdown(scheduledDate);

  // Date label: "Demain · 09:00" or "Mer 8 avr · 10:00"
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isTomorrow = scheduledDate && scheduledDate.getDate() === tomorrow.getDate() &&
                     scheduledDate.getMonth() === tomorrow.getMonth() &&
                     scheduledDate.getFullYear() === tomorrow.getFullYear();
  const dayLabel = scheduledDate
    ? (isTomorrow
        ? 'Demain'
        : scheduledDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }))
    : '';
  const timeLabel = scheduledDate
    ? scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';

  // Progress bar color: green if accepted, warm accent if waiting
  const barColor = isAccepted ? COLORS.greenBrand : (theme.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)');
  const barTrack = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <TouchableOpacity
      style={[uc.card, {
        backgroundColor: theme.cardBg,
        borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      }]}
      onPress={onPress}
      activeOpacity={PRESS_PRIMARY}
    >
      {/* Top row: service name + countdown */}
      <View style={uc.topRow}>
        <View style={uc.topLeft}>
          {/* Badge devis/planifiée */}
          <View style={[uc.typeBadge, isQuote
            ? { backgroundColor: 'rgba(232,168,56,0.10)' }
            : { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }
          ]}>
            <Text style={[uc.typeLabel, { color: isQuote ? COLORS.amber : theme.textMuted }]}>
              {isQuote ? 'DEVIS' : 'PLANIFIÉE'}
            </Text>
          </View>
          <Text style={[uc.serviceName, { color: theme.text }]} numberOfLines={1}>
            {serviceName}
          </Text>
        </View>
        {/* Countdown block */}
        <View style={uc.countdownWrap}>
          <Text style={[uc.countdownValue, { color: theme.text }]}>{countdownLabel}</Text>
        </View>
      </View>

      {/* Progress bar (diminishes as time approaches) */}
      <View style={[uc.progressTrack, { backgroundColor: barTrack }]}>
        <View style={[uc.progressFill, { backgroundColor: barColor, width: `${Math.max(2, fraction * 100)}%` }]} />
      </View>

      {/* Bottom row: date + status */}
      <View style={uc.bottomRow}>
        <View style={uc.dateRow}>
          <Feather name="calendar" size={13} color={theme.textMuted} />
          <Text style={[uc.dateText, { color: theme.textSub }]}>
            {dayLabel}{timeLabel ? ` · ${timeLabel}` : ''}
          </Text>
        </View>
        {isAccepted ? (
          <View style={uc.statusBadge}>
            <View style={[uc.statusDot, { backgroundColor: COLORS.greenBrand }]} />
            <Text style={[uc.statusText, { color: COLORS.greenBrand }]}>
              {request.provider?.name ? `${request.provider.name}` : 'Confirmé'}
            </Text>
          </View>
        ) : (
          <View style={uc.statusBadge}>
            <View style={[uc.statusDot, { backgroundColor: theme.textMuted as string }]} />
            <Text style={[uc.statusText, { color: theme.textMuted }]}>En attente</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const uc = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1,
    padding: 16, gap: 14,
  },

  // Top
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  topLeft: { flex: 1, gap: 6 },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  typeLabel: { fontFamily: FONTS.sansMedium, fontSize: 10, letterSpacing: 1.5 },
  serviceName: { fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 0.3, lineHeight: 25 },

  // Countdown
  countdownWrap: { alignItems: 'flex-end', justifyContent: 'center', paddingTop: 2 },
  countdownValue: { fontFamily: FONTS.bebas, fontSize: 28, letterSpacing: 1, lineHeight: 30 },

  // Progress bar
  progressTrack: { height: 3, borderRadius: 1.5, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 1.5 },

  // Bottom
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontFamily: FONTS.sans, fontSize: 13 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: FONTS.sansMedium, fontSize: 12 },
});

// ============================================================================
// SKELETON — shown during cold load instead of a blank spinner
// Mirrors the shell of the real dashboard (topbar, runway, CTA, island, list)
// with a subtle pulse so the layout doesn't reflow when data arrives.
// ============================================================================

function DashboardSkeleton({ theme }: { theme: AppTheme }) {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const Block = ({ w, h, style }: { w: number | `${number}%`; h: number; style?: object }) => (
    <Animated.View
      style={[
        { width: w, height: h, borderRadius: 8, backgroundColor: theme.surface, opacity: pulse },
        style,
      ]}
    />
  );

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={{ paddingBottom: 32 }}>
        {/* Topbar */}
        <View style={s.topbar}>
          <View>
            <Block w={100} h={10} style={{ marginBottom: 8 }} />
            <Block w={160} h={28} />
          </View>
          <View style={s.topbarActions}>
            <Block w={36} h={36} style={{ borderRadius: 10 }} />
            <Block w={36} h={36} style={{ borderRadius: 10 }} />
          </View>
        </View>

        {/* Hero CTA */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <Block w="100%" h={200} style={{ borderRadius: 20 }} />
        </View>

        {/* Mission island */}
        <View style={[s.sectionHead, { paddingTop: 24 }]}>
          <Block w={80} h={10} />
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <Block w="100%" h={70} style={{ borderRadius: 12 }} />
        </View>

        {/* Services grid */}
        <View style={[s.sectionHead, { paddingTop: 24 }]}>
          <Block w={70} h={10} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10 }}>
          <Block w="48%" h={100} style={{ borderRadius: 18 }} />
          <Block w="48%" h={100} style={{ borderRadius: 18 }} />
        </View>

        {/* Activity */}
        <View style={[s.sectionHead, { paddingTop: 24 }]}>
          <Block w={100} h={10} />
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <Block w="100%" h={68} style={{ borderRadius: 18 }} />
          <Block w="100%" h={68} style={{ borderRadius: 18 }} />
          <Block w="100%" h={68} style={{ borderRadius: 18 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Volontairement très limité côté dashboard : 3 par défaut, 6 au max après "Voir plus".
// L'historique complet vit dans /missions ou /documents pour ne pas faire concurrence.
const PREVIEW_COUNT = 3;
const EXPANDED_COUNT = 6;

export default function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { socket, unreadCount, unreadMessages } = useSocket();
  const theme = useAppTheme();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [invoiceVisible, setInvoiceVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 70 : 54;

  // CTA squeezy scale animation (tier-1 feel)
  const ctaScale = useRef(new Animated.Value(1)).current;

  const bottomSheetRef = useRef<BottomSheet>(null);

  const invoiceRequestId = selectedRequest?.status?.toUpperCase() === 'DONE' ? selectedRequest?.id : null;
  const { invoice } = useInvoice(invoiceRequestId ? Number(invoiceRequestId) : null);

  // ── Data ──
  const loadDashboard = useCallback(async () => {
    try {
      const response = await api.get('/client/dashboard');
      setData(response.data || response);
    } catch (error) {
      devError('Dashboard load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const lastFetchRef = useRef(0);
  // Persist accepted-request deduplication across socket re-registrations so
  // we don't double-navigate on reconnect. Module-local would bleed across
  // users, so it's scoped per Dashboard mount via useRef.
  const acceptedIdsRef = useRef<Set<string>>(new Set());
  useFocusEffect(useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current > 60_000) { // 60s cache — socket handles real-time updates
      lastFetchRef.current = now;
      InteractionManager.runAfterInteractions(() => loadDashboard());
    }
  }, [loadDashboard]));
  const onRefresh = () => { setRefreshing(true); loadDashboard(); };

  // ── Navigation ──
  const navigateToMissionView = useCallback((request: any) => {
    const r = request;
    const scheduledFor = r.scheduledFor || r.preferredTimeStart;
    router.replace({
      pathname: '/request/[id]/missionview',
      params: {
        id:             String(r.id),
        serviceName:    r.title || r.serviceType || r.name || '',
        address:        r.address || '',
        price:          String(r.price || ''),
        scheduledLabel: scheduledFor
          ? new Date(scheduledFor).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : 'Dès maintenant',
        expiresAt: r.expiresAt || '',
        lat: String(r.lat || ''),
        lng: String(r.lng || ''),
      },
    });
  }, [router]);

  const navigateToSearching = useCallback((request: any) => {
    navigateToMissionView(request);
  }, [navigateToMissionView]);

  // ── Socket ──
  useEffect(() => {
    if (!socket || !user?.id) return;
    // Note: user room join is handled server-side on socket connection (server.js)
    // No need to emit join:user from client — avoids leave/join spam on re-render

    const updateRequestStatus = (requestId: string | number, newStatus: string) => {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          requests: prev.requests.map(r =>
            String(r.id) === String(requestId) ? { ...r, status: newStatus } : r
          ),
        };
      });
    };

    const handleAccepted = (d: any) => {
      const reqId = String(d.id || d.requestId);
      if (acceptedIdsRef.current.has(reqId)) return;
      if (d.clientId && d.clientId !== user?.id) return;
      acceptedIdsRef.current.add(reqId);
      updateRequestStatus(reqId, 'ACCEPTED');
      if (reqId) {
        api.get(`/requests/${reqId}`)
          .then(res => {
            const req = res?.data || res;
            // Scheduled future mission → recap screen, not missionview
            const pts = req.preferredTimeStart;
            if (pts && new Date(pts).getTime() > Date.now()) {
              router.replace({
                pathname: '/request/[id]/scheduled',
                params: { id: reqId, mode: 'recap' },
              });
            } else {
              navigateToMissionView(req);
            }
          })
          .catch(() => {
            router.replace({
              pathname: '/request/[id]/missionview',
              params: { id: reqId },
            });
          });
      }
    };
    const handleStarted       = (d: any) => { updateRequestStatus(d.id || d.requestId, 'ONGOING'); };
    const handleCompleted     = (d: any) => { updateRequestStatus(d.id || d.requestId, 'DONE');      loadDashboard(); };
    const handleCancelled     = (d: any) => { updateRequestStatus(d.id || d.requestId, 'CANCELLED'); loadDashboard(); };
    const handleExpired       = (d: any) => { updateRequestStatus(d.id || d.requestId, 'EXPIRED');   loadDashboard(); };
    const handlePublished     = (d: any) => { updateRequestStatus(d.requestId, 'PUBLISHED'); };
    const handleStatusUpdated = (d: any) => { updateRequestStatus(d.requestId, d.status);   loadDashboard(); };

    socket.on('request:accepted',      handleAccepted);
    socket.on('request:started',       handleStarted);
    socket.on('request:completed',     handleCompleted);
    socket.on('request:cancelled',     handleCancelled);
    socket.on('request:expired',       handleExpired);
    socket.on('request:published',     handlePublished);
    socket.on('request:statusUpdated', handleStatusUpdated);
    socket.on('provider:accepted',     handleAccepted);

    return () => {
      socket.off('request:accepted',      handleAccepted);
      socket.off('request:started',       handleStarted);
      socket.off('request:completed',     handleCompleted);
      socket.off('request:cancelled',     handleCancelled);
      socket.off('request:expired',       handleExpired);
      socket.off('request:published',     handlePublished);
      socket.off('request:statusUpdated', handleStatusUpdated);
      socket.off('provider:accepted',     handleAccepted);
    };
  }, [socket, user?.id, router, loadDashboard, navigateToMissionView]);

  // ── Actions ──
  const handleRequestPress = async (requestId: string) => {
    const localReq = data?.requests?.find(r => String(r.id) === String(requestId));
    if (localReq?.status?.toUpperCase() === 'PUBLISHED') {
      navigateToSearching(localReq);
      return;
    }
    if (localReq && ['ACCEPTED', 'ONGOING'].includes(localReq.status?.toUpperCase())) {
      navigateToMissionView(localReq);
      return;
    }
    setLoadingDetails(true);
    bottomSheetRef.current?.expand();
    try {
      const details = await api.get(`/requests/${requestId}`);
      const req = details.request || details.data || details;
      if (req?.status?.toUpperCase() === 'PUBLISHED') {
        bottomSheetRef.current?.close();
        navigateToSearching(req);
        return;
      }
      if (['ACCEPTED', 'ONGOING'].includes(req?.status?.toUpperCase())) {
        bottomSheetRef.current?.close();
        navigateToMissionView(req);
        return;
      }
      setSelectedRequest(req);
    } catch (error) {
      devError('Error loading request details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleNavigateToMission = useCallback((request: any) => {
    bottomSheetRef.current?.close();
    navigateToMissionView(request);
  }, [navigateToMissionView]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.3} />
    ), []
  );

  // Missions "actives maintenant" : ACCEPTED/ONGOING MAIS pas planifiées pour plus tard.
  // Une mission ACCEPTED avec preferredTimeStart dans le futur = engagement d'un
  // prestataire sur une date future → reste dans "À venir" jusqu'au jour J.
  const activeMission = useMemo(() =>
    data?.requests?.find(r =>
      ['ACCEPTED', 'ONGOING'].includes(r.status?.toUpperCase()) &&
      !isScheduledFuture(r)
    ) || null,
    [data]
  );

  // PUBLISHED "maintenant" uniquement — exclut les demandes planifiées futures
  // qui vont dans la section "À venir" séparée.
  const searchingMission = useMemo(
    () => activeMission ? null : (data?.requests?.find(r =>
      r.status?.toUpperCase() === 'PUBLISHED' && !isScheduledFuture(r)
    ) || null),
    [data, activeMission]
  );

  // Devis "maintenant" uniquement — exclut les devis planifiés futurs.
  const quoteMission = useMemo(
    () => (activeMission || searchingMission) ? null : (data?.requests?.find(r =>
      ['QUOTE_PENDING', 'QUOTE_SENT'].includes(r.status?.toUpperCase()) && !isScheduledFuture(r)
    ) || null),
    [data, activeMission, searchingMission]
  );

  const HIDDEN_STATUSES = ['CANCELLED', 'QUOTE_REFUSED', 'QUOTE_EXPIRED'];
  const DOCUMENT_STATUSES = ['QUOTE_PENDING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'];

  // Activités récentes : exclut les HIDDEN, les devis (→ tab Documents), et les scheduled futurs (→ section À venir)
  const activityRequests = useMemo(
    () => (data?.requests || []).filter(r =>
      !HIDDEN_STATUSES.includes(r.status?.toUpperCase()) &&
      !DOCUMENT_STATUSES.includes(r.status?.toUpperCase()) &&
      !isScheduledFuture(r)
    ),
    [data]
  );

  // Section "À venir" : demandes planifiées dans le futur, triées par date croissante
  const upcomingRequests = useMemo(
    () => (data?.requests || [])
      .filter(r => isScheduledFuture(r))
      .filter(r => !['CANCELLED', 'QUOTE_REFUSED', 'QUOTE_EXPIRED', 'DONE'].includes(r.status?.toUpperCase()))
      .sort((a, b) =>
        new Date(a.preferredTimeStart!).getTime() - new Date(b.preferredTimeStart!).getTime()
      ),
    [data]
  );

  const displayedRequests = useMemo(() => {
    // Cap à EXPANDED_COUNT même quand "Voir plus" est cliqué — l'historique
    // complet est accessible depuis l'onglet Missions / Documents.
    const limit = showAllRequests ? EXPANDED_COUNT : PREVIEW_COUNT;
    return activityRequests.slice(0, limit);
  }, [activityRequests, showAllRequests]);

  const totalCount = activityRequests.length;
  const hasMore = totalCount > PREVIEW_COUNT;

  // ── Guards ──
  if (user?.roles?.includes('PROVIDER')) return <ProviderDashboard />;

  // Skeleton shell during cold load — prevents layout reflow when data lands
  if (loading && !refreshing && !data) {
    return <DashboardSkeleton theme={theme} />;
  }

  const name = data?.me?.name || user?.email?.split('@')[0] || '';

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════════════════════
            ADAPTIVE TOP: État A (idle) vs État B (mission active)
            Quand une mission est active, elle ÉCRASE le hero.
            ══════════════════════════════════════════════════════════════ */}

        {/* ── TOP BAR — always visible, compact ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: (activeMission || searchingMission || quoteMission) ? 12 : 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.textMuted, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 4 }}>
                {data?.me?.city?.toUpperCase() || 'BRUSSELS'}
              </Text>
              <Text style={{ fontFamily: FONTS.bebas, fontSize: (activeMission || searchingMission || quoteMission) ? 22 : 28, color: theme.text, letterSpacing: 0.4 }}>
                {`${getGreeting(t)}, ${name.split(' ')[0]}`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <FixedIconBtn icon="bell" t={theme} badge={unreadCount > 0} onPress={() => { hapticLight(); router.push('/notifications'); }} />
              <FixedIconBtn icon="message-square" t={theme} badge={unreadMessages > 0} onPress={() => { hapticLight(); router.push('/messages'); }} />
            </View>
          </View>
        </View>

        {/* ── ÎLOT NOIR — un seul bloc, deux états ── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
          <View style={{
            backgroundColor: theme.heroBg, borderRadius: 20, overflow: 'hidden',
            borderWidth: theme.isDark ? 1 : 0, borderColor: theme.borderLight,
          }}>
            {(activeMission || searchingMission || quoteMission) ? (
              /* ── État actif : mission en cours ── */
              <MissionIsland
                activeMission={activeMission}
                searchingMission={searchingMission}
                quoteMission={quoteMission}
                onActiveMissionPress={() => {
                  if (!activeMission) return;
                  hapticLight();
                  navigateToMissionView(activeMission);
                }}
                onSearchingPress={() => {
                  if (!searchingMission) return;
                  hapticLight();
                  navigateToSearching(searchingMission);
                }}
                onQuotePress={() => {
                  if (!quoteMission) return;
                  hapticLight();
                  const st = quoteMission.status?.toUpperCase();
                  if (st === 'QUOTE_SENT') {
                    router.push({ pathname: '/request/[id]/quote-review', params: { id: String(quoteMission.id) } });
                  } else {
                    router.push({ pathname: '/request/[id]/quote-pending', params: { id: String(quoteMission.id) } });
                  }
                }}
                theme={theme}
              />
            ) : (
              /* ── État idle : "Besoin d'un pro ?" ── */
              <View style={{ padding: 20 }}>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.heroSubFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                  DISPONIBLE · 24/7
                </Text>
                <Text style={{ fontFamily: FONTS.bebas, fontSize: 28, color: theme.heroText, letterSpacing: 0.4, marginBottom: 18 }}>
                  Besoin d'un pro ?
                </Text>
                <Pressable
                  onPressIn={() => { Animated.spring(ctaScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start(); }}
                  onPressOut={() => { Animated.spring(ctaScale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start(); }}
                  onPress={() => { hapticMedium(); router.push('/request/NewRequestStepper'); }}
                >
                  <Animated.View style={[{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    borderRadius: 13, paddingVertical: 14,
                    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    transform: [{ scale: ctaScale }],
                  }]}>
                    <Feather name="plus" size={16} color={theme.heroText} />
                    <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: theme.heroText }}>
                      Nouvelle demande
                    </Text>
                  </Animated.View>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* ── À VENIR (demandes planifiées futures) ── */}
        {upcomingRequests.length > 0 && (
          <>
            <View style={{ marginTop: 22 }}>
              <FixedSectionHeader label="À VENIR" action={String(upcomingRequests.length)} t={theme} />
            </View>
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {upcomingRequests.map((req) => (
                <UpcomingIslandCard
                  key={req.id}
                  request={req}
                  theme={theme}
                  onPress={() => {
                    hapticLight();
                    router.push({
                      pathname: '/request/[id]/scheduled',
                      params: { id: String(req.id), mode: 'recap' },
                    });
                  }}
                />
              ))}
            </View>
          </>
        )}

        {/* ── POPULAR SERVICES (2x2 grid) ── */}
        <View style={{ marginTop: 26 }}>
          <FixedSectionHeader label="SERVICES" t={theme} />
        </View>
        <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {LAUNCH_CARDS.map((card) => (
            <TouchableOpacity
              key={card.key}
              onPress={() => {
                hapticMedium();
                router.push(`/request/NewRequestStepper?selectedCategory=${card.category}`);
              }}
              activeOpacity={PRESS_PRIMARY}
              style={{ width: (Dimensions.get('window').width - 42) / 2 }}
            >
              <FixedCard t={theme} pad={14}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Feather name={card.icon as any} size={18} color={theme.text} />
                </View>
                <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: theme.text }}>{card.label}</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.textMuted, letterSpacing: 0.6, marginTop: 3 }}>
                  {card.providers} PROS
                </Text>
              </FixedCard>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── ACTIVITÉ RÉCENTE ── */}
        <View style={{ marginTop: 26 }}>
          <FixedSectionHeader label={t('dashboard.recent_activity').toUpperCase()} action={totalCount ? String(totalCount) : undefined} t={theme} onAction={() => { hapticLight(); onRefresh(); }} />
        </View>

        <View style={s.activityList}>
          {!data?.requests?.length ? (
            <View style={s.emptyActivity}>
              <View style={[s.emptyActivityIcon, { backgroundColor: theme.surface }]}>
                <Feather name="file-text" size={22} color={theme.textDisabled} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.text }]}>{t('dashboard.no_missions')}</Text>
              <Text style={[s.emptySub, { color: theme.textMuted }]}>{t('dashboard.missions_appear_here')}</Text>
            </View>
          ) : (
            <>
              {displayedRequests.map((req, i) => (
                <ActivityItem
                  key={req.id}
                  request={req}
                  onPress={() => { hapticLight(); handleRequestPress(req.id); }}
                  isLast={i === displayedRequests.length - 1 && (!hasMore || showAllRequests)}
                  theme={theme}
                />
              ))}
            </>
          )}
        </View>

        {/* See all button */}
        {hasMore && (
          <TouchableOpacity
            style={s.seeAllBtn}
            onPress={() => { hapticLight(); setShowAllRequests(v => !v); }}
            activeOpacity={PRESS_SECONDARY}
          >
            <Text style={[s.seeAllText, { color: theme.textMuted }]}>
              {showAllRequests ? t('dashboard.collapse') : 'Voir plus'}
            </Text>
            <Feather name={showAllRequests ? 'chevron-up' : 'chevron-down'} size={11} color={theme.textMuted} />
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* ── Bottom Sheet detail ── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={[s.sheetBg, { backgroundColor: theme.cardBg }]}
        handleIndicatorStyle={[s.sheetIndicator, { backgroundColor: theme.borderLight }]}
        maxDynamicContentSize={Dimensions.get('window').height * 0.85}
      >
        <BottomSheetScrollView contentContainerStyle={[s.sheet, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {loadingDetails ? (
            <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }} />
          ) : selectedRequest ? (
            <>
              <Text style={[s.sheetTitle, { color: theme.text }]}>{selectedRequest.title || selectedRequest.serviceType}</Text>

              <View style={[s.statusBadge, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
                <PulseDot size={6} color={getStatusInfo(selectedRequest.status, t).ledColor} />
                <Text style={[s.statusBadgeText, { color: theme.textSub }]}>{getStatusInfo(selectedRequest.status, t).label}</Text>
              </View>

              {[
                { icon: 'file-text', val: selectedRequest.description || t('dashboard.no_description') },
                selectedRequest.address && { icon: 'map-pin', val: selectedRequest.address },
                selectedRequest.price    && { icon: 'dollar-sign', val: `${selectedRequest.price} €` },
              ].filter(Boolean).map((row: any, i) => (
                <View key={i} style={s.sheetRow}>
                  <View style={[s.sheetRowIcon, { backgroundColor: theme.surface }]}>
                    <Feather name={row.icon} size={14} color={theme.textSub} />
                  </View>
                  <Text style={[s.sheetVal, { color: theme.textSub }]}>{row.val}</Text>
                </View>
              ))}

              {['ACCEPTED', 'ONGOING'].includes(selectedRequest.status?.toUpperCase()) && (
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={() => handleNavigateToMission(selectedRequest)}>
                  <Text style={[s.actionBtnText, { color: theme.accentText }]}>
                    {selectedRequest.status === 'ACCEPTED' ? t('dashboard.track_provider') : t('dashboard.track_mission')}
                  </Text>
                  <Feather name="navigation" size={17} color={theme.accentText} />
                </TouchableOpacity>
              )}

              {selectedRequest.status?.toUpperCase() === 'PUBLISHED' && (
                <>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: theme.accent }]}
                    onPress={() => {
                      bottomSheetRef.current?.close();
                      navigateToSearching(selectedRequest);
                    }}
                  >
                    <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.track_search')}</Text>
                    <Feather name="radio" size={17} color={theme.accentText} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.resendBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
                    onPress={async () => {
                      try { await api.post(`/requests/${selectedRequest.id}/notify`); } catch {}
                    }}
                  >
                    <Feather name="refresh-cw" size={15} color={theme.textSub} />
                    <Text style={[s.resendText, { color: theme.textSub }]}>{t('dashboard.resend_providers')}</Text>
                  </TouchableOpacity>
                </>
              )}

              {selectedRequest.status?.toUpperCase() === 'DONE' && (
                <>
                  <View style={[s.doneCard, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
                    <Feather name="check-circle" size={20} color={COLORS.green} />
                    <Text style={[s.doneText, { color: theme.text }]}>{t('dashboard.mission_success')}</Text>
                  </View>
                  {invoice && (
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: theme.accent, marginTop: 10 }]}
                      onPress={() => {
                        bottomSheetRef.current?.close();
                        setTimeout(() => setInvoiceVisible(true), 300);
                      }}
                      activeOpacity={PRESS_PRIMARY}
                    >
                      <Feather name="file-text" size={17} color={theme.accentText} />
                      <Text style={[s.actionBtnText, { color: theme.accentText }]}>Voir la facture</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {selectedRequest.status?.toUpperCase() === 'PENDING_PAYMENT' && (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: theme.accent }]}
                  onPress={() => {
                    bottomSheetRef.current?.close();
                    router.push({
                      pathname: '/request/[id]/resume-payment',
                      params: { id: String(selectedRequest.id) },
                    });
                  }}
                >
                  <Text style={[s.actionBtnText, { color: theme.accentText }]}>Reprendre le paiement</Text>
                  <Feather name="credit-card" size={17} color={theme.accentText} />
                </TouchableOpacity>
              )}

              {['QUOTE_PENDING', 'QUOTE_SENT'].includes(selectedRequest.status?.toUpperCase()) && (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: theme.accent }]}
                  onPress={() => {
                    bottomSheetRef.current?.close();
                    const path = selectedRequest.status?.toUpperCase() === 'QUOTE_SENT'
                      ? '/request/[id]/quote-review'
                      : '/request/[id]/quote-pending';
                    router.push({
                      pathname: path,
                      params: { id: String(selectedRequest.id) },
                    });
                  }}
                >
                  <Text style={[s.actionBtnText, { color: theme.accentText }]}>
                    {selectedRequest.status?.toUpperCase() === 'QUOTE_SENT' ? 'Voir le devis' : 'Suivre la demande'}
                  </Text>
                  <Feather name={selectedRequest.status?.toUpperCase() === 'QUOTE_SENT' ? 'file-text' : 'clock'} size={17} color={theme.accentText} />
                </TouchableOpacity>
              )}

              {selectedRequest.status?.toUpperCase() === 'QUOTE_ACCEPTED' && (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: theme.accent }]}
                  onPress={() => handleNavigateToMission(selectedRequest)}
                >
                  <Text style={[s.actionBtnText, { color: theme.accentText }]}>Suivre l'intervention</Text>
                  <Feather name="navigation" size={17} color={theme.accentText} />
                </TouchableOpacity>
              )}

              {selectedRequest.status?.toUpperCase() === 'EXPIRED' && (
                <>
                  <View style={[s.expiredCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.borderLight }]}>
                    <Feather name="clock" size={20} color={theme.textSub} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.expiredTitle, { color: theme.text }]}>{t('dashboard.no_provider_found')}</Text>
                      <Text style={[s.expiredSub, { color: theme.textMuted }]}>{t('dashboard.restart_search_sub')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={() => { bottomSheetRef.current?.close(); router.push('/request/NewRequestStepper'); }}>
                    <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.restart_search')}</Text>
                    <Feather name="refresh-cw" size={17} color={theme.accentText} />
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : null}
        </BottomSheetScrollView>
      </BottomSheet>

      <InvoiceSheet
        invoice={invoice}
        isVisible={invoiceVisible}
        onClose={() => setInvoiceVisible(false)}
        userRole="client"
        providerName={selectedRequest?.provider?.name}
        serviceTitle={selectedRequest?.serviceType || selectedRequest?.title}
        missionDate={selectedRequest?.completedAt || selectedRequest?.createdAt}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 32 },

  // ── Top bar ──
  topbar: {
    paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14,
  },
  greeting: {
    fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.9,
    textTransform: 'uppercase', marginBottom: 6,
  },
  name: { fontFamily: FONTS.bebas, fontSize: 44, letterSpacing: 0.4 },
  topbarActions: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute', top: 8, right: 8,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: COLORS.orangeBrand, borderWidth: 1.5,
  },

  // ── Hero CTA card ──
  heroCard: {
    borderRadius: 20, padding: 20,
    overflow: 'hidden', borderWidth: 1,
  },
  heroTag: {
    fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10,
    color: 'rgba(255,255,255,0.38)',
  },
  heroTitle: {
    fontFamily: FONTS.bebas, fontSize: 34, letterSpacing: 0.5,
    color: '#F2F0EB', marginBottom: 4,
  },
  heroSub: {
    fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19,
    marginTop: 10, marginBottom: 16,
  },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 13,
    borderRadius: 13, alignSelf: 'flex-start',
  },
  heroBtnText: { fontFamily: FONTS.sansMedium, fontSize: 14 },

  // ── Services grid ──
  servicesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 10,
  },
  serviceCard: {
    width: (Dimensions.get('window').width - 42) / 2,
    borderRadius: 18, borderWidth: 1,
    padding: 14,
  },
  serviceIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  serviceCardName: { fontFamily: FONTS.sansMedium, fontSize: 14 },
  serviceCardFrom: {
    fontFamily: FONTS.mono, fontSize: 10.5,
    letterSpacing: 0.6, marginTop: 3,
  },

  // ── Section headers ──
  sectionHead: {
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sectionTitle: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionActionText: { fontFamily: FONTS.mono, fontSize: 11 },

  // ── Activity list ──
  activityList: { paddingHorizontal: 16 },

  emptyActivity: { padding: 44, alignItems: 'center', gap: 10 },
  emptyActivityIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontFamily: FONTS.sansMedium, fontSize: 15 },
  emptySub: { fontFamily: FONTS.sans, fontSize: 13, textAlign: 'center' },

  // ── See all button ──
  seeAllBtn: {
    marginHorizontal: 16, marginTop: 4,
    paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  seeAllText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.2 },

  // ── Bottom sheet ──
  sheetBg: { borderRadius: 28 },
  sheetIndicator: { width: 36 },
  sheet: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  sheetTitle: { fontFamily: FONTS.bebas, fontSize: 24, marginBottom: 10, letterSpacing: 0.5 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, marginBottom: 20,
    borderWidth: 1,
  },
  statusBadgeText: { fontFamily: FONTS.mono, fontSize: 12 },

  sheetRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  sheetRowIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetVal: { fontFamily: FONTS.sans, flex: 1, fontSize: 14, lineHeight: 21, paddingTop: 5 },

  actionBtn: {
    flexDirection: 'row', height: 54,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 18,
  },
  actionBtnText: { fontFamily: FONTS.bebas, fontSize: 17, letterSpacing: 0.8 },

  resendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, marginTop: 12, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1,
  },
  resendText: { fontFamily: FONTS.mono, fontSize: 13 },

  doneCard: {
    borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18,
    borderWidth: 1,
  },
  doneText: { fontFamily: FONTS.sansMedium, fontSize: 14 },

  expiredCard: {
    borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 18,
    borderWidth: 1,
  },
  expiredTitle: { fontFamily: FONTS.sansMedium, fontSize: 14, marginBottom: 4 },
  expiredSub: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19 },
});
