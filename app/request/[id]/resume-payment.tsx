// app/request/[id]/resume-payment.tsx
// Reprendre le paiement d'une demande PENDING_PAYMENT existante
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Platform,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line } from 'react-native-svg';
import { Dimensions } from 'react-native';
import { api } from '@/lib/api';
import { FONTS, COLORS, darkTokens } from '@/hooks/use-app-theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { devError } from '@/lib/logger';
import { formatEUR } from '@/lib/format';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const GRID_SIZE = 40;

// Forced-dark local palette — sourced from theme tokens so charter updates propagate
const C = {
  bg:     darkTokens.bg,
  white:  darkTokens.text,
  grey:   darkTokens.textMuted,
  border: 'rgba(255,255,255,0.08)',
  cardBg: darkTokens.cardBg,
  amber:  COLORS.orangeBrand,
};

function GridLines() {
  const cols = Math.ceil(SCREEN_W / GRID_SIZE) + 1;
  const rows = Math.ceil(SCREEN_H / GRID_SIZE) + 1;
  const stroke = 'rgba(255,255,255,0.025)';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
        {Array.from({ length: cols }, (_, i) => (
          <Line key={`v${i}`} x1={i * GRID_SIZE} y1={0} x2={i * GRID_SIZE} y2={SCREEN_H} stroke={stroke} strokeWidth={1} />
        ))}
        {Array.from({ length: rows }, (_, i) => (
          <Line key={`h${i}`} x1={0} y1={i * GRID_SIZE} x2={SCREEN_W} y2={i * GRID_SIZE} stroke={stroke} strokeWidth={1} />
        ))}
      </Svg>
      <LinearGradient
        colors={['transparent', 'transparent', C.bg]}
        locations={[0, 0.35, 0.75]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />
    </View>
  );
}

