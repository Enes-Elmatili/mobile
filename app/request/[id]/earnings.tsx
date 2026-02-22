// app/request/[id]/earnings.tsx
// Provider voit ses gains après mission — montant = star de l'écran

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';

export default function EarningsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);

  // Animations
  const checkAnim = useRef(new Animated.Value(0)).current;
  const priceAnim = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;

  useEffect(() => { loadRequestDetails(); }, [id]);

  const loadRequestDetails = async () => {
    try {
      const response = await api.get(`/requests/${id}`);
      setRequest(response.data || response);
      // Lancer animations après chargement
      Animated.sequence([
        Animated.spring(checkAnim, { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }),
        Animated.parallel([
          Animated.spring(priceAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
          Animated.timing(slideUp, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      ]).start();
    } catch (error) {
      console.error('Error loading request:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={s.loading}>
        <Text style={s.loadError}>Impossible de charger les détails</Text>
      </View>
    );
  }

  const basePrice = Number(request?.price) || 0;
  const commission = Math.round(basePrice * 0.15 * 100) / 100;
  const net = Math.round((basePrice - commission) * 100) / 100;

  const rows = [
    { label: 'Prix de la mission', value: `${basePrice.toFixed(2)} €`, highlight: false },
    { label: 'Commission (15%)', value: `−${commission.toFixed(2)} €`, highlight: false, negative: true },
  ];

  return (
    <SafeAreaView style={s.root}>
      {/* ── Zone succès — fond sombre ── */}
      <View style={s.heroZone}>
        {/* Checkmark animé */}
        <Animated.View style={[s.checkCircle, {
          transform: [{ scale: checkAnim }],
          opacity: checkAnim,
        }]}>
          <Ionicons name="checkmark" size={40} color="#FFF" />
        </Animated.View>

        <Text style={s.heroLabel}>Mission terminée</Text>

        {/* Prix net = star */}
        <Animated.Text style={[s.heroPrice, {
          transform: [{ scale: priceAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          opacity: priceAnim,
        }]}>
          {net.toFixed(2)} €
        </Animated.Text>

        <Text style={s.heroSub}>sur votre solde dans 2–3 jours ouvrés</Text>
      </View>

      {/* ── Zone détail — fond blanc ── */}
      <Animated.View style={[s.detailZone, { transform: [{ translateY: slideUp }] }]}>

        {/* Calcul compact */}
        <View style={s.calcCard}>
          <Text style={s.calcTitle}>Détail du paiement</Text>
          {rows.map((row, i) => (
            <View key={i} style={[s.calcRow, i < rows.length - 1 && s.calcRowBorder]}>
              <Text style={[s.calcLabel, row.negative && s.calcLabelNeg]}>{row.label}</Text>
              <Text style={[s.calcValue, row.negative && s.calcValueNeg]}>{row.value}</Text>
            </View>
          ))}
          <View style={s.calcTotal}>
            <Text style={s.calcTotalLabel}>Total net</Text>
            <Text style={s.calcTotalValue}>{net.toFixed(2)} €</Text>
          </View>
        </View>

        {/* Détails mission compact */}
        <View style={s.missionCard}>
          {[
            { icon: 'construct-outline', text: request?.serviceType },
            { icon: 'location-outline', text: request?.address },
            { icon: 'person-outline', text: request?.client?.name },
          ].filter(r => r.text).map((row, i) => (
            <View key={i} style={[s.missionRow, i < 2 && s.missionRowBorder]}>
              <Ionicons name={row.icon as any} size={15} color="#888" />
              <Text style={s.missionText} numberOfLines={1}>{row.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Actions ── */}
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => router.push('/(tabs)/dashboard')}
          activeOpacity={0.88}
        >
          <Text style={s.primaryBtnText}>Retour au tableau de bord</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={() => router.push('/wallet')}
        >
          <Text style={s.secondaryBtnText}>Voir mes gains totaux</Text>
        </TouchableOpacity>

      </Animated.View>
    </SafeAreaView>
  );
}

// Fix: useRef n'est pas importé automatiquement
import { useRef } from 'react';

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  loadError: { fontSize: 15, color: '#888' },

  // Hero zone (fond sombre)
  heroZone: {
    alignItems: 'center', paddingTop: 40, paddingBottom: 40, paddingHorizontal: 24,
    gap: 10,
  },
  checkCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#34C759',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#34C759', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  heroLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  heroPrice: {
    fontSize: 64, fontWeight: '900', color: '#FFF',
    letterSpacing: -2, lineHeight: 72,
  },
  heroSub: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.35)', textAlign: 'center' },

  // Detail zone (fond blanc, arrondis haut)
  detailZone: {
    flex: 1,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 0 : 20,
    gap: 12,
  },

  // Calcul
  calcCard: {
    backgroundColor: '#F7F7F7', borderRadius: 20,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4,
    marginBottom: 4,
  },
  calcTitle: { fontSize: 13, fontWeight: '700', color: '#888', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  calcRowBorder: { borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  calcLabel: { fontSize: 14, fontWeight: '500', color: '#555' },
  calcLabelNeg: { color: '#888' },
  calcValue: { fontSize: 14, fontWeight: '700', color: '#111' },
  calcValueNeg: { color: '#888' },
  calcTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderTopWidth: 1.5, borderTopColor: '#E5E7EB', marginTop: 4,
  },
  calcTotalLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  calcTotalValue: { fontSize: 20, fontWeight: '900', color: '#111' },

  // Mission
  missionCard: {
    backgroundColor: '#F7F7F7', borderRadius: 20, overflow: 'hidden', marginBottom: 8,
  },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  missionRowBorder: { borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  missionText: { fontSize: 14, fontWeight: '500', color: '#444', flex: 1 },

  // Boutons
  primaryBtn: {
    backgroundColor: '#111', borderRadius: 16, height: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 14 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: '#888' },
});