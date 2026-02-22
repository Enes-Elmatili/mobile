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
  Platform,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../lib/auth/AuthContext';
import { useSocket } from '../../lib/SocketContext';
import { api } from '../../lib/api';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import ProviderDashboard from '../../app/(tabs)/provider-dashboard';

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
    status: string;
    description?: string;
    price?: number;
    createdAt: string;
    expiresAt?: string;
  }[];
}

// ============================================================================
// UTILS
// ============================================================================

const getStatusInfo = (status: string) => {
  const s = (status || 'PENDING').toUpperCase();
  const map: Record<string, { label: string; color: string; bgColor: string; icon: string; dot: string }> = {
    DONE:            { label: 'Terminé',   color: '#111',    bgColor: '#F0F0F0', icon: 'checkmark-circle-outline', dot: '#111' },
    CANCELLED:       { label: 'Annulé',    color: '#888',    bgColor: '#F5F5F5', icon: 'close-circle-outline',     dot: '#888' },
    ONGOING:         { label: 'En cours',  color: '#111',    bgColor: '#EDEDED', icon: 'time-outline',             dot: '#111' },
    PUBLISHED:       { label: 'Recherche', color: '#555',    bgColor: '#F2F2F2', icon: 'radio-outline',            dot: '#555' },
    ACCEPTED:        { label: 'Accepté',   color: '#111',    bgColor: '#E8E8E8', icon: 'hand-left-outline',        dot: '#111' },
    PENDING_PAYMENT: { label: 'Paiement',  color: '#111',    bgColor: '#EBEBEB', icon: 'card-outline',             dot: '#111' },
    EXPIRED:         { label: 'Expiré',    color: '#ADADAD', bgColor: '#F7F7F7', icon: 'time-outline',             dot: '#CCC' },
  };
  return map[s] || { label: s, color: '#888', bgColor: '#F5F5F5', icon: 'help-circle-outline', dot: '#CCC' };
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
};

// ============================================================================
// STATUS HERO CARD
// Remplace les banners "en-tête" par un seul bloc opaque contextuel
// ============================================================================

