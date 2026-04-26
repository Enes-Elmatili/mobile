// app/(tabs)/opportunities.tsx — Opportunites planifiees (style Uber)
// Les providers voient les demandes futures matchant leurs competences

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, SafeAreaView, Animated, StatusBar,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useSocket } from '@/lib/SocketContext';
import * as Haptics from 'expo-haptics';

const NET_RATE = 0.80;

type FilterKey = 'all' | 'plumbing' | 'urgent' | 'scheduled';
const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'plumbing', label: 'Plumbing' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'scheduled', label: 'Scheduled' },
];

interface Opportunity {
  id: number;
  serviceType: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  price: number | null;
  preferredTimeStart: string;
  category: { id: number; name: string; icon: string | null };
  subcategory: { id: number; name: string } | null;
  client: { name: string; avatarUrl?: string | null; city?: string | null };
}

function formatScheduledDate(iso: string): { day: string; time: string; relative: string } {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  let relative = '';
  if (diffDays === 0) relative = "Aujourd'hui";
  else if (diffDays === 1) relative = 'Demain';
  else if (diffDays <= 7) relative = `Dans ${diffDays} jours`;
  else relative = `Dans ${Math.ceil(diffDays / 7)} sem.`;

  return { day, time, relative };
}

function OpportunityCard({
  item, theme, onAccept, onDecline, accepting,
}: {
  item: Opportunity; theme: ReturnType<typeof useAppTheme>;
  onAccept: (id: number) => void; onDecline: (id: number) => void; accepting: number | null;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { day, time, relative } = formatScheduledDate(item.preferredTimeStart);
  const net = item.price ? (item.price * NET_RATE).toFixed(0) : null;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAccept(item.id);
  };

  // Determine if this is an urgent opportunity (preferredTimeStart within 24h)
  const diffMs = new Date(item.preferredTimeStart).getTime() - Date.now();
  const isUrgent = diffMs < 24 * 60 * 60 * 1000;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={[st.card, { backgroundColor: theme.cardBg, borderColor: theme.border, shadowOpacity: theme.shadowOpacity }]}>
        {/* Status chip + timing */}
        <View style={st.cardHead}>
          <View style={[st.statusChip, { backgroundColor: isUrgent ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)' }]}>
            <View style={[st.statusDot, { backgroundColor: isUrgent ? COLORS.amber : COLORS.statusAccepted }]} />
            <Text style={[st.statusChipText, { color: isUrgent ? COLORS.amber : COLORS.statusAccepted }]}>
              {isUrgent ? 'URGENT' : 'SCHEDULED'}
            </Text>
          </View>
          <Text style={[st.timingLabel, { color: theme.textMuted }]}>{relative} · {day}</Text>
        </View>

        {/* Service name */}
        <Text style={[st.serviceName, { color: theme.text }]} numberOfLines={1}>
          {item.serviceType.toUpperCase()}
        </Text>

        {/* Address + distance */}
        <View style={st.addressRow}>
          <Feather name="map-pin" size={13} color={theme.textSub} />
          <Text style={[st.addressText, { color: theme.textSub }]} numberOfLines={1}>
            {item.address.split(',')[0]}
          </Text>
          {item.client.city ? (
            <Text style={[st.distanceText, { color: theme.textMuted }]}> · {item.client.city}</Text>
          ) : null}
        </View>

        {/* Footer: prix + boutons */}
        <View style={st.cardFoot}>
          {net ? (
            <View style={st.priceBlock}>
              <Text style={[st.priceNet, { color: theme.text }]}>{item.price}&nbsp;&euro;</Text>
              <Text style={[st.priceLabel, { color: theme.textMuted }]}>NET &euro;{net}</Text>
            </View>
          ) : (
            <View />
          )}
          <View style={st.cardActions}>
            <TouchableOpacity
              style={[st.declineBtn, { borderColor: theme.border }]}
              onPress={() => onDecline(item.id)}
              disabled={accepting !== null}
              activeOpacity={0.8}
            >
              <Text style={[st.declineText, { color: theme.textSub }]}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.acceptBtn, { backgroundColor: theme.accent }]}
              onPress={handlePress}
              disabled={accepting !== null}
              activeOpacity={0.8}
            >
              {accepting === item.id ? (
                <ActivityIndicator size="small" color={theme.accentText} />
              ) : (
                <Text style={[st.acceptText, { color: theme.accentText }]}>Accept</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default function OpportunitiesScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { socket } = useSocket();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  // In-flight guard: prevents concurrent fetches (mount effect + pull-to-refresh
  // + socket rebroadcast can otherwise all fire this within a few ms).
  const fetchInFlightRef = useRef(false);
  const fetchOpportunities = useCallback(async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    try {
      const res = await api.get('/requests/opportunities');
      const data = res?.data ?? res;
      setOpportunities(Array.isArray(data) ? data : data?.data ?? []);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de charger les opportunités.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  // Ecouter les nouvelles opportunites en temps reel
  useEffect(() => {
    if (!socket) return;
    const handleNew = () => fetchOpportunities();
    const handleClaimed = (requestId: number) => {
      setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
    };
    socket.on('new_opportunity', handleNew);
    socket.on('new_request', handleNew);
    socket.on('request:claimed', handleClaimed);
    return () => {
      socket.off('new_opportunity', handleNew);
      socket.off('new_request', handleNew);
      socket.off('request:claimed', handleClaimed);
    };
  }, [socket, fetchOpportunities]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleAccept = useCallback(async (requestId: number) => {
    setAccepting(requestId);
    try {
      await api.post(`/requests/${requestId}/accept`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Retirer de la liste
      setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
      // Toujours vers MissionView (ongoing), peu importe pricingMode
      router.replace(`/request/${requestId}/ongoing`);
    } catch (e: any) {
      const code = e?.response?.data?.code || e?.data?.code;
      // Mission plus disponible (prise par un autre, annulée, expirée) — on
      // ne surface pas le message technique du backend, juste un feedback doux.
      if (code === 'INVALID_STATE' || code === 'ALREADY_TAKEN') {
        setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
        Alert.alert('Mission plus disponible', 'Cette mission vient d\'être prise ou n\'est plus active.');
      } else {
        const msg = e?.response?.data?.message || e?.message || 'Erreur';
        Alert.alert('Impossible', msg);
      }
    } finally {
      setAccepting(null);
    }
  }, [router]);

  const handleDecline = useCallback(async (requestId: number) => {
    try {
      await api.post(`/requests/${requestId}/refuse`);
      // Also notify via socket for real-time tracking
      socket?.emit('request:decline', { requestId });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
    } catch {
      // Silently remove from list even if API fails
      setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
    }
  }, [socket]);

  // Filter opportunities based on selected chip
  const filteredOpportunities = React.useMemo(() => {
    if (filter === 'all') return opportunities;
    if (filter === 'plumbing') return opportunities.filter(o => o.category.name.toLowerCase().includes('plomb') || o.category.name.toLowerCase().includes('plumb'));
    if (filter === 'urgent') return opportunities.filter(o => {
      const diffMs = new Date(o.preferredTimeStart).getTime() - Date.now();
      return diffMs < 24 * 60 * 60 * 1000;
    });
    if (filter === 'scheduled') return opportunities.filter(o => {
      const diffMs = new Date(o.preferredTimeStart).getTime() - Date.now();
      return diffMs >= 24 * 60 * 60 * 1000;
    });
    return opportunities;
  }, [opportunities, filter]);

  const chipCounts = React.useMemo(() => {
    const urgentCount = opportunities.filter(o => {
      const diffMs = new Date(o.preferredTimeStart).getTime() - Date.now();
      return diffMs < 24 * 60 * 60 * 1000;
    }).length;
    const plumbingCount = opportunities.filter(o => o.category.name.toLowerCase().includes('plomb') || o.category.name.toLowerCase().includes('plumb')).length;
    return {
      all: opportunities.length,
      plumbing: plumbingCount,
      urgent: urgentCount,
      scheduled: opportunities.length - urgentCount,
    };
  }, [opportunities]);

  const renderItem = useCallback(({ item }: { item: Opportunity }) => (
    <OpportunityCard item={item} theme={theme} onAccept={handleAccept} onDecline={handleDecline} accepting={accepting} />
  ), [theme, handleAccept, handleDecline, accepting]);

  return (
    <SafeAreaView style={[st.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={st.header}>
        <View style={st.headerTopRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={[st.filterIconBtn, { backgroundColor: theme.surface }]} activeOpacity={0.7}>
            <Feather name="sliders" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
        <Text style={[st.headerSub, { color: theme.textMuted }]}>
          {opportunities.length} NEW JOBS NEAR YOU
        </Text>
        <Text style={[st.headerTitle, { color: theme.text }]}>Opportunities</Text>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.chipRow}
        style={st.chipScroll}
      >
        {FILTER_CHIPS.map((chip) => {
          const isActive = filter === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[
                st.chip,
                { backgroundColor: isActive ? theme.accent : theme.surface },
              ]}
              onPress={() => setFilter(chip.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                st.chipText,
                { color: isActive ? theme.accentText : theme.textSub },
              ]}>
                {chip.label}{chipCounts[chip.key] > 0 ? ` \u00B7 ${chipCounts[chip.key]}` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={theme.textSub} />
        </View>
      ) : filteredOpportunities.length === 0 ? (
        <View style={st.center}>
          <Feather name="search" size={48} color={theme.textMuted} />
          <Text style={[st.emptyTitle, { color: theme.text }]}>No opportunities</Text>
          <Text style={[st.emptySub, { color: theme.textSub }]}>
            Scheduled missions matching your skills will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOpportunities}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.textSub} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },

  // ── Header ──
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 },
  filterIconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerSub: { fontSize: 10.5, fontFamily: FONTS.mono, letterSpacing: 0.9, textTransform: 'uppercase' as const, marginBottom: 2 },
  headerTitle: { fontSize: 44, fontFamily: FONTS.bebas, letterSpacing: 0.5 },

  // ── Filter chips ──
  chipScroll: { flexGrow: 0 },
  chipRow: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  chipText: { fontSize: 13, fontFamily: FONTS.sansMedium },

  // ── Empty / loading ──
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.sansMedium, marginTop: 8 },
  emptySub: { fontSize: 14, fontFamily: FONTS.sans, textAlign: 'center', lineHeight: 20 },

  // ── List ──
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 },

  // ── Card ──
  card: {
    borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },

  // ── Card head: status chip + timing ──
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontSize: 11, fontFamily: FONTS.sansMedium, letterSpacing: 0.5 },
  timingLabel: { fontSize: 10.5, fontFamily: FONTS.mono, letterSpacing: 0.3 },

  // ── Service name ──
  serviceName: { fontSize: 22, fontFamily: FONTS.bebas, letterSpacing: 0.4, marginBottom: 6 },

  // ── Address row ──
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  addressText: { fontSize: 12.5, fontFamily: FONTS.sans },
  distanceText: { fontSize: 12.5, fontFamily: FONTS.sans },

  // ── Card footer: price + actions ──
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceBlock: { gap: 1 },
  priceNet: { fontSize: 26, fontFamily: FONTS.bebas, letterSpacing: 0.4 },
  priceLabel: { fontSize: 10.5, fontFamily: FONTS.mono, letterSpacing: 0.5 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  declineBtn: {
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 13, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  declineText: { fontSize: 13, fontFamily: FONTS.sansMedium },
  acceptBtn: {
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 13,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  acceptText: { fontSize: 14, fontFamily: FONTS.sansMedium },
});
