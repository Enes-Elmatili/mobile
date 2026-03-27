/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
// app/(tabs)/dashboard.tsx
import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth/AuthContext';
import { useSocket } from '../../lib/SocketContext';
import { api } from '../../lib/api';
import BottomSheet, { BottomSheetView, BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProviderDashboard from '../../app/(tabs)/provider-dashboard';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/hooks/use-app-theme';
import InvoiceSheet from '@/components/sheets/InvoiceSheet';
import { useInvoice } from '@/hooks/useInvoice';
import { devError } from '@/lib/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    createdAt: string;
    expiresAt?: string;
    category?: { id: number; name: string };
    subcategory?: { id: number; name: string };
  }[];
}

// ============================================================================
// UTILS
// ============================================================================

const getStatusInfo = (status: string, t: (key: string) => string) => {
  const s = (status || 'PENDING').toUpperCase();
  const map: Record<string, { label: string; icon: string; ledColor: string }> = {
    DONE:            { label: t('dashboard.status_done'),      icon: 'checkmark-circle-outline', ledColor: COLORS.green },
    CANCELLED:       { label: t('dashboard.status_cancelled'), icon: 'close-circle-outline',     ledColor: COLORS.red },
    ONGOING:         { label: t('dashboard.status_ongoing'),   icon: 'time-outline',             ledColor: COLORS.green },
    PUBLISHED:       { label: t('dashboard.status_published'), icon: 'radio-outline',            ledColor: COLORS.amber },
    ACCEPTED:        { label: t('dashboard.status_accepted'),  icon: 'hand-left-outline',        ledColor: COLORS.green },
    PENDING_PAYMENT: { label: t('dashboard.status_payment'),   icon: 'card-outline',             ledColor: COLORS.amber },
    QUOTE_PENDING:   { label: 'Devis en cours',                icon: 'document-text-outline',    ledColor: COLORS.amber },
    QUOTE_SENT:      { label: 'Devis reçu',                   icon: 'document-text-outline',    ledColor: COLORS.green },
    QUOTE_ACCEPTED:  { label: 'Devis accepté',                icon: 'checkmark-circle-outline', ledColor: COLORS.green },
    QUOTE_REFUSED:   { label: 'Devis refusé',                 icon: 'close-circle-outline',     ledColor: COLORS.red },
    QUOTE_EXPIRED:   { label: 'Devis expiré — remboursé',     icon: 'time-outline',             ledColor: COLORS.red },
    EXPIRED:         { label: t('dashboard.status_expired'),   icon: 'time-outline',             ledColor: COLORS.red },
  };
  return map[s] || { label: s, icon: 'help-circle-outline', ledColor: COLORS.amber };
};

const getGreeting = (t: (key: string) => string) => {
  const h = new Date().getHours();
  if (h < 12) return t('dashboard.greeting_morning');
  if (h < 18) return t('dashboard.greeting_afternoon');
  return t('dashboard.greeting_evening');
};

const getServiceIcon = (label?: string): string => {
  if (!label) return 'construct-outline';
  const t = label.toLowerCase();
  if (t.includes('bricol'))                             return 'hammer-outline';
  if (t.includes('jardin') || t.includes('pelouse'))    return 'leaf-outline';
  if (t.includes('ménage') || t.includes('nettoyage'))  return 'sparkles-outline';
  if (t.includes('démén') || t.includes('demen'))       return 'cube-outline';
  if (t.includes('peint'))                              return 'color-palette-outline';
  if (t.includes('plomb'))                              return 'water-outline';
  if (t.includes('électr') || t.includes('electr'))     return 'flash-outline';
  if (t.includes('chauff'))                             return 'flame-outline';
  if (t.includes('serrur'))                             return 'key-outline';
  if (t.includes('urgence'))                            return 'build-outline';
  if (t.includes('rénov') || t.includes('renov'))       return 'construct-outline';
  return 'construct-outline';
};

// ============================================================================
// STATUS LED — blinking dot
// ============================================================================

function StatusLed({ color, blink }: { color: string; blink?: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!blink) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 1250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1250, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [blink]);

  return (
    <Animated.View
      style={[
        { width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity },
        blink && color === COLORS.green && Platform.select({
          ios: { shadowColor: COLORS.green, shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
          android: {},
        }),
      ]}
    />
  );
}