function StatusHeroCard({
  activeMission,
  searchingMission,
  name,
  onActiveMissionPress,
  onSearchingPress,
  onNewRequest,
}: {
  activeMission: DashboardData['requests'][0] | null;
  searchingMission: DashboardData['requests'][0] | null;
  name: string;
  onActiveMissionPress: () => void;
  onSearchingPress: () => void;
  onNewRequest: () => void;
}) {
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const [secondsLeft, setSecondsLeft]  = useState<number | null>(null);
  // ETA simulé pour la mission acceptée (8 min par défaut — à brancher sur l'API tracking)
  const [etaSeconds, setEtaSeconds]    = useState<number>(8 * 60);
  const SEARCH_TIMEOUT = 15 * 60;

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

  // ETA countdown pour mission ACCEPTED
  useEffect(() => {
    if (!activeMission || activeMission.status.toUpperCase() !== 'ACCEPTED') return;
    const iv = setInterval(() => setEtaSeconds(p => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, [activeMission?.id]);

  const fmt      = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const fmtEta   = (s: number) => {
    const m = Math.floor(s / 60);
    return m <= 0 ? 'Arrivée imminente' : `Arrivée dans ${m} min`;
  };
  const isExpiring = secondsLeft !== null && secondsLeft < 120;

  // ── État : mission active (ACCEPTED / ONGOING) — îlot fin, focus ETA ──
  if (activeMission) {
    const isAccepted = activeMission.status.toUpperCase() === 'ACCEPTED';
    return (
      <TouchableOpacity style={hero.card} onPress={onActiveMissionPress} activeOpacity={0.92}>
        {/* Ligne unique : dot • ETA dynamique • pill Suivre */}
        <View style={hero.slimRow}>
          <View style={hero.liveRow}>
            <Animated.View style={[hero.liveDot, { opacity: dotOpacity }]} />
          </View>
          <Text style={hero.etaText} numberOfLines={1}>
            {isAccepted ? fmtEta(etaSeconds) : `${activeMission.title}`}
          </Text>
          <View style={hero.followPill}>
            <Text style={hero.followText}>Suivre</Text>
            <Ionicons name="arrow-forward" size={11} color="#FFF" />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ── État : recherche en cours (PUBLISHED) ──
  if (searchingMission) {
    return (
      <TouchableOpacity style={[hero.card, hero.cardSearch]} onPress={onSearchingPress} activeOpacity={0.92}>
        <View style={hero.topRow}>
          <View style={hero.liveRow}>
            <Animated.View style={[hero.liveDot, hero.liveDotSearch, { opacity: dotOpacity }]} />
            <Text style={[hero.liveLabel, hero.liveLabelSearch]}>Recherche en cours</Text>
          </View>
          {secondsLeft !== null && (
            <View style={[hero.timerPill, isExpiring && hero.timerPillUrgent]}>
              <Ionicons name="time-outline" size={11} color={isExpiring ? '#FFF' : '#555'} />
              <Text style={[hero.timerText, isExpiring && hero.timerTextUrgent]}>{fmt(secondsLeft)}</Text>
            </View>
          )}
        </View>
        <Text style={[hero.missionTitle, hero.missionTitleSearch]} numberOfLines={2}>{searchingMission.title}</Text>
        <Text style={[hero.missionSub, hero.missionSubSearch]}>Nous cherchons le meilleur prestataire disponible.</Text>
        <View style={hero.xWatermark}><Text style={[hero.xText, hero.xTextSearch]}>✕</Text></View>
      </TouchableOpacity>
    );
  }

  // ── État : calme — rien à afficher ──
  return null;
}

const hero = StyleSheet.create({
  card: {
    backgroundColor: '#111',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,       // ~44px hauteur totale — discret comme Dynamic Island
    marginBottom: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
      android: { elevation: 5 },
    }),
  },
  cardSearch: { backgroundColor: '#F7F7F7', borderWidth: 1, borderColor: '#E8E8E8' },
  cardIdle:   { backgroundColor: '#F7F7F7', borderWidth: 1, borderColor: '#EBEBEB' },

  // ── Îlot fin (mission ACCEPTED / ONGOING) — hauteur réduite ──
  slimRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 0, // le padding du card fait ~44px de hauteur totale
  },
  etaText: {
    flex: 1, fontSize: 14, fontWeight: '700',
    color: '#FFF', letterSpacing: -0.2,
  },

  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  liveRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFF' },
  liveDotSearch: { backgroundColor: '#555' },
  liveLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, textTransform: 'uppercase' },
  liveLabelSearch: { color: '#888' },

  followPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  followText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EBEBEB', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0',
  },
  timerPillUrgent: { backgroundColor: '#111', borderColor: '#111' },
  timerText:       { fontSize: 11, fontWeight: '800', color: '#555' },
  timerTextUrgent: { color: '#FFF' },

  missionTitle:       { fontSize: 22, fontWeight: '900', color: '#FFF', lineHeight: 28, letterSpacing: -0.5, marginBottom: 6 },
  missionTitleSearch: { color: '#111' },
  missionSub:         { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.4)', lineHeight: 19 },
  missionSubSearch:   { color: '#9CA3AF' },



  // X watermark (identity signature)
  xWatermark: { position: 'absolute', right: 16, bottom: 12 },
  xText:      { fontSize: 80, fontWeight: '900', color: 'rgba(255,255,255,0.04)', lineHeight: 80 },
  xTextSearch:{ color: 'rgba(0,0,0,0.04)' },
});

// ============================================================================
// QUICK ACTIONS ROW
// ============================================================================

const QUICK_ACTIONS = [
  { icon: 'hammer-outline',   label: 'Bricol.',   category: 'bricolage'    },
  { icon: 'leaf-outline',     label: 'Jardin',    category: 'jardinage'    },
  { icon: 'sparkles-outline', label: 'Ménage',    category: 'menage'       },
  { icon: 'car-outline',      label: 'Déménag.',  category: 'demenagement' },
  { icon: 'brush-outline',    label: 'Peinture',  category: 'peinture'     },
  { icon: 'grid-outline',     label: 'Tout voir', category: ''             },
];

