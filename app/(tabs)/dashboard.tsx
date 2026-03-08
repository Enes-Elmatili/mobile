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
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import ProviderDashboard from '../../app/(tabs)/provider-dashboard';
import { useAppTheme } from '@/hooks/use-app-theme';
import InvoiceSheet from '@/components/sheets/InvoiceSheet';
import { useInvoice } from '@/hooks/useInvoice';

const { width } = Dimensions.get('window');

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
  const map: Record<string, { label: string; color: string; bgColor: string; icon: string; dot: string }> = {
    DONE:            { label: t('dashboard.status_done'),      color: '#111',    bgColor: '#F0F0F0', icon: 'checkmark-circle-outline', dot: '#111' },
    CANCELLED:       { label: t('dashboard.status_cancelled'), color: '#888',    bgColor: '#F5F5F5', icon: 'close-circle-outline',     dot: '#888' },
    ONGOING:         { label: t('dashboard.status_ongoing'),   color: '#111',    bgColor: '#EDEDED', icon: 'time-outline',             dot: '#111' },
    PUBLISHED:       { label: t('dashboard.status_published'), color: '#555',    bgColor: '#F2F2F2', icon: 'radio-outline',            dot: '#555' },
    ACCEPTED:        { label: t('dashboard.status_accepted'),  color: '#111',    bgColor: '#E8E8E8', icon: 'hand-left-outline',        dot: '#111' },
    PENDING_PAYMENT: { label: t('dashboard.status_payment'),   color: '#111',    bgColor: '#EBEBEB', icon: 'card-outline',             dot: '#111' },
    EXPIRED:         { label: t('dashboard.status_expired'),   color: '#ADADAD', bgColor: '#F7F7F7', icon: 'time-outline',             dot: '#CCC' },
  };
  return map[s] || { label: s, color: '#888', bgColor: '#F5F5F5', icon: 'help-circle-outline', dot: '#CCC' };
};

const getGreeting = (t: (key: string) => string) => {
  const h = new Date().getHours();
  if (h < 12) return t('dashboard.greeting_morning');
  if (h < 18) return t('dashboard.greeting_afternoon');
  return t('dashboard.greeting_evening');
};

// ============================================================================
// STATUS HERO CARD
// Remplace les banners "en-tête" par un seul bloc opaque contextuel
// ============================================================================