// ============================================================================
// RUNWAY CAROUSEL — service category cards
// ============================================================================

const CARD_WIDTH = 128;
const CARD_HEIGHT = 138;
const CARD_GAP = 10;

const SERVICE_CARDS = [
  { key: 'plomberie',   label: 'Plomberie',   icon: 'water-outline',          theme: 'black' as const, led: COLORS.green,  category: 'plomberie',   providers: 8  },
  { key: 'electricite', label: 'Électricité',  icon: 'flash-outline',          theme: 'light' as const, led: COLORS.green,  category: 'electricite', providers: 5  },
  { key: 'serrurerie',  label: 'Serrurerie',   icon: 'key-outline',            theme: 'light' as const, led: COLORS.amber,  category: 'serrurerie',  providers: 2  },
  { key: 'chauffage',   label: 'Chauffage',    icon: 'flame-outline',          theme: 'light' as const, led: COLORS.green,  category: 'chauffage',   providers: 6  },
  { key: 'bricolage',   label: 'Bricolage',    icon: 'hammer-outline',         theme: 'light' as const, led: COLORS.amber,  category: 'bricolage',   providers: 3  },
  { key: 'peinture',    label: 'Peinture',     icon: 'color-palette-outline',  theme: 'light' as const, led: COLORS.red,    category: 'peinture',    providers: 0  },
];

// Phase test : uniquement Plomberie et Serrurerie
const LAUNCH_CARDS = SERVICE_CARDS.filter(c => c.key === 'plomberie' || c.key === 'serrurerie');

function RunwayCarousel({ onPress, theme }: { onPress: (category: string) => void; theme: AppTheme }) {
  const { t } = useTranslation();
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
          <Ionicons name="chevron-forward" size={9} color={theme.textMuted} />
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
              activeOpacity={0.85}
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
                    <Ionicons name={card.icon as any} size={14} color={textColor} />
                  </View>
                  <View style={runway.ledRow}>
                    <StatusLed color={card.led} blink={card.led === COLORS.green} />
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
                    <Ionicons name="arrow-forward" size={8} color={textColor} />
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
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8,
  },
  headerTitle: { fontFamily: FONTS.bebas, fontSize: 15, letterSpacing: 2.4 },
  headerHint: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  headerHintText: { fontFamily: FONTS.mono, fontSize: 10 },

  scrollContent: { paddingHorizontal: 24, gap: CARD_GAP, paddingBottom: 4 },

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
  latestRequest,
  onActiveMissionPress,
  onSearchingPress,
  onLatestPress,
  theme,
}: {
  activeMission: DashboardData['requests'][0] | null;
  searchingMission: DashboardData['requests'][0] | null;
  latestRequest: DashboardData['requests'][0] | null;
  onActiveMissionPress: () => void;
  onSearchingPress: () => void;
  onLatestPress: () => void;
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
    if (!activeMission && !searchingMission) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [activeMission?.id, searchingMission?.id]);

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

  // ── ACCEPTED / ONGOING — active mission island
  if (activeMission) {
    const isOngoing = activeMission.status.toUpperCase() === 'ONGOING';
    return (
      <View style={{ paddingHorizontal: 24, paddingTop: 6 }}>
        <TouchableOpacity
          style={[islandStyles.active, { backgroundColor: theme.heroBg }]}
          onPress={onActiveMissionPress}
          activeOpacity={0.85}
        >
          <View style={islandStyles.pulseWrap}>
            <Animated.View style={[islandStyles.pulseRing, {
              backgroundColor: COLORS.green,
              transform: [{ scale: pulseScale.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
              opacity: pulseOpacity,
            }]} />
            <View style={[islandStyles.pulseDot, { backgroundColor: COLORS.green }]} />
          </View>
          <View style={islandStyles.textWrap}>
            <Text style={[islandStyles.label, { color: theme.heroSubFaint }]}>
              {isOngoing ? 'EN COURS' : `EN ROUTE · ${etaLabel}`}
            </Text>
            <Text style={[islandStyles.mission, { color: theme.heroText }]}>{activeMission.serviceType || activeMission.title}</Text>
            <Text style={[islandStyles.sub, { color: theme.heroSubFaint }]}>{isOngoing ? t('dashboard.mission_ongoing') : t('dashboard.provider_on_way')}</Text>
          </View>
          <View style={[islandStyles.arrow, { borderColor: theme.heroSubFaint }]}>
            <Ionicons name="arrow-forward" size={12} color={theme.heroSub} />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // ── PUBLISHED — searching
  if (searchingMission) {
    return (
      <View style={{ paddingHorizontal: 24, paddingTop: 6 }}>
        <TouchableOpacity
          style={[islandStyles.active, { backgroundColor: theme.heroBg }]}
          onPress={onSearchingPress}
          activeOpacity={0.85}
        >
          <View style={islandStyles.pulseWrap}>
            <Animated.View style={[islandStyles.pulseRing, {
              backgroundColor: COLORS.amber,
              transform: [{ scale: pulseScale.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
              opacity: pulseOpacity,
            }]} />
            <View style={[islandStyles.pulseDot, { backgroundColor: COLORS.amber }]} />
          </View>
          <View style={islandStyles.textWrap}>
            <Text style={[islandStyles.label, { color: theme.heroSubFaint }]}>{t('dashboard.search_in_progress').toUpperCase()}</Text>
            <Text style={[islandStyles.mission, { color: theme.heroText }]}>{searchingMission.serviceType || searchingMission.title}</Text>
            {secondsLeft !== null && (
              <Text style={[islandStyles.sub, { color: theme.heroSubFaint }]}>{fmt(secondsLeft)}</Text>
            )}
          </View>
          <View style={[islandStyles.arrow, { borderColor: theme.heroSubFaint }]}>
            <Ionicons name="arrow-forward" size={12} color={theme.heroSub} />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Empty state
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 6 }}>
      <View style={[islandStyles.empty, { borderColor: theme.borderLight }]}>
        <View style={[islandStyles.emptyIconBox, { borderColor: theme.borderLight }]}>
          <Ionicons name="time-outline" size={13} color={theme.textMuted} />
        </View>
        <Text style={[islandStyles.emptyText, { color: theme.textMuted }]}>
          Les statuts de vos services s'afficheront ici.
        </Text>
      </View>
    </View>
  );
}

const islandStyles = StyleSheet.create({
  active: {
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  pulseWrap: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  pulseDot: { width: 10, height: 10, borderRadius: 5 },
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
    <TouchableOpacity
      style={[actStyles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: theme.borderLight }]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={[actStyles.iconBox, { backgroundColor: theme.surface }]}>
        <Ionicons name={icon as any} size={16} color={theme.text} />
      </View>
      <View style={actStyles.center}>
        <Text style={[actStyles.name, { color: theme.text }]} numberOfLines={1}>
          {serviceName || t('common.service')}
        </Text>
        <Text style={[actStyles.meta, { color: theme.textMuted }]}>
          {date}{request.price ? ` · ${request.price} €` : ''}
        </Text>
      </View>
      <View style={actStyles.right}>
        <View style={[actStyles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[actStyles.badgeText, { color: badgeTextColor }]}>{status.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={13} color={theme.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const actStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  iconBox: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONTS.sansMedium, fontSize: 12, lineHeight: 14 },
  meta: { fontFamily: FONTS.mono, fontSize: 10, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 76, paddingVertical: 3, borderRadius: 20, alignItems: 'center' as const },
  badgeText: { fontFamily: FONTS.mono, fontSize: 11, textAlign: 'center' as const },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const PREVIEW_COUNT = 5;

export default function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { socket, unreadCount, joinRoom, leaveRoom } = useSocket();
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

  const bottomSheetRef = useRef<BottomSheet>(null);

  const invoiceRequestId = selectedRequest?.status?.toUpperCase() === 'DONE' ? selectedRequest?.id : null;
  const { invoice, loading: invoiceLoading } = useInvoice(invoiceRequestId ? Number(invoiceRequestId) : null);

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
  useFocusEffect(useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current > 15000) { // 15s cache
      lastFetchRef.current = now;
      loadDashboard();
    }
  }, [loadDashboard]));
  const onRefresh = () => { setRefreshing(true); loadDashboard(); };

  // ── Navigation ──
  const navigateToMissionView = useCallback((request: any) => {
    const r = request;
    const scheduledFor = r.scheduledFor || r.preferredTimeStart;
    router.push({
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
    joinRoom('user', user.id);

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

    const acceptedIds = new Set<string>();
    const handleAccepted = (d: any) => {
      const reqId = String(d.id || d.requestId);
      if (acceptedIds.has(reqId)) return;
      if (d.clientId && d.clientId !== user?.id) return;
      acceptedIds.add(reqId);
      updateRequestStatus(reqId, 'ACCEPTED');
      if (reqId) {
        api.get(`/requests/${reqId}`)
          .then(res => {
            const req = res?.data || res;
            navigateToMissionView(req);
          })
          .catch(() => {
            router.push({
              pathname: '/request/[id]/missionview',
              params: { id: reqId },
            });
          });
      }
    };
    const handleStarted   = (d: any) => { updateRequestStatus(d.id || d.requestId, 'ONGOING'); };
    const handleCompleted = (d: any) => { updateRequestStatus(d.id || d.requestId, 'DONE');     loadDashboard(); };
    const handleCancelled = (d: any) => { updateRequestStatus(d.id || d.requestId, 'CANCELLED'); loadDashboard(); };
    const handleExpired   = (d: any) => { updateRequestStatus(d.id || d.requestId, 'EXPIRED');   loadDashboard(); };

    socket.on('request:accepted',  handleAccepted);
    socket.on('request:started',   handleStarted);
    socket.on('request:completed', handleCompleted);
    socket.on('request:cancelled', handleCancelled);
    socket.on('request:expired',   handleExpired);
    socket.on('provider:accepted', handleAccepted);

    return () => {
      leaveRoom('user', user.id);
      socket.off('request:accepted',  handleAccepted);
      socket.off('request:started',   handleStarted);
      socket.off('request:completed', handleCompleted);
      socket.off('request:cancelled', handleCancelled);
      socket.off('request:expired',   handleExpired);
      socket.off('provider:accepted', handleAccepted);
    };
  }, [socket, user?.id, router, loadDashboard, navigateToMissionView, joinRoom, leaveRoom]);

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

  const activeMission = useMemo(() =>
    data?.requests?.find(r => ['ACCEPTED', 'ONGOING'].includes(r.status?.toUpperCase())) || null,
    [data]
  );

  const searchingMission = useMemo(
    () => activeMission ? null : (data?.requests?.find(r => r.status?.toUpperCase() === 'PUBLISHED') || null),
    [data, activeMission]
  );

  const ACTIVE_STATUSES = ['PENDING', 'PENDING_PAYMENT', 'PUBLISHED', 'ACCEPTED', 'ONGOING'];
  const latestRequest = useMemo(
    () => (activeMission || searchingMission)
      ? null
      : (data?.requests?.find(r => ACTIVE_STATUSES.includes(r.status?.toUpperCase())) || null),
    [data, activeMission, searchingMission]
  );

  const HIDDEN_STATUSES = ['CANCELLED', 'QUOTE_REFUSED', 'QUOTE_EXPIRED'];
  const DOCUMENT_STATUSES = ['QUOTE_PENDING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'];

  const quoteDocuments = useMemo(
    () => (data?.requests || []).filter(r => DOCUMENT_STATUSES.includes(r.status?.toUpperCase())),
    [data]
  );

  const activityRequests = useMemo(
    () => (data?.requests || []).filter(r =>
      !HIDDEN_STATUSES.includes(r.status?.toUpperCase()) &&
      !DOCUMENT_STATUSES.includes(r.status?.toUpperCase())
    ),
    [data]
  );

  const displayedRequests = useMemo(() => {
    return showAllRequests ? activityRequests : activityRequests.slice(0, PREVIEW_COUNT);
  }, [activityRequests, showAllRequests]);

  const totalCount = activityRequests.length;
  const hasMore = totalCount > PREVIEW_COUNT;

  // ── Guards ──
  if (user?.roles?.includes('PROVIDER')) return <ProviderDashboard />;

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
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
        {/* ── TOP BAR ── */}
        <View style={s.topbar}>
          <View>
            <Text style={[s.greeting, { color: theme.textMuted }]}>{getGreeting(t)}</Text>
            <Text style={[s.name, { color: theme.text }]}>{name.toUpperCase()}</Text>
          </View>
          <View style={s.topbarActions}>
            <TouchableOpacity style={[s.iconBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]} onPress={() => router.push('/notifications')}>
              <Ionicons name="notifications-outline" size={18} color={theme.text} />
              {unreadCount > 0 && (
                <View style={[s.notifDot, { borderColor: theme.bg }]} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[s.iconBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]} onPress={() => router.push('/(tabs)/profile')}>
              <Ionicons name="person-outline" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── RUNWAY CAROUSEL ── */}
        <RunwayCarousel
          theme={theme}
          onPress={(category) =>
            router.push(category
              ? `/request/NewRequestStepper?selectedCategory=${category}`
              : '/request/NewRequestStepper'
            )
          }
        />

        {/* ── CTA BUTTON — accessible au pouce ── */}
        <View style={s.ctaWrap}>
          <TouchableOpacity
            style={[s.ctaBtn, { backgroundColor: theme.accent }]}
            onPress={() => router.push('/request/NewRequestStepper')}
            activeOpacity={0.85}
          >
            <Text style={[s.ctaText, { color: theme.accentText }]}>{t('dashboard.order_service').toUpperCase()}</Text>
            <View style={[s.ctaCircle, { borderColor: theme.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="arrow-forward" size={11} color={theme.accentText} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── MISSION ISLAND ── */}
        <View style={[s.sectionHead, { paddingTop: 22 }]}>
          <Text style={[s.sectionTitle, { color: theme.textMuted }]}>DEMANDE EN COURS</Text>
        </View>

        <MissionIsland
          activeMission={activeMission}
          searchingMission={searchingMission}
          latestRequest={latestRequest}
          onActiveMissionPress={() => activeMission && navigateToMissionView(activeMission)}
          onSearchingPress={() => searchingMission && navigateToSearching(searchingMission)}
          onLatestPress={() => latestRequest && handleRequestPress(latestRequest.id)}
          theme={theme}
        />

        {/* ── ACTIVITÉ RÉCENTE ── */}
        <View style={[s.sectionHead, { paddingTop: 22 }]}>
          <Text style={[s.sectionTitle, { color: theme.textMuted }]}>{t('dashboard.recent_activity').toUpperCase()}</Text>
          <TouchableOpacity
            style={s.sectionAction}
            onPress={onRefresh}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh-outline" size={13} color={theme.textMuted} />
            <Text style={[s.sectionActionText, { color: theme.textMuted }]}>{totalCount || ''}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.activityList}>
          {!data?.requests?.length ? (
            <View style={s.emptyActivity}>
              <View style={[s.emptyActivityIcon, { backgroundColor: theme.surface }]}>
                <Text style={[s.emptyX, { color: theme.textDisabled }]}>✕</Text>
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
                  onPress={() => handleRequestPress(req.id)}
                  isLast={i === displayedRequests.length - 1 && (!hasMore || showAllRequests)}
                  theme={theme}
                />
              ))}
            </>
          )}
        </View>

        {/* See all button */}
        {hasMore && (
          <TouchableOpacity style={s.seeAllBtn} onPress={() => setShowAllRequests(v => !v)} activeOpacity={0.7}>
            <Text style={[s.seeAllText, { color: theme.textMuted }]}>
              {showAllRequests ? t('dashboard.collapse') : 'Voir tout'}
            </Text>
            <Ionicons name={showAllRequests ? 'chevron-up' : 'chevron-down'} size={11} color={theme.textMuted} />
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
                <View style={[s.statusDot, { backgroundColor: getStatusInfo(selectedRequest.status, t).ledColor }]} />
                <Text style={[s.statusBadgeText, { color: theme.textSub }]}>{getStatusInfo(selectedRequest.status, t).label}</Text>
              </View>

              {[
                { icon: 'document-text-outline', val: selectedRequest.description || t('dashboard.no_description') },
                selectedRequest.address && { icon: 'location-outline', val: selectedRequest.address },
                selectedRequest.price    && { icon: 'cash-outline',    val: `${selectedRequest.price} €` },
              ].filter(Boolean).map((row: any, i) => (
                <View key={i} style={s.sheetRow}>
                  <View style={[s.sheetRowIcon, { backgroundColor: theme.surface }]}>
                    <Ionicons name={row.icon} size={14} color={theme.textSub} />
                  </View>
                  <Text style={[s.sheetVal, { color: theme.textSub }]}>{row.val}</Text>
                </View>
              ))}

              {['ACCEPTED', 'ONGOING'].includes(selectedRequest.status?.toUpperCase()) && (
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={() => handleNavigateToMission(selectedRequest)}>
                  <Text style={[s.actionBtnText, { color: theme.accentText }]}>
                    {selectedRequest.status === 'ACCEPTED' ? t('dashboard.track_provider') : t('dashboard.track_mission')}
                  </Text>
                  <Ionicons name="navigate" size={17} color={theme.accentText} />
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
                    <Ionicons name="radio-outline" size={17} color={theme.accentText} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.resendBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
                    onPress={async () => {
                      try { await api.post(`/requests/${selectedRequest.id}/notify`); } catch {}
                    }}
                  >
                    <Ionicons name="refresh-outline" size={15} color={theme.textSub} />
                    <Text style={[s.resendText, { color: theme.textSub }]}>{t('dashboard.resend_providers')}</Text>
                  </TouchableOpacity>
                </>
              )}

              {selectedRequest.status?.toUpperCase() === 'DONE' && (
                <>
                  <View style={[s.doneCard, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />
                    <Text style={[s.doneText, { color: theme.text }]}>{t('dashboard.mission_success')}</Text>
                  </View>
                  {invoice && (
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: theme.accent, marginTop: 10 }]}
                      onPress={() => {
                        bottomSheetRef.current?.close();
                        setTimeout(() => setInvoiceVisible(true), 300);
                      }}
                      activeOpacity={0.78}
                    >
                      <Ionicons name="receipt-outline" size={17} color={theme.accentText} />
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
                  <Ionicons name="card-outline" size={17} color={theme.accentText} />
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
                  <Ionicons name={selectedRequest.status?.toUpperCase() === 'QUOTE_SENT' ? 'document-text-outline' : 'time-outline'} size={17} color={theme.accentText} />
                </TouchableOpacity>
              )}

              {selectedRequest.status?.toUpperCase() === 'QUOTE_ACCEPTED' && (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: theme.accent }]}
                  onPress={() => handleNavigateToMission(selectedRequest)}
                >
                  <Text style={[s.actionBtnText, { color: theme.accentText }]}>Suivre l'intervention</Text>
                  <Ionicons name="navigate" size={17} color={theme.accentText} />
                </TouchableOpacity>
              )}

              {selectedRequest.status?.toUpperCase() === 'EXPIRED' && (
                <>
                  <View style={[s.expiredCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.borderLight }]}>
                    <Ionicons name="time-outline" size={20} color={theme.textSub} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.expiredTitle, { color: theme.text }]}>{t('dashboard.no_provider_found')}</Text>
                      <Text style={[s.expiredSub, { color: theme.textMuted }]}>{t('dashboard.restart_search_sub')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={() => { bottomSheetRef.current?.close(); router.push('/request/NewRequestStepper'); }}>
                    <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.restart_search')}</Text>
                    <Ionicons name="refresh" size={17} color={theme.accentText} />
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
    paddingTop: 14, paddingHorizontal: 24, paddingBottom: 6,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  greeting: {
    fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 3,
  },
  name: { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 0.8, lineHeight: 30 },
  topbarActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute', top: 8, right: 8,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: COLORS.green, borderWidth: 1.5,
  },

  // ── CTA ──
  ctaWrap: { paddingHorizontal: 24, paddingTop: 16 },
  ctaBtn: {
    height: 58, borderRadius: 18,
    paddingLeft: 26, paddingRight: 18,
    flexDirection: 'row', alignItems: 'center',
  },
  ctaText: { fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 1.8, flex: 1 },
  ctaCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Section headers ──
  sectionHead: {
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 0,
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
  },
  sectionTitle: { fontFamily: FONTS.bebas, fontSize: 15, letterSpacing: 2.4 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionActionText: { fontFamily: FONTS.mono, fontSize: 11 },

  // ── Activity list ──
  activityList: { paddingHorizontal: 24 },

  emptyActivity: { padding: 44, alignItems: 'center', gap: 10 },
  emptyActivityIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyX: { fontSize: 22, fontWeight: '900' },
  emptyTitle: { fontFamily: FONTS.sansMedium, fontSize: 15 },
  emptySub: { fontFamily: FONTS.sans, fontSize: 13, textAlign: 'center' },

  // ── See all button ──
  seeAllBtn: {
    marginHorizontal: 24, marginTop: 4,
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
  statusDot: { width: 6, height: 6, borderRadius: 3 },
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
