// app/request/[id]/resume-payment.tsx
// Reprendre le paiement d'une demande PENDING_PAYMENT existante
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Platform,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line } from 'react-native-svg';
import { Dimensions } from 'react-native';
import { api } from '@/lib/api';
import { FONTS } from '@/hooks/use-app-theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { devError } from '@/lib/logger';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const GRID_SIZE = 40;

const C = {
  bg: '#0A0A0A',
  white: '#FAFAFA',
  grey: '#888888',
  border: 'rgba(255,255,255,0.08)',
  cardBg: '#141414',
  amber: '#E8783A',
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

        // Init Stripe payment sheet — quote flow uses callout endpoint
        const isQuoteFlow = req.pricingMode === 'estimate' || req.pricingMode === 'diagnostic';
        let clientSecret: string | undefined;
        let ephemeralKey: string | undefined;
        let customer: string | undefined;

        if (isQuoteFlow) {
          const calloutRes = await api.post('/quotes/callout-payment', { requestId: String(id) });
          if (!mountedRef.current) return;
          clientSecret = calloutRes.clientSecret;
        } else {
          const intentRes = await api.payments.intent(String(id));
          if (!mountedRef.current) return;
          clientSecret = intentRes.paymentIntent;
          ephemeralKey = intentRes.ephemeralKey;
          customer = intentRes.customer;
        }

        const { error } = await initPaymentSheet({
          merchantDisplayName: 'Fixed',
          paymentIntentClientSecret: clientSecret!,
          ...(ephemeralKey && { customerEphemeralKeySecret: ephemeralKey }),
          ...(customer && { customerId: customer }),
          applePay: { merchantCountryCode: 'BE' },
          googlePay: { merchantCountryCode: 'BE', testEnv: true },
        });
        if (!error && mountedRef.current) setPaymentReady(true);
      } catch (e: any) {
        devError('ResumePayment init error:', e);
        Alert.alert('Erreur', 'Impossible de charger la page de paiement. Veuillez réessayer.');
        router.back();
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
  const price = request?.price ? `${parseFloat(request.price).toFixed(2)} €` : null;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <GridLines />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.6)" />
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
            <Ionicons name="card-outline" size={40} color={C.white} />
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
              <Ionicons name="construct-outline" size={15} color={C.grey} />
              <Text style={s.cardLabel}>Service</Text>
              <Text style={s.cardValue} numberOfLines={1}>{serviceName}</Text>
            </View>
            {request?.address && (
              <View style={s.cardRow}>
                <Ionicons name="location-outline" size={15} color={C.grey} />
                <Text style={s.cardLabel}>Adresse</Text>
                <Text style={s.cardValue} numberOfLines={1}>{request.address}</Text>
              </View>
            )}
            {price && (
              <View style={[s.cardRow, s.priceRow]}>
                <Ionicons name="cash-outline" size={15} color={C.white} />
                <Text style={[s.cardLabel, { color: C.white }]}>Montant</Text>
                <Text style={s.priceValue}>{price}</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={s.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={16} color={C.grey} style={{ marginTop: 1 }} />
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
                  <Ionicons name="arrow-forward" size={14} color={C.white} />
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
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16,
    zIndex: 2,
  },
  headerTitle: { fontFamily: FONTS.bebas, fontSize: 20, color: C.white, letterSpacing: 2 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  content: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 28, gap: 16, zIndex: 2,
  },

  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },

  title: {
    fontFamily: FONTS.bebas, fontSize: 36, color: C.white,
    letterSpacing: 1, lineHeight: 40, textAlign: 'center',
  },
  titleOutline: { color: 'rgba(255,255,255,0.3)' },

  subtitle: {
    fontFamily: FONTS.sansLight, fontSize: 14, color: C.grey,
    textAlign: 'center', lineHeight: 21, paddingHorizontal: 8,
  },

  card: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 20, width: '100%', gap: 14,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardLabel: { fontFamily: FONTS.sans, fontSize: 13, color: C.grey, width: 60 },
  cardValue: { fontFamily: FONTS.sansMedium, fontSize: 13, color: C.white, flex: 1 },
  priceRow: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, marginTop: 2 },
  priceValue: { fontFamily: FONTS.bebas, fontSize: 22, color: C.white, flex: 1, letterSpacing: 0.5 },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 16, width: '100%',
  },
  infoText: {
    flex: 1, fontFamily: FONTS.sansLight, fontSize: 12,
    lineHeight: 19, color: 'rgba(255,255,255,0.45)',
  },

  footer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    zIndex: 2,
  },
  btnPrimary: {
    width: '100%', height: 60, backgroundColor: C.white, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: {
    fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 3, color: C.bg,
  },
  arrowPill: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
  },
});
