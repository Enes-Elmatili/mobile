// app/(tabs)/opportunities.tsx — Opportunites planifiees (style Uber)
// Les providers voient les demandes futures matchant leurs competences

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, SafeAreaView, Animated, StatusBar,
  ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useSocket } from '@/lib/SocketContext';
import * as Haptics from 'expo-haptics';

const NET_RATE = 0.80;

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
  client: { name: string };
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

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={[st.card, { backgroundColor: theme.cardBg, borderColor: theme.border, shadowOpacity: theme.shadowOpacity }]}>
        {/* Header: categorie + date relative */}
        <View style={st.cardHead}>
          <View style={[st.catBadge, { backgroundColor: theme.surface }]}>
            <Feather name="tool" size={14} color={theme.text} />
            <Text style={[st.catBadgeText, { color: theme.text }]}>{item.category.name}</Text>
          </View>
          <View style={[st.relBadge, { backgroundColor: theme.surface }]}>
            <Text style={[st.relText, { color: theme.textSub }]}>{relative}</Text>
          </View>
        </View>

        {/* Service */}
        <Text style={[st.serviceName, { color: theme.text }]} numberOfLines={1}>
          {item.serviceType}
        </Text>
        {item.description ? (
          <Text style={[st.desc, { color: theme.textSub }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {/* Infos row: date/heure + adresse */}
        <View style={st.infoRow}>
          <View style={st.infoItem}>
            <Feather name="calendar" size={14} color={theme.textMuted} />
            <Text style={[st.infoText, { color: theme.textSub }]}>{day} a {time}</Text>
          </View>
          <View style={st.infoItem}>
            <Feather name="map-pin" size={14} color={theme.textMuted} />
            <Text style={[st.infoText, { color: theme.textSub }]} numberOfLines={1}>
              {item.address.split(',')[0]}
            </Text>
          </View>
        </View>

        {/* Footer: prix + boutons */}
        <View style={st.cardFoot}>
          {net ? (
            <View>
              <Text style={[st.priceNet, { color: theme.text }]}>{net} &euro;</Text>
              <Text style={[st.priceLabel, { color: theme.textMuted }]}>net estime</Text>
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
              <Feather name="x-circle" size={18} color={theme.textSub} />
              <Text style={[st.declineText, { color: theme.textSub }]}>Décliner</Text>
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
                <>
                  <Feather name="check-circle" size={18} color={theme.accentText} />
                  <Text style={[st.acceptText, { color: theme.accentText }]}>Accepter</Text>
                </>
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

  const fetchOpportunities = useCallback(async () => {
    try {
      const res = await api.get('/requests/opportunities');
      const data = res?.data ?? res;
      setOpportunities(Array.isArray(data) ? data : data?.data ?? []);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de charger les opportunités.');
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      const msg = e?.response?.data?.message || e?.message || 'Erreur';
      Alert.alert('Impossible', msg);
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

  const renderItem = useCallback(({ item }: { item: Opportunity }) => (
    <OpportunityCard item={item} theme={theme} onAccept={handleAccept} onDecline={handleDecline} accepting={accepting} />
  ), [theme, handleAccept, handleDecline, accepting]);

  return (
    <SafeAreaView style={[st.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={st.header}>
        <Text style={[st.headerTitle, { color: theme.text }]}>Opportunites</Text>
        <Text style={[st.headerSub, { color: theme.textSub }]}>
          Missions planifiees pour vous
        </Text>
      </View>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={theme.textSub} />
        </View>
      ) : opportunities.length === 0 ? (
        <View style={st.center}>
          <Feather name="search" size={48} color={theme.textMuted} />
          <Text style={[st.emptyTitle, { color: theme.text }]}>Aucune opportunite</Text>
          <Text style={[st.emptySub, { color: theme.textSub }]}>
            Les missions planifiees correspondant a vos competences apparaitront ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={opportunities}
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
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontFamily: FONTS.bebas, letterSpacing: 0.5 },
  headerSub: { fontSize: 14, fontFamily: FONTS.sans, marginTop: 2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.sansMedium, marginTop: 8 },
  emptySub: { fontSize: 14, fontFamily: FONTS.sans, textAlign: 'center', lineHeight: 20 },

  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 },

  card: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  catBadgeText: { fontSize: 12, fontFamily: FONTS.sansMedium },
  relBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  relText: { fontSize: 11, fontFamily: FONTS.sansMedium },

  serviceName: { fontSize: 17, fontFamily: FONTS.sansMedium, marginBottom: 4 },
  desc: { fontSize: 13, fontFamily: FONTS.sans, lineHeight: 18, marginBottom: 10 },

  infoRow: { gap: 6, marginBottom: 14 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, fontFamily: FONTS.sans },

  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceNet: { fontSize: 20, fontFamily: FONTS.bebas },
  priceLabel: { fontSize: 11, fontFamily: FONTS.mono },
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  declineText: { fontSize: 13, fontFamily: FONTS.sansMedium },
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  acceptText: { fontSize: 14, fontFamily: FONTS.sansMedium },
});