export default function ResumePayment() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentReady, setPaymentReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // 1. Fetch request + init payment sheet
  useEffect(() => {
    if (!id || !user?.id) return;
    (async () => {
      try {
        const res: any = await api.requests.get(String(id));
        const req = res?.data || res;

        // Guard: ownership + status
        if (!req || req.clientId !== user.id) {
          Alert.alert('Accès refusé', 'Vous n\'êtes pas autorisé à accéder à cette page.');
          router.replace('/(tabs)/dashboard');
          return;
        }
        if (req.status?.toUpperCase() !== 'PENDING_PAYMENT') {
          router.replace('/(tabs)/dashboard');
          return;
        }

        setRequest(req);

        // Init Stripe payment sheet
        // - Quote flow: PaymentIntent via /quotes/callout-payment (callout fee)
        // - Fixed-price (DIRECT_CHARGE): PaymentIntent via /payments/setup
        //   with automatic_payment_methods → Card, Klarna, Bancontact, Apple Pay…
        const isQuoteFlow = req.pricingMode === 'estimate' || req.pricingMode === 'diagnostic';

        let initOptions: Parameters<typeof initPaymentSheet>[0];

        if (isQuoteFlow) {
          const calloutRes = await api.post('/quotes/callout-payment', { requestId: String(id) });
          if (!mountedRef.current) return;
          initOptions = {
            merchantDisplayName: 'Fixed',
            paymentIntentClientSecret: calloutRes.clientSecret,
            applePay: { merchantCountryCode: 'BE' },
            googlePay: { merchantCountryCode: 'BE', testEnv: false },
            paymentMethodOrder: ['apple_pay', 'card', 'klarna', 'revolut_pay'],
          };
        } else {
          const setupRes: any = await api.payments.setup(String(id));
          if (!mountedRef.current) return;
          // Backend returns paymentIntentClientSecret (new) with legacy alias
          // setupIntentClientSecret during rollout — read whichever is present.
          const clientSecret = setupRes.paymentIntentClientSecret || setupRes.setupIntentClientSecret;
          initOptions = {
            merchantDisplayName: 'Fixed',
            paymentIntentClientSecret: clientSecret,
            customerEphemeralKeySecret: setupRes.ephemeralKey,
            customerId: setupRes.customer,
            applePay: { merchantCountryCode: 'BE' },
            googlePay: { merchantCountryCode: 'BE', testEnv: false },
            paymentMethodOrder: ['apple_pay', 'card', 'klarna', 'revolut_pay'],
          };
        }

        const { error } = await initPaymentSheet(initOptions);
        if (!error && mountedRef.current) setPaymentReady(true);
      } catch (e: any) {
        devError('ResumePayment init error:', e);
        Alert.alert('Erreur', 'Impossible de charger la page de paiement. Veuillez réessayer.');
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/dashboard');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
  }, [id, user?.id]);

  const confirmPaymentSuccess = async (): Promise<void> => {
    let lastErr: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (!mountedRef.current) return;
      try {
        await api.payments.success(String(id));
        return;
      } catch (e: any) {
        lastErr = e;
        if (e.status === 401 || e.status === 403) break;
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
    // Paiement prélevé mais confirmation échouée → ne pas bloquer l'user
    Alert.alert(
      'Paiement reçu',
      'Votre paiement a bien été pris en compte. Si votre demande ne s\'affiche pas immédiatement, attendez quelques secondes.',
      [{ text: 'OK', onPress: () => router.replace('/(tabs)/dashboard') }],
    );
    throw lastErr;
  };

  const handlePay = async () => {
    if (!paymentReady) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPaying(true);
    try {
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') devError('Payment sheet error:', presentError.message);
        return;
      }
      await confirmPaymentSuccess();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate to missionview or scheduled based on request
      const scheduledFor = request?.scheduledFor || request?.preferredTimeStart;
      const isScheduled = scheduledFor && new Date(scheduledFor) > new Date();
      router.replace({
        pathname: isScheduled ? '/request/[id]/scheduled' : '/request/[id]/missionview',
        params: {
          id: String(id),
          serviceName: request?.serviceType || '',
          address: request?.address || '',
          price: String(request?.price || ''),
          scheduledLabel: isScheduled
            ? new Date(scheduledFor).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : 'Dès maintenant',
          lat: String(request?.lat || ''),
          lng: String(request?.lng || ''),
        },
      });
    } catch (e: any) {
      devError('ResumePayment handlePay error:', e);
    } finally {
      if (mountedRef.current) setPaying(false);
    }
  };

  const serviceName = request?.serviceType || request?.category?.name || 'Service';
  const price = request?.price ? formatEUR(parseFloat(request.price)) : null;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <GridLines />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="chevron-left" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>PAIEMENT</Text>
        <View style={{ width: 20 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.white} />
        </View>
      ) : (
        <View style={s.content}>
          {/* Icon */}
          <View style={s.iconCircle}>
            <Feather name="credit-card" size={40} color={C.white} />
          </View>

          {/* Title */}
          <Text style={s.title}>
            FINALISER{'\n'}
            <Text style={s.titleOutline}>LE PAIEMENT.</Text>
          </Text>

          <Text style={s.subtitle}>
            Votre demande est prête. Finalisez le paiement pour être mis en relation avec un prestataire.
          </Text>

          {/* Request info card */}
          <View style={s.card}>
            <View style={s.cardRow}>
              <Feather name="tool" size={15} color={C.grey} />
              <Text style={s.cardLabel}>Service</Text>
              <Text style={s.cardValue} numberOfLines={1}>{serviceName}</Text>
            </View>
            {request?.address && (
              <View style={s.cardRow}>
                <Feather name="map-pin" size={15} color={C.grey} />
                <Text style={s.cardLabel}>Adresse</Text>
                <Text style={s.cardValue} numberOfLines={1}>{request.address}</Text>
              </View>
            )}
            {price && (
              <View style={[s.cardRow, s.priceRow]}>
                <Feather name="dollar-sign" size={15} color={C.white} />
                <Text style={[s.cardLabel, { color: C.white }]}>Montant</Text>
                <Text style={s.priceValue}>{price}</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={s.infoCard}>
            <Feather name="shield" size={16} color={C.grey} style={{ marginTop: 1 }} />
            <Text style={s.infoText}>
              Paiement sécurisé via Stripe. Votre prestataire sera notifié immédiatement après confirmation.
            </Text>
          </View>
        </View>
      )}

      {/* Footer CTA */}
      {!loading && (
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.btnPrimary, (!paymentReady || paying) && s.btnDisabled]}
            onPress={handlePay}
            disabled={!paymentReady || paying}
            activeOpacity={0.9}
          >
            {paying ? (
              <ActivityIndicator size="small" color={C.bg} />
            ) : !paymentReady ? (
              <>
                <ActivityIndicator size="small" color={C.bg} />
                <Text style={s.btnPrimaryText}>CHARGEMENT...</Text>
              </>
            ) : (
              <>
                <Text style={s.btnPrimaryText}>PAYER MAINTENANT</Text>
                <View style={s.arrowPill}>
                  <Feather name="arrow-right" size={14} color={C.white} />
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 48 : 28, paddingBottom: 10,
    zIndex: 2,
  },
  headerTitle: { fontFamily: FONTS.bebas, fontSize: 18, color: C.white, letterSpacing: 2 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  content: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 18, gap: 12, zIndex: 2,
  },

  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },

  title: {
    fontFamily: FONTS.bebas, fontSize: 30, color: C.white,
    letterSpacing: 1, lineHeight: 34, textAlign: 'center',
  },
  titleOutline: { color: 'rgba(255,255,255,0.3)' },

  subtitle: {
    fontFamily: FONTS.sansLight, fontSize: 13, color: C.grey,
    textAlign: 'center', lineHeight: 19, paddingHorizontal: 4,
  },

  card: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, width: '100%', gap: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardLabel: { fontFamily: FONTS.sans, fontSize: 12, color: C.grey, width: 56 },
  cardValue: { fontFamily: FONTS.sansMedium, fontSize: 13, color: C.white, flex: 1 },
  priceRow: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10, marginTop: 2 },
  priceValue: { fontFamily: FONTS.bebas, fontSize: 22, color: C.white, flex: 1, letterSpacing: 0.5 },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 12, width: '100%',
  },
  infoText: {
    flex: 1, fontFamily: FONTS.sansLight, fontSize: 12,
    lineHeight: 17, color: 'rgba(255,255,255,0.45)',
  },

  footer: {
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    zIndex: 2,
  },
  btnPrimary: {
    width: '100%', height: 52, backgroundColor: C.white, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: {
    fontFamily: FONTS.bebas, fontSize: 18, letterSpacing: 2.5, color: C.bg,
  },
  arrowPill: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
  },
});