function StatusHeroCard({
  activeMission,
  searchingMission,
  latestRequest,
  name,
  onActiveMissionPress,
  onSearchingPress,
  onNewRequest,
  onLatestPress,
}: {
  activeMission: DashboardData['requests'][0] | null;
  searchingMission: DashboardData['requests'][0] | null;
  latestRequest: DashboardData['requests'][0] | null;
  name: string;
  onActiveMissionPress: () => void;
  onSearchingPress: () => void;
  onNewRequest: () => void;
  onLatestPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [etaLabel, setEtaLabel] = useState<string>(t('dashboard.loading_eta'));
  const SEARCH_TIMEOUT = 15 * 60;
  const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Pulsing dot for active states
  useEffect(() => {
    if (!searchingMission && !activeMission) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    ).start();
    return () => dotOpacity.stopAnimation();
  }, [searchingMission?.id, activeMission?.id]);

  // Countdown recherche
  useEffect(() => {
    if (!searchingMission) { setSecondsLeft(null); return; }
    const compute = () => searchingMission.expiresAt
      ? Math.max(0, Math.floor((new Date(searchingMission.expiresAt).getTime() - Date.now()) / 1000))
      : SEARCH_TIMEOUT;
    setSecondsLeft(compute());
    const iv = setInterval(() => setSecondsLeft(p => (p !== null && p > 0) ? p - 1 : 0), 1000);
    return () => clearInterval(iv);
  }, [searchingMission?.id]);

  // ETA réel depuis l'API request + Google Directions
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
  const isExpiring = secondsLeft !== null && secondsLeft < 120;

  // ── ACCEPTED — prestataire en route, affiche ETA ──
  if (activeMission && activeMission.status.toUpperCase() === 'ACCEPTED') {
    return (
      <TouchableOpacity style={[hero.strip, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={onActiveMissionPress} activeOpacity={0.85} accessibilityRole="button">
        <Animated.View style={[hero.dot, hero.dotActive, { opacity: dotOpacity }]} />
        <View style={hero.stripContent}>
          <Text style={[hero.stripTitle, { color: theme.textAlt }]} numberOfLines={1}>{etaLabel}</Text>
          <Text style={[hero.stripSub, { color: theme.textMuted }]} numberOfLines={1}>{activeMission.serviceType || activeMission.title}</Text>
        </View>
        <View style={[hero.stripAction, { backgroundColor: theme.accent }]}>
          <Ionicons name="navigate-outline" size={13} color={theme.accentText} />
        </View>
      </TouchableOpacity>
    );
  }

  // ── ONGOING — mission en cours ──
  if (activeMission && activeMission.status.toUpperCase() === 'ONGOING') {
    return (
      <TouchableOpacity style={[hero.strip, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={onActiveMissionPress} activeOpacity={0.85} accessibilityRole="button">
        <Animated.View style={[hero.dot, hero.dotActive, { opacity: dotOpacity }]} />
        <View style={hero.stripContent}>
          <Text style={[hero.stripTitle, { color: theme.textAlt }]} numberOfLines={1}>{t('dashboard.mission_ongoing')}</Text>
          <Text style={[hero.stripSub, { color: theme.textMuted }]} numberOfLines={1}>{activeMission.serviceType || activeMission.title}</Text>
        </View>
        <View style={[hero.stripAction, { backgroundColor: theme.accent }]}>
          <Ionicons name="eye-outline" size={13} color={theme.accentText} />
        </View>
      </TouchableOpacity>
    );
  }

  // ── PUBLISHED — recherche en cours ──
  if (searchingMission) {
    return (
      <TouchableOpacity style={[hero.strip, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={onSearchingPress} activeOpacity={0.85} accessibilityRole="button">
        <Animated.View style={[hero.dot, hero.dotSearching, { opacity: dotOpacity }]} />
        <View style={hero.stripContent}>
          <Text style={[hero.stripTitle, { color: theme.textAlt }]} numberOfLines={1}>{t('dashboard.search_in_progress')}</Text>
          <Text style={[hero.stripSub, { color: theme.textMuted }]} numberOfLines={1}>{searchingMission.serviceType || searchingMission.title}</Text>
        </View>
        {secondsLeft !== null && (
          <View style={[hero.timerPill, isExpiring && hero.timerPillUrgent]}>
            <Text style={[hero.timerText, isExpiring && hero.timerTextUrgent]}>{fmt(secondsLeft)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // ── Idle — dernière request ou aucune ──
  if (latestRequest) {
    const latestStatus = getStatusInfo(latestRequest.status, t);
    return (
      <TouchableOpacity style={[hero.strip, hero.stripIdle, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={onLatestPress} activeOpacity={0.85} accessibilityRole="button">
        <View style={[hero.dot, { backgroundColor: latestStatus.dot }]} />
        <View style={hero.stripContent}>
          <Text style={[hero.stripTitle, { color: theme.textSub }]} numberOfLines={1}>{latestStatus.label} — {latestRequest.serviceType || latestRequest.title}</Text>
          <Text style={[hero.stripSub, { color: theme.textMuted }]} numberOfLines={1}>
            {new Date(latestRequest.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            {latestRequest.price ? ` · ${latestRequest.price} €` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
      </TouchableOpacity>
    );
  }

  // ── Aucune demande ──
  return (
    <View style={[hero.strip, hero.stripEmpty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Ionicons name="remove-circle-outline" size={16} color={theme.textMuted} />
      <Text style={[hero.emptyText, { color: theme.textMuted }]}>{t('dashboard.no_active_request')}</Text>
    </View>
  );
}

const hero = StyleSheet.create({
  strip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1, borderColor: '#F0F0F0',
    backgroundColor: '#FFF', width: '100%', marginBottom: 16,
  },
  stripIdle: { opacity: 0.8 },
  stripEmpty: { justifyContent: 'center', opacity: 0.6 },
  stripContent: { flex: 1, minWidth: 0, gap: 2 },
  stripTitle: { fontSize: 13, fontWeight: '700', color: '#111' },
  stripSub: { fontSize: 11, fontWeight: '500', color: '#ADADAD' },
  stripAction: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
  },

  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CCC', flexShrink: 0 },
  dotActive: { backgroundColor: '#111' },
  dotSearching: { backgroundColor: '#888' },

  timerPill: {
    backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10,
  },
  timerPillUrgent: { backgroundColor: '#111' },
  timerText: { fontSize: 11, fontWeight: '800', color: '#555' },
  timerTextUrgent: { color: '#FFF' },

  emptyText: { fontSize: 12, fontWeight: '600', color: '#ADADAD' },
});

// ============================================================================
// QUICK ACTIONS ROW
// ============================================================================

const getQuickActions = (t: (key: string) => string) => [
  { icon: 'hammer-outline',   label: t('dashboard.cat_bricolage'),    category: 'bricolage'    },
  { icon: 'leaf-outline',     label: t('dashboard.cat_jardinage'),    category: 'jardinage'    },
  { icon: 'sparkles-outline', label: t('dashboard.cat_menage'),       category: 'menage'       },
  { icon: 'car-outline',      label: t('dashboard.cat_demenagement'), category: 'demenagement' },
  { icon: 'brush-outline',    label: t('dashboard.cat_peinture'),     category: 'peinture'     },
  { icon: 'grid-outline',     label: t('dashboard.cat_all'),          category: ''             },
];

function QuickActions({ onPress }: { onPress: (category: string) => void }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const actions = getQuickActions(t);
  return (
    <View style={qa.wrap}>
      <Text style={[qa.title, { color: theme.textAlt }]}>{t('dashboard.services')}</Text>
      <FlatList
        data={actions}
        keyExtractor={(_, i) => String(i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={qa.list}
        renderItem={({ item, index }) => {
          const isLast = index === actions.length - 1;
          return (
            <TouchableOpacity
              style={qa.item}
              onPress={() => onPress(item.category)}
              activeOpacity={0.72}
              accessibilityLabel={item.label}
              accessibilityRole="button"
            >
              <View style={[qa.circle, !isLast && { backgroundColor: theme.surface, borderColor: theme.borderLight }, isLast && qa.circleLast]}>
                <Ionicons name={item.icon as any} size={18} color={isLast ? '#FFF' : theme.textAlt} />
              </View>
              <Text style={[qa.label, { color: theme.textSub }]} numberOfLines={1}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const qa = StyleSheet.create({
  wrap:  { marginBottom: 32, width: '100%' },
  title: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 10, paddingHorizontal: 2 },
  list:  { gap: 6, paddingBottom: 2 },
  item:  { alignItems: 'center', gap: 6, width: 62 },
  circle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#EFEFEF',
  },
  circleLast: { backgroundColor: '#111', borderColor: '#111' },
  label: { fontSize: 10, fontWeight: '600', color: '#888', textAlign: 'center', width: 62 },
});

// ============================================================================
// AVAILABILITY BAR — "Est-ce le bon moment pour commander ?"
// Remplace les stats de dépenses par des infos de disponibilité en temps réel
// ============================================================================

// Static placeholder — to be replaced with a real /availability endpoint
function useAvailability() {
  return { providers: 12, avgMinutes: 25, demand: 'standard' as 'standard' | 'high' };
}

function AvailabilityBar() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { providers, avgMinutes, demand } = useAvailability();
  const isHigh = demand === 'high';

  const items = [
    {
      icon: 'people-outline' as const,
      value: `${providers}`,
      label: t('dashboard.available'),
      sub: t('dashboard.nearby'),
    },
    {
      icon: 'timer-outline' as const,
      value: `~${avgMinutes} min`,
      label: t('dashboard.fixed_in'),
      sub: t('dashboard.avg_time'),
    },
    {
      icon: isHigh ? 'trending-up-outline' as const : 'checkmark-circle-outline' as const,
      value: isHigh ? t('dashboard.high_demand') : t('dashboard.standard'),
      label: t('dashboard.price'),
      sub: isHigh ? t('dashboard.surge_pricing') : t('dashboard.normal_pricing'),
      accent: isHigh,
    },
  ];

  return (
    <View style={[sb.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <View style={sb.item}>
            <View style={[sb.iconWrap, { backgroundColor: theme.surface }, it.accent && sb.iconWrapAccent]}>
              <Ionicons name={it.icon} size={14} color={it.accent ? '#111' : '#888'} />
            </View>
            <Text style={[sb.value, { color: theme.textAlt }, it.accent && sb.valueAccent]}>{it.value}</Text>
            <Text style={[sb.label, { color: theme.textMuted }]}>{it.sub}</Text>
          </View>
          {i < items.length - 1 && <View style={[sb.sep, { backgroundColor: theme.border }]} />}
        </React.Fragment>
      ))}
    </View>
  );
}

const sb = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 18, padding: 16,
    marginBottom: 28, width: '100%',
    borderWidth: 1, borderColor: '#F0F0F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10 },
      android: { elevation: 1 },
    }),
  },
  item:      { flex: 1, alignItems: 'center', gap: 4 },
  sep:       { width: 1, height: 36, backgroundColor: '#F0F0F0' },
  iconWrap:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  iconWrapAccent: { backgroundColor: '#EBEBEB' },
  value:     { fontSize: 14, fontWeight: '900', color: '#111', letterSpacing: -0.3 },
  valueAccent: { color: '#111' },
  label:     { fontSize: 10, fontWeight: '500', color: '#ADADAD', letterSpacing: 0.1 },
});

// ============================================================================
// SERVICE ROW — monochrome, hiérarchie claire
// ============================================================================

// Guess service icon from serviceType / category name
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
  if (t.includes('urgence'))                            return 'build-outline';
  if (t.includes('rénov') || t.includes('renov'))       return 'construct-outline';
  return 'construct-outline';
};

function ServiceRow({
  request,
  onPress,
  isLast,
}: {
  request: DashboardData['requests'][0];
  onPress: () => void;
  isLast: boolean;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const status   = getStatusInfo(request.status, t);
  const isActive = ['ACCEPTED', 'ONGOING'].includes(request.status?.toUpperCase());
  const serviceName = request.serviceType || request.category?.name || request.title;
  const icon     = getServiceIcon(serviceName);
  const date     = new Date(request.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <>
      <TouchableOpacity style={sr.row} onPress={onPress} activeOpacity={0.65} accessibilityLabel={serviceName || t('common.service')} accessibilityRole="button">

        {/* Icône service */}
        <View style={[sr.iconBox, !isActive && { backgroundColor: theme.surface }, isActive && sr.iconBoxActive]}>
          <Ionicons name={icon as any} size={16} color={isActive ? '#FFF' : '#555'} />
        </View>

        {/* Centre : titre + date */}
        <View style={sr.mid}>
          <Text style={[sr.title, { color: theme.textAlt }]} numberOfLines={1}>{serviceName || t('common.service')}</Text>
          <Text style={[sr.meta, { color: theme.textMuted }]}>{date}{request.price ? ` · ${request.price} €` : ''}</Text>
        </View>

        {/* Droite : statut pill + chevron */}
        <View style={sr.right}>
          {isActive
            ? <View style={sr.activeBadge}><Text style={sr.activeBadgeText}>{status.label}</Text></View>
            : <Text style={[sr.statusText, { color: theme.textMuted }]}>{status.label}</Text>
          }
          <Ionicons name="chevron-forward" size={13} color="#D8D8D8" />
        </View>

      </TouchableOpacity>
      {!isLast && <View style={[sr.sep, { backgroundColor: theme.border }]} />}
    </>
  );
}

const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  iconBox: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconBoxActive: { backgroundColor: '#111' },
  mid:   { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 13, fontWeight: '700', color: '#111', flexShrink: 1 },
  meta:  { fontSize: 11, color: '#C0C0C0', fontWeight: '500' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  activeBadge: {
    backgroundColor: '#111', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  activeBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#C0C0C0' },
  sep: { height: 1, backgroundColor: '#F7F7F7', marginLeft: 66 },
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

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [invoiceVisible, setInvoiceVisible] = useState(false);
  const theme = useAppTheme();

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '85%'], []);

  // Invoice hook — fetches invoice for selected DONE request
  const invoiceRequestId = selectedRequest?.status?.toUpperCase() === 'DONE' ? selectedRequest?.id : null;
  const { invoice, loading: invoiceLoading } = useInvoice(invoiceRequestId ? Number(invoiceRequestId) : null);

  // ── Data ──
  const loadDashboard = useCallback(async () => {
    try {
      const response = await api.get('/client/dashboard');
      setData(response.data || response);
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadDashboard(); }, [loadDashboard]));
  const onRefresh = () => { setRefreshing(true); loadDashboard(); };

  // ── Navigation vers MissionView — centralisée, déclarée avant le socket ──
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

  // ── Navigation vers MissionView en phase SEARCHING (PUBLISHED) ──
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

    // Deduplicate: prevent double-fire if both request:accepted and provider:accepted arrive
    const acceptedIds = new Set<string>();
    const handleAccepted  = (d: any) => {
      const reqId = String(d.id || d.requestId);
      if (acceptedIds.has(reqId)) return; // already handled
      acceptedIds.add(reqId);

      updateRequestStatus(reqId, 'ACCEPTED');
      // Navigate to missionview — no need to refetch dashboard, optimistic update is enough
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
    // Si la request locale est déjà PUBLISHED, on va directement sur MissionView
    const localReq = data?.requests?.find(r => String(r.id) === String(requestId));
    if (localReq?.status?.toUpperCase() === 'PUBLISHED') {
      navigateToSearching(localReq);
      return;
    }
    // Si ACCEPTED ou ONGOING en local, navigation directe sans bottom sheet
    if (localReq && ['ACCEPTED', 'ONGOING'].includes(localReq.status?.toUpperCase())) {
      navigateToMissionView(localReq);
      return;
    }

    setLoadingDetails(true);
    bottomSheetRef.current?.expand();
    try {
      const details = await api.get(`/requests/${requestId}`);
      const req = details.request || details.data || details;
      // Double-check après fetch — au cas où le statut aurait changé
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
      console.error('Error loading request details:', error);
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

  // Dernière request non-terminale (hors active/searching) pour l'état idle du hero card
  // Les statuts terminaux (DONE, CANCELLED, EXPIRED) ne comptent pas comme "en cours"
  const TERMINAL_STATUSES = ['DONE', 'CANCELLED', 'EXPIRED'];
  const latestRequest = useMemo(
    () => (activeMission || searchingMission)
      ? null
      : (data?.requests?.find(r => !TERMINAL_STATUSES.includes(r.status?.toUpperCase())) || null),
    [data, activeMission, searchingMission]
  );

  const displayedRequests = useMemo(() => {
    const all = data?.requests || [];
    return showAllRequests ? all : all.slice(0, PREVIEW_COUNT);
  }, [data, showAllRequests]);

  const totalCount = data?.requests?.length || 0;
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
  const city = data?.me?.city || 'Bruxelles';

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header compact — une seule ligne ── */}
        <View style={s.header}>
          <View style={s.headerNameRow}>
            <Text style={[s.greeting, { color: theme.textMuted }]}>{getGreeting(t)}, </Text>
            <Text style={[s.name, { color: theme.textAlt }]}>{name}</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity style={[s.iconBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]} onPress={() => router.push('/notifications')} accessibilityLabel={t('common.notifications')} accessibilityRole="button">
              <Ionicons name="notifications-outline" size={18} color={theme.textAlt} />
              {unreadCount > 0 && (
                <View style={[s.notifBadge, { backgroundColor: theme.accent, borderColor: theme.bg }]}>
                  <Text style={[s.notifBadgeText, { color: theme.accentText }]}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[s.iconBtn, { backgroundColor: theme.cardBg, borderColor: theme.border }]} onPress={() => router.push('/(tabs)/profile')} accessibilityLabel={t('profile.title')} accessibilityRole="button">
              <Ionicons name="person-outline" size={18} color={theme.textAlt} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── CTA principale — toujours visible, star de l'écran vide ── */}
        {!activeMission && !searchingMission && (
          <TouchableOpacity
            style={[s.mainCTA, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            onPress={() => router.push('/request/NewRequestStepper')}
            activeOpacity={0.85}
            accessibilityLabel={t('dashboard.order_service')}
            accessibilityRole="button"
          >
            <View style={[s.mainCTASearchIcon, { backgroundColor: theme.surface }]}>
              <Ionicons name="add" size={16} color={theme.textAlt} />
            </View>
            <Text style={[s.mainCTATitle, { color: theme.textAlt }]}>{t('dashboard.order_service')}</Text>
            <View style={[s.mainCTABtn, { backgroundColor: theme.surface }]}>
              <Ionicons name="arrow-forward" size={14} color={theme.textSub} />
            </View>
          </TouchableOpacity>
        )}

        {/* ── Quick Actions — scroll horizontal, catégorie pré-remplie ── */}
        <QuickActions onPress={(category) =>
          router.push(category
            ? `/request/NewRequestStepper?category=${category}`
            : '/request/NewRequestStepper'
          )
        } />

        {/* ── Status Hero Card — sous le carrousel de services ── */}
        <StatusHeroCard
          activeMission={activeMission}
          searchingMission={searchingMission}
          latestRequest={latestRequest}
          name={name}
          onActiveMissionPress={() => activeMission && navigateToMissionView(activeMission)}
          onSearchingPress={() => {
            if (!searchingMission) return;
            navigateToSearching(searchingMission);
          }}
          onNewRequest={() => router.push('/request/NewRequestStepper')}
          onLatestPress={() => latestRequest && handleRequestPress(latestRequest.id)}
        />

        {/* ── Mes missions ── */}
        <View style={s.sectionRow}>
          <Text style={[s.sectionTitle, { color: theme.textAlt }]}>
            {t('dashboard.recent_activity')}
            {totalCount > 0 && <Text style={[s.sectionCount, { color: theme.textMuted }]}> · {totalCount}</Text>}
          </Text>
          <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t('common.refresh')} accessibilityRole="button">
            <Ionicons name="refresh-outline" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={[s.listCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          {!data?.requests?.length ? (
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
                <Text style={s.emptyX}>✕</Text>
              </View>
              <Text style={[s.emptyTitle, { color: theme.text }]}>{t('dashboard.no_missions')}</Text>
              <Text style={[s.emptySub, { color: theme.textMuted }]}>{t('dashboard.missions_appear_here')}</Text>
            </View>
          ) : (
            <>
              {displayedRequests.map((req, i) => (
                <ServiceRow
                  key={req.id}
                  request={req}
                  onPress={() => handleRequestPress(req.id)}
                  isLast={i === displayedRequests.length - 1 && (!hasMore || showAllRequests)}
                />
              ))}
              {hasMore && (
                <TouchableOpacity
                  style={[s.seeMoreBtn, { borderTopColor: theme.border }]}
                  onPress={() => setShowAllRequests(v => !v)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Text style={[s.seeMoreText, { color: theme.textMuted }]}>
                    {showAllRequests ? t('dashboard.collapse') : t('dashboard.see_all_more', { count: totalCount - PREVIEW_COUNT })}
                  </Text>
                  <Ionicons name={showAllRequests ? 'chevron-up' : 'chevron-down'} size={14} color="#ADADAD" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

      </ScrollView>

      {/* ── Bottom Sheet détail ── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={[s.sheetBg, { backgroundColor: theme.cardBg }]}
        handleIndicatorStyle={s.sheetIndicator}
      >
        <BottomSheetView style={s.sheet}>
          {loadingDetails ? (
            <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }} />
          ) : selectedRequest ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[s.sheetTitle, { color: theme.textAlt }]}>{selectedRequest.title || selectedRequest.serviceType}</Text>

              {/* Status badge */}
              <View style={[s.statusBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[s.statusDot, { backgroundColor: getStatusInfo(selectedRequest.status, t).dot }]} />
                <Text style={[s.statusBadgeText, { color: theme.textSub }]}>{getStatusInfo(selectedRequest.status, t).label}</Text>
              </View>

              {/* Infos */}
              {[
                { icon: 'document-text-outline', val: selectedRequest.description || t('dashboard.no_description') },
                selectedRequest.address && { icon: 'location-outline', val: selectedRequest.address },
                selectedRequest.price    && { icon: 'cash-outline',    val: `${selectedRequest.price} €` },
              ].filter(Boolean).map((row: any, i) => (
                <View key={i} style={s.sheetRow}>
                  <View style={[s.sheetRowIcon, { backgroundColor: theme.surface }]}>
                    <Ionicons name={row.icon} size={14} color="#888" />
                  </View>
                  <Text style={[s.sheetVal, { color: theme.textSub }]}>{row.val}</Text>
                </View>
              ))}

              {/* CTA contextuelle — ACCEPTED / ONGOING */}
              {['ACCEPTED', 'ONGOING'].includes(selectedRequest.status?.toUpperCase()) && (
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={() => handleNavigateToMission(selectedRequest)} accessibilityRole="button">
                  <Text style={[s.actionBtnText, { color: theme.accentText }]}>
                    {selectedRequest.status === 'ACCEPTED' ? t('dashboard.track_provider') : t('dashboard.track_mission')}
                  </Text>
                  <Ionicons name="navigate" size={17} color="#FFF" />
                </TouchableOpacity>
              )}

              {/* CTA contextuelle — PUBLISHED (recherche en cours) */}
              {selectedRequest.status?.toUpperCase() === 'PUBLISHED' && (
                <>
                  {/* Rejoindre l'écran de recherche */}
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: theme.accent }]}
                    onPress={() => {
                      bottomSheetRef.current?.close();
                      navigateToSearching(selectedRequest);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.track_search')}</Text>
                    <Ionicons name="radio-outline" size={17} color="#FFF" />
                  </TouchableOpacity>

                  {/* Relancer manuellement les providers */}
                  <TouchableOpacity
                    style={[s.resendBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    accessibilityRole="button"
                    onPress={async () => {
                      try {
                        await api.post(`/requests/${selectedRequest.id}/notify`);
                      } catch {}
                    }}
                  >
                    <Ionicons name="refresh-outline" size={15} color={theme.textSub} />
                    <Text style={[s.resendText, { color: theme.textSub }]}>{t('dashboard.resend_providers')}</Text>
                  </TouchableOpacity>
                </>
              )}

              {selectedRequest.status?.toUpperCase() === 'DONE' && (
                <>
                  <View style={[s.doneCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                    <Text style={[s.doneText, { color: theme.textAlt }]}>{t('dashboard.mission_success')}</Text>
                  </View>
                  {invoice && (
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: theme.accent, marginTop: 10 }]}
                      onPress={() => {
                        bottomSheetRef.current?.close();
                        setTimeout(() => setInvoiceVisible(true), 300);
                      }}
                      activeOpacity={0.78}
                      accessibilityRole="button"
                    >
                      <Ionicons name="receipt-outline" size={17} color={theme.accentText} />
                      <Text style={[s.actionBtnText, { color: theme.accentText }]}>Voir la facture</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {selectedRequest.status?.toUpperCase() === 'EXPIRED' && (
                <>
                  <View style={[s.expiredCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                    <Ionicons name="time-outline" size={20} color="#888" />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.expiredTitle, { color: theme.text }]}>{t('dashboard.no_provider_found')}</Text>
                      <Text style={[s.expiredSub, { color: theme.textMuted }]}>{t('dashboard.restart_search_sub')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.accent }]} onPress={() => { bottomSheetRef.current?.close(); router.push('/request/NewRequestStepper'); }} accessibilityRole="button">
                    <Text style={[s.actionBtnText, { color: theme.accentText }]}>{t('dashboard.restart_search')}</Text>
                    <Ionicons name="refresh" size={17} color="#FFF" />
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          ) : null}
        </BottomSheetView>
      </BottomSheet>

      {/* ── Invoice Sheet ── */}
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

// ── Explore CTA styles ────────────────────────────────────────────────────────

const cta = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 18, padding: 14, marginBottom: 18,
    borderWidth: 1, borderColor: '#F0F0F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: '#111' },
  sub:   { fontSize: 12, color: '#ADADAD', marginTop: 2, fontWeight: '500' },
  arrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
});

// ── Main styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32, alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16, width: '100%',
  },
  headerNameRow: { flexDirection: 'row', alignItems: 'baseline' },
  greeting: { fontSize: 14, fontWeight: '400', color: '#ADADAD' },
  name:     { fontSize: 14, fontWeight: '800', color: '#111' },
  headerRight: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#F0F0F0',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#F5F5F5',
  },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },

  mainCTA: {
    backgroundColor: '#FFF',
    borderRadius: 18, height: 64, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 20, alignSelf: 'stretch',
    borderWidth: 1, borderColor: '#F0F0F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  mainCTASearchIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  mainCTATitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111' },
  mainCTABtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },

  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8, paddingHorizontal: 2, width: '100%',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  sectionCount: { fontSize: 14, fontWeight: '600', color: '#ADADAD' },

  listCard: {
    backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#EFEFEF', width: '100%',

    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10 },
      android: { elevation: 1 },
    }),
  },

  seeMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#F5F5F5',
  },
  seeMoreText: { fontSize: 13, fontWeight: '700', color: '#ADADAD' },

  empty:      { padding: 44, alignItems: 'center', gap: 10 },
  emptyIcon:  { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  emptyX:     { fontSize: 22, fontWeight: '900', color: '#D0D0D0' },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#374151' },
  emptySub:   { fontSize: 13, color: '#ADADAD', textAlign: 'center' },

  // Bottom sheet
  sheetBg:        { backgroundColor: '#FFF', borderRadius: 28 },
  sheetIndicator: { backgroundColor: '#E8E8E8', width: 36 },
  sheet: { flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 },

  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#111', marginBottom: 10, letterSpacing: -0.5 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, marginBottom: 20,
    borderWidth: 1, borderColor: '#EBEBEB',
  },
  statusDot:       { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#555' },

  sheetRow:     { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  sheetRowIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  sheetVal:     { flex: 1, fontSize: 14, color: '#555', lineHeight: 21, paddingTop: 5 },

  actionBtn: {
    backgroundColor: '#111', flexDirection: 'row', height: 54,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 18,
  },
  actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  // Bouton secondaire "Relancer les prestataires"
  resendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, marginTop: 12, paddingVertical: 12,
    borderRadius: 14, backgroundColor: '#F5F5F5',
    borderWidth: 1, borderColor: '#EBEBEB',
  },
  resendText: { fontSize: 13, fontWeight: '600', color: '#555' },

  doneCard: {
    backgroundColor: '#F5F5F5', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18,
    borderWidth: 1, borderColor: '#EBEBEB',
  },
  doneText: { color: '#111', fontWeight: '700', fontSize: 14 },

  expiredCard: {
    backgroundColor: '#F7F7F7', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 18,
    borderWidth: 1, borderColor: '#EBEBEB',
  },
  expiredTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 4 },
  expiredSub:   { fontSize: 13, color: '#9CA3AF', lineHeight: 19 },
});