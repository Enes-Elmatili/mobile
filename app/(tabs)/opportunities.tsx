// app/(tabs)/opportunities.tsx — Opportunités planifiées (style Uber)
// Les providers voient les demandes futures matchant leurs compétences

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, SafeAreaView, Animated, StatusBar,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useSocket } from '@/lib/SocketContext';
import * as Haptics from 'expo-haptics';

const NET_RATE = 0.85;

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
  item, theme, onAccept, accepting,
}: {
  item: Opportunity; theme: ReturnType<typeof useAppTheme>;
  onAccept: (id: number) => void; accepting: number | null;
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
      <View style={[st.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        {/* Header: catégorie + date relative */}
        <View style={st.cardHead}>
          <View style={[st.catBadge, { backgroundColor: theme.surface }]}>
            <Ionicons name="construct-outline" size={14} color={theme.text} />
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
            <Ionicons name="calendar-outline" size={14} color={theme.textMuted} />
            <Text style={[st.infoText, { color: theme.textSub }]}>{day} à {time}</Text>
          </View>
          <View style={st.infoItem}>
            <Ionicons name="location-outline" size={14} color={theme.textMuted} />
            <Text style={[st.infoText, { color: theme.textSub }]} numberOfLines={1}>
              {item.address.split(',')[0]}
            </Text>
          </View>
        </View>

        {/* Footer: prix + bouton accepter */}
        <View style={st.cardFoot}>
          {net ? (
            <View>
              <Text style={[st.priceNet, { color: theme.text }]}>{net} €</Text>
              <Text style={[st.priceLabel, { color: theme.textMuted }]}>net estimé</Text>
            </View>
          ) : (
            <View />
          )}
          <TouchableOpacity
            style={st.acceptBtn}
            onPress={handlePress}
            disabled={accepting !== null}
            activeOpacity={0.8}
          >
            {accepting === item.id ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                <Text style={st.acceptText}>Accepter</Text>
              </>
            )}
          </TouchableOpacity>
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
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  // Écouter les nouvelles opportunités en temps réel
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      fetchOpportunities();
    };
    socket.on('new_opportunity', handler);
    return () => { socket.off('new_opportunity', handler); };
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
      router.push(`/request/${requestId}/ongoing`);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erreur';
      Alert.alert('Impossible', msg);
    } finally {
      setAccepting(null);
    }
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Opportunity }) => (
    <OpportunityCard item={item} theme={theme} onAccept={handleAccept} accepting={accepting} />
  ), [theme, handleAccept, accepting]);

  return (
    <SafeAreaView style={[st.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={st.header}>
        <Text style={[st.headerTitle, { color: theme.text }]}>Opportunités</Text>
        <Text style={[st.headerSub, { color: theme.textSub }]}>
          Missions planifiées pour vous
        </Text>
      </View>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator size="large" color={theme.textSub} />
        </View>
      ) : opportunities.length === 0 ? (
        <View style={st.center}>
          <Ionicons name="telescope-outline" size={48} color={theme.textMuted} />
          <Text style={[st.emptyTitle, { color: theme.text }]}>Aucune opportunité</Text>
          <Text style={[st.emptySub, { color: theme.textSub }]}>
            Les missions planifiées correspondant à vos compétences apparaîtront ici.
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
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, fontWeight: '500', marginTop: 2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  emptySub: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },

  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 },

  card: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  catBadgeText: { fontSize: 12, fontWeight: '600' },
  relBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  relText: { fontSize: 11, fontWeight: '600' },

  serviceName: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  desc: { fontSize: 13, fontWeight: '500', lineHeight: 18, marginBottom: 10 },

  infoRow: { gap: 6, marginBottom: 14 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, fontWeight: '500' },

  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceNet: { fontSize: 20, fontWeight: '800' },
  priceLabel: { fontSize: 11, fontWeight: '500' },
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1A1A1A', borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  acceptText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