function QuickActions({ onPress }: { onPress: (category: string) => void }) {
  return (
    <View style={qa.wrap}>
      <Text style={qa.title}>Services</Text>
      <FlatList
        data={QUICK_ACTIONS}
        keyExtractor={(_, i) => String(i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={qa.list}
        renderItem={({ item, index }) => {
          const isLast = index === QUICK_ACTIONS.length - 1;
          return (
            <TouchableOpacity
              style={qa.item}
              onPress={() => onPress(item.category)}
              activeOpacity={0.72}
            >
              <View style={[qa.circle, isLast && qa.circleLast]}>
                <Ionicons name={item.icon as any} size={18} color={isLast ? '#FFF' : '#111'} />
              </View>
              <Text style={qa.label} numberOfLines={1}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const qa = StyleSheet.create({
  wrap:  { marginBottom: 18 },
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

// Simule des données live — à brancher sur un endpoint /availability
function useAvailability() {
  const [data, setData] = useState({ providers: 12, avgMinutes: 25, demand: 'standard' as 'standard' | 'high' });
  useEffect(() => {
    // Légère variation aléatoire pour simuler le temps réel
    const iv = setInterval(() => {
      setData(prev => ({
        providers:  Math.max(4, prev.providers  + Math.floor(Math.random() * 3) - 1),
        avgMinutes: Math.max(15, prev.avgMinutes + Math.floor(Math.random() * 5) - 2),
        demand:     Math.random() > 0.8 ? 'high' : 'standard',
      }));
    }, 30_000);
    return () => clearInterval(iv);
  }, []);
  return data;
}

function AvailabilityBar() {
  const { providers, avgMinutes, demand } = useAvailability();
  const isHigh = demand === 'high';

  const items = [
    {
      icon: 'people-outline' as const,
      value: `${providers}`,
      label: 'Disponibles',
      sub: 'à proximité',
    },
    {
      icon: 'timer-outline' as const,
      value: `~${avgMinutes} min`,
      label: 'Fixé en',
      sub: 'temps moyen',
    },
    {
      icon: isHigh ? 'trending-up-outline' as const : 'checkmark-circle-outline' as const,
      value: isHigh ? 'Forte dem.' : 'Standard',
      label: 'Prix',
      sub: isHigh ? 'tarif majoré' : 'tarif normal',
      accent: isHigh,
    },
  ];

  return (
    <View style={sb.card}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <View style={sb.item}>
            <View style={[sb.iconWrap, it.accent && sb.iconWrapAccent]}>
              <Ionicons name={it.icon} size={14} color={it.accent ? '#111' : '#888'} />
            </View>
            <Text style={[sb.value, it.accent && sb.valueAccent]}>{it.value}</Text>
            <Text style={sb.label}>{it.sub}</Text>
          </View>
          {i < items.length - 1 && <View style={sb.sep} />}
        </React.Fragment>
      ))}
    </View>
  );
}

const sb = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 18, padding: 16,
    marginBottom: 28,
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

// Guess service icon from title keywords
const getServiceIcon = (title?: string): string => {
  if (!title) return 'build-outline';
  const t = title.toLowerCase();
  if (t.includes('ménage') || t.includes('nettoyage')) return 'sparkles-outline';
  if (t.includes('plomb')) return 'water-outline';
  if (t.includes('électr') || t.includes('electr')) return 'flash-outline';
  if (t.includes('jardin') || t.includes('pelouse')) return 'leaf-outline';
  if (t.includes('peint')) return 'brush-outline';
  if (t.includes('démén') || t.includes('demen')) return 'car-outline';
  if (t.includes('rénov') || t.includes('renov')) return 'construct-outline';
  if (t.includes('bricol')) return 'hammer-outline';
  return 'build-outline';
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
  const status   = getStatusInfo(request.status);
  const isActive = ['ACCEPTED', 'ONGOING'].includes(request.status?.toUpperCase());
  const icon     = getServiceIcon(request.title);
  const date     = new Date(request.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <>
      <TouchableOpacity style={sr.row} onPress={onPress} activeOpacity={0.65}>

        {/* Icône service */}
        <View style={[sr.iconBox, isActive && sr.iconBoxActive]}>
          <Ionicons name={icon as any} size={16} color={isActive ? '#FFF' : '#555'} />
        </View>

        {/* Centre : titre + date */}
        <View style={sr.mid}>
          <Text style={sr.title} numberOfLines={1}>{request.title || 'Service'}</Text>
          <Text style={sr.meta}>{date}{request.price ? ` · ${request.price} €` : ''}</Text>
        </View>

        {/* Droite : statut pill + chevron */}
        <View style={sr.right}>
          {isActive
            ? <View style={sr.activeBadge}><Text style={sr.activeBadgeText}>{status.label}</Text></View>
            : <Text style={sr.statusText}>{status.label}</Text>
          }
          <Ionicons name="chevron-forward" size={13} color="#D8D8D8" />
        </View>

      </TouchableOpacity>
      {!isLast && <View style={sr.sep} />}
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
  const router = useRouter();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '85%'], []);

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

  // ── Socket ──
  useEffect(() => {
    if (!socket || !user?.id) return;
    socket.emit('join:user', { userId: user.id });

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

    const handleAccepted  = (d: any) => { updateRequestStatus(d.id || d.requestId, 'ACCEPTED');  loadDashboard(); if (d.id || d.requestId) router.push(`/request/${d.id || d.requestId}/tracking`); };
    const handleStarted   = (d: any) => { updateRequestStatus(d.id || d.requestId, 'ONGOING');   loadDashboard(); };
    const handleCompleted = (d: any) => { updateRequestStatus(d.id || d.requestId, 'DONE');       loadDashboard(); };
    const handleCancelled = (d: any) => { updateRequestStatus(d.id || d.requestId, 'CANCELLED'); loadDashboard(); };
    const handleExpired   = (d: any) => { updateRequestStatus(d.id || d.requestId, 'EXPIRED');   loadDashboard(); };

    socket.on('request:accepted',  handleAccepted);
    socket.on('request:started',   handleStarted);
    socket.on('request:completed', handleCompleted);
    socket.on('request:cancelled', handleCancelled);
    socket.on('request:expired',   handleExpired);
    socket.on('provider:accepted', handleAccepted);

    return () => {
      socket.emit('leave:user', { userId: user.id });
      socket.off('request:accepted',  handleAccepted);
      socket.off('request:started',   handleStarted);
      socket.off('request:completed', handleCompleted);
      socket.off('request:cancelled', handleCancelled);
      socket.off('request:expired',   handleExpired);
      socket.off('provider:accepted', handleAccepted);
    };
  }, [socket, user?.id, router, loadDashboard]);

  // ── Actions ──
  const handleRequestPress = async (requestId: string) => {
    setLoadingDetails(true);
    bottomSheetRef.current?.expand();
    try {
      const details = await api.get(`/requests/${requestId}`);
      setSelectedRequest(details.request || details.data || details);
    } catch (error) {
      console.error('Error loading request details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleNavigateToMission = (request: any) => {
    bottomSheetRef.current?.close();
    const st = request.status?.toUpperCase();
    if (st === 'ACCEPTED' || st === 'ONGOING') router.push(`/request/${request.id}/tracking`);
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.3} />
    ), []
  );

  const activeMission = useMemo(() =>
    data?.requests?.find(r => ['ACCEPTED', 'ONGOING'].includes(r.status?.toUpperCase())) || null,
    [data]
  );

  const searchingMission = useMemo(() =>
    !activeMission && (data?.requests?.find(r => r.status?.toUpperCase() === 'PUBLISHED') || null),
    [data, activeMission]
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
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color="#111" />
      </SafeAreaView>
    );
  }

  const name = data?.me?.name || user?.email?.split('@')[0] || '';
  const city = data?.me?.city || 'Bruxelles';

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header compact — une seule ligne ── */}
        <View style={s.header}>
          <View style={s.headerNameRow}>
            <Text style={s.greeting}>{getGreeting()}, </Text>
            <Text style={s.name}>{name}</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity style={s.iconBtn}>
              <Ionicons name="notifications-outline" size={18} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/(tabs)/profile')}>
              <Ionicons name="person-outline" size={18} color="#111" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Status Hero Card — visible seulement si mission active/recherche ── */}
        <StatusHeroCard
          activeMission={activeMission}
          searchingMission={searchingMission}
          name={name}
          onActiveMissionPress={() => activeMission && handleNavigateToMission(activeMission)}
          onSearchingPress={() => searchingMission && handleRequestPress(searchingMission.id)}
          onNewRequest={() => router.push('/request/NewRequestStepper')}
        />

        {/* ── CTA principale — toujours visible, star de l'écran vide ── */}
        {!activeMission && !searchingMission && (
          <TouchableOpacity
            style={s.mainCTA}
            onPress={() => router.push('/request/NewRequestStepper')}
            activeOpacity={0.85}
          >
            <View style={s.mainCTASearchIcon}>
              <Ionicons name="add" size={16} color="rgba(255,255,255,0.7)" />
            </View>
            <Text style={s.mainCTATitle}>Commander un service</Text>
            <View style={s.mainCTABtn}>
              <Ionicons name="arrow-forward" size={14} color="#FFF" />
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

        {/* ── Disponibilité en temps réel — toujours affiché ── */}
        <AvailabilityBar />

        {/* ── Mes missions ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>
            Activité récente
            {totalCount > 0 && <Text style={s.sectionCount}> · {totalCount}</Text>}
          </Text>
          <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="refresh-outline" size={16} color="#ADADAD" />
          </TouchableOpacity>
        </View>

        <View style={s.listCard}>
          {!data?.requests?.length ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Text style={s.emptyX}>✕</Text>
              </View>
              <Text style={s.emptyTitle}>Aucune mission</Text>
              <Text style={s.emptySub}>Vos interventions apparaîtront ici</Text>
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
                  style={s.seeMoreBtn}
                  onPress={() => setShowAllRequests(v => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={s.seeMoreText}>
                    {showAllRequests ? 'Réduire' : `Voir tout (${totalCount - PREVIEW_COUNT} de plus)`}
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
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.sheetIndicator}
      >
        <BottomSheetView style={s.sheet}>
          {loadingDetails ? (
            <ActivityIndicator size="large" color="#111" style={{ marginTop: 50 }} />
          ) : selectedRequest ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.sheetTitle}>{selectedRequest.title || selectedRequest.serviceType}</Text>

              {/* Status badge */}
              <View style={s.statusBadge}>
                <View style={[s.statusDot, { backgroundColor: getStatusInfo(selectedRequest.status).dot }]} />
                <Text style={s.statusBadgeText}>{getStatusInfo(selectedRequest.status).label}</Text>
              </View>

              {/* Infos */}
              {[
                { icon: 'document-text-outline', val: selectedRequest.description || 'Aucune description.' },
                selectedRequest.address && { icon: 'location-outline', val: selectedRequest.address },
                selectedRequest.price    && { icon: 'cash-outline',    val: `${selectedRequest.price} €` },
              ].filter(Boolean).map((row: any, i) => (
                <View key={i} style={s.sheetRow}>
                  <View style={s.sheetRowIcon}>
                    <Ionicons name={row.icon} size={14} color="#888" />
                  </View>
                  <Text style={s.sheetVal}>{row.val}</Text>
                </View>
              ))}

              {/* CTA contextuelle */}
              {['ACCEPTED', 'ONGOING'].includes(selectedRequest.status?.toUpperCase()) && (
                <TouchableOpacity style={s.actionBtn} onPress={() => handleNavigateToMission(selectedRequest)}>
                  <Text style={s.actionBtnText}>
                    {selectedRequest.status === 'ACCEPTED' ? 'Suivre le prestataire' : 'Suivre la mission'}
                  </Text>
                  <Ionicons name="navigate" size={17} color="#FFF" />
                </TouchableOpacity>
              )}

              {selectedRequest.status?.toUpperCase() === 'DONE' && (
                <View style={s.doneCard}>
                  <Ionicons name="checkmark-circle" size={20} color="#111" />
                  <Text style={s.doneText}>Mission terminée avec succès</Text>
                </View>
              )}

              {selectedRequest.status?.toUpperCase() === 'EXPIRED' && (
                <>
                  <View style={s.expiredCard}>
                    <Ionicons name="time-outline" size={20} color="#888" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.expiredTitle}>Aucun prestataire trouvé</Text>
                      <Text style={s.expiredSub}>Relancez la recherche pour trouver un intervenant disponible.</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={s.actionBtn} onPress={() => { bottomSheetRef.current?.close(); router.push('/request/NewRequestStepper'); }}>
                    <Text style={s.actionBtnText}>Relancer la recherche</Text>
                    <Ionicons name="refresh" size={17} color="#FFF" />
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F8F9FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FB' },
  scroll: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  headerNameRow: { flexDirection: 'row', alignItems: 'baseline' },
  greeting: { fontSize: 14, fontWeight: '400', color: '#ADADAD' },
  name:     { fontSize: 14, fontWeight: '800', color: '#111' },
  headerRight: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#F0F0F0',
  },

  mainCTA: {
    backgroundColor: '#111',
    borderRadius: 18, height: 64, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 5 },
    }),
  },
  mainCTASearchIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  mainCTATitle: { flex: 1, fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  mainCTABtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8, paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  sectionCount: { fontSize: 14, fontWeight: '600', color: '#ADADAD' },

  listCard: {
    backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#EFEFEF',
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