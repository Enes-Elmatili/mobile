// app/request/[id]/earnings.tsx
// v2 — Palette Silver unifiée + navigation lock (no race condition)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StatusBar,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useInvoice } from '@/hooks/useInvoice';
import InvoiceSheet from '@/components/sheets/InvoiceSheet';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

export default function EarningsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [monthEarnings, setMonthEarnings] = useState<number>(0);
  const [invoiceVisible, setInvoiceVisible] = useState(false);
  const { invoice } = useInvoice(id ? Number(id) : null);

  // Animations
  const checkAnim = useRef(new Animated.Value(0)).current;
  const priceAnim = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const [displayedPrice, setDisplayedPrice] = useState(0);

  // ── Navigation lock — empêche tout retour arrière avant d'afficher les gains ──
  // Sur Android, BackHandler intercepte le bouton physique
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true); // true = bloqué
    return () => sub.remove();
  }, []);

  useEffect(() => { loadRequestDetails(); }, [id]);

  const loadRequestDetails = async () => {
    try {
      const results = await Promise.allSettled([
        api.get(`/requests/${id}`),
        api.wallet.balance(),
      ]);

      if (results[0].status === 'fulfilled') {
        const reqData = (results[0] as PromiseFulfilledResult<any>).value;
        setRequest(reqData.data || reqData);
      }
      if (results[1].status === 'fulfilled') {
        const w = (results[1] as PromiseFulfilledResult<any>).value;
        setMonthEarnings(w.monthEarnings || w.totalEarnings || 0);
      }

      // Lancer animations après chargement
      Animated.sequence([
        Animated.spring(checkAnim, { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }),
        Animated.parallel([
          Animated.spring(priceAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
          Animated.timing(slideUp, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
      ]).start();
    } catch (error) {
      devError('Error loading request:', error);
    } finally {
      setLoading(false);
    }
  };

  // Counting animation: 0 → net price
  useEffect(() => {
    if (loading || !request) return;
    const baseP = Number(request?.price) || 0;
    const target = Math.round((baseP - baseP * 0.15) * 100) / 100;
    const duration = 1200;
    const steps = 40;
    const stepTime = duration / steps;
    let current = 0;
    const interval = setInterval(() => {
      current++;
      const progress = current / steps;
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplayedPrice(Math.round(target * eased * 100) / 100);
      if (current >= steps) clearInterval(interval);
    }, stepTime);
    return () => clearInterval(interval);
  }, [loading, request]);

  if (loading) {
    return (
      <View style={[s.loading, { backgroundColor: theme.surface }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={[s.loading, { backgroundColor: theme.surface }]}>
        <Text style={[s.loadError, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Impossible de charger les détails</Text>
      </View>
    );
  }

  const basePrice = Number(request?.price) || 0;
  const commission = Math.round(basePrice * 0.15 * 100) / 100;
  const net = Math.round((basePrice - commission) * 100) / 100;

  const rows = [
    { label: 'Prix de la mission', value: `${basePrice.toFixed(2)} €`, highlight: false },
    { label: 'Commission (15%)', value: `-${commission.toFixed(2)} €`, highlight: false, negative: true },
  ];

  return (
    <View style={[s.root, { backgroundColor: theme.heroBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.heroBg} />
      {/* ── Zone succès — fond sombre ── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.heroBg }}>
      <View style={s.heroZone}>
        {/* Checkmark animé */}
        <Animated.View style={[s.checkCircle, {
          backgroundColor: theme.isDark ? theme.surface : '#1A1A1A',
          transform: [{ scale: checkAnim }],
          opacity: checkAnim,
        }]}>
          <Ionicons name="checkmark" size={40} color={theme.heroText} />
        </Animated.View>

        <Text style={[s.heroLabel, { color: theme.heroSub, fontFamily: FONTS.sansMedium }]}>Mission terminée</Text>

        {/* Prix net = star */}
        <Animated.Text style={[s.heroPrice, {
          color: theme.heroText,
          fontFamily: FONTS.bebas,
          transform: [{ scale: priceAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          opacity: priceAnim,
        }]}>
          {displayedPrice.toFixed(2)} €
        </Animated.Text>

        <Text style={[s.heroSub, { color: theme.heroSubFaint, fontFamily: FONTS.sans }]}>disponible sous 48h après validation</Text>
      </View>
      </SafeAreaView>

      {/* ── Zone détail — fond adaptatif ── */}
      <Animated.View style={[s.detailZone, { backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, 16) + 16, transform: [{ translateY: slideUp }] }]}>

        {/* Calcul compact */}
        <View style={[s.calcCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.calcTitle, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Détail du paiement</Text>
          {rows.map((row, i) => (
            <View key={i} style={[s.calcRow, i < rows.length - 1 && [s.calcRowBorder, { borderBottomColor: theme.border }]]}>
              <Text style={[s.calcLabel, { color: row.negative ? theme.textMuted : theme.textSub, fontFamily: FONTS.sans }]}>{row.label}</Text>
              <Text style={[s.calcValue, { color: row.negative ? theme.textMuted : theme.textAlt, fontFamily: FONTS.monoMedium }]}>{row.value}</Text>
            </View>
          ))}
          <View style={[s.calcTotal, { borderTopColor: theme.border }]}>
            <Text style={[s.calcTotalLabel, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Total net</Text>
            <Text style={[s.calcTotalValue, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>{net.toFixed(2)} €</Text>
          </View>
        </View>

        {/* Détails mission compact */}
        <View style={[s.missionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {[
            { icon: 'construct-outline', text: request?.serviceType },
            { icon: 'location-outline', text: request?.address },
            { icon: 'person-outline', text: request?.client?.name },
          ].filter(r => r.text).map((row, i) => (
            <View key={i} style={[s.missionRow, i < 2 && [s.missionRowBorder, { borderBottomColor: theme.border }]]}>
              <Ionicons name={row.icon as any} size={15} color={theme.textMuted} />
              <Text style={[s.missionText, { color: theme.textSub, fontFamily: FONTS.sans }]} numberOfLines={1}>{row.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Gains ce mois ── */}
        <TouchableOpacity
          style={[s.monthCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.push('/wallet')}
          activeOpacity={0.85}
        >
          <View style={s.monthCardLeft}>
            <Ionicons name="trending-up" size={18} color={COLORS.green} />
            <View>
              <Text style={[s.monthCardLabel, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Gains ce mois</Text>
              <Text style={[s.monthCardValue, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>
                {(monthEarnings / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </TouchableOpacity>

        {/* ── Actions ── */}
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: theme.accent }]}
          onPress={() => router.replace('/(tabs)/missions')}
          activeOpacity={0.88}
        >
          <Text style={[s.primaryBtnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Trouver ma prochaine mission</Text>
          <Ionicons name="arrow-forward" size={18} color={theme.accentText} />
        </TouchableOpacity>

        {invoice && (
          <TouchableOpacity
            style={[s.invoiceBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setInvoiceVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="receipt-outline" size={16} color={theme.textSub} />
            <Text style={[s.invoiceBtnText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>Voir la facture</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={() => router.replace('/(tabs)/dashboard')}
        >
          <Text style={[s.secondaryBtnText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Retour au tableau de bord</Text>
        </TouchableOpacity>

      </Animated.View>

      {/* Invoice Sheet */}
      <InvoiceSheet
        invoice={invoice}
        isVisible={invoiceVisible}
        onClose={() => setInvoiceVisible(false)}
        userRole="provider"
        serviceTitle={request?.serviceType}
        missionDate={request?.completedAt || request?.createdAt}
      />
    </View>
  );
}

// Fix: useRef n'est pas importé automatiquement
import { useRef } from 'react';

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadError: { fontSize: 15 },

  // Hero zone (fond sombre) — compact pour éviter la troncature
  heroZone: {
    alignItems: 'center', paddingTop: 24, paddingBottom: 24, paddingHorizontal: 24,
    gap: 8,
  },
  checkCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  heroLabel: { fontSize: 14, letterSpacing: 0.5 },
  heroPrice: {
    fontSize: 56,
    letterSpacing: -2, lineHeight: 64,
  },
  heroSub: { fontSize: 13, textAlign: 'center' },

  // Detail zone (fond adaptatif, arrondis haut)
  detailZone: {
    flex: 1,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 20,
    gap: 12,
  },

  // Calcul
  calcCard: {
    borderRadius: 20,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2,
    marginBottom: 4,
    borderWidth: 1,
  },
  calcTitle: { fontSize: 13, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  calcRowBorder: { borderBottomWidth: 1 },
  calcLabel: { fontSize: 14 },
  calcValue: { fontSize: 14 },
  calcTotal: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderTopWidth: 1.5, marginTop: 4,
  },
  calcTotalLabel: { fontSize: 15 },
  calcTotalValue: { fontSize: 24 },

  // Mission
  missionCard: {
    borderRadius: 20, overflow: 'hidden', marginBottom: 4,
    borderWidth: 1,
  },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11 },
  missionRowBorder: { borderBottomWidth: 1 },
  missionText: { fontSize: 14, flex: 1 },

  // Month card
  monthCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1,
  },
  monthCardLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  monthCardLabel: { fontSize: 12, letterSpacing: 0.3 },
  monthCardValue: { fontSize: 24, letterSpacing: -1, lineHeight: 28 },

  // Boutons
  primaryBtn: {
    borderRadius: 55, height: 55,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnText: { fontSize: 16 },
  secondaryBtn: { alignItems: 'center', paddingVertical: 10 },
  secondaryBtnText: { fontSize: 15 },
  invoiceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 55, height: 55,
    borderWidth: 1.5,
  },
  invoiceBtnText: { fontSize: 14 },
});
