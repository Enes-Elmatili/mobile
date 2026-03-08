// app/subscription.tsx — Gestion abonnement
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/lib/api';
import { showSocketToast } from '@/lib/SocketContext';
import { useAuth } from '@/lib/auth/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Subscription {
  id: string;
  planName: string;
  status: string;
  price: number;
  startDate: string;
  endDate?: string;
  stripeSubscriptionId?: string;
}

// ── Plans (catalogue statique — Stripe price IDs depuis env) ──────────────────
// En production : charger depuis GET /subscription/plans
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 9.99,
    priceLabel: '9,99 € / mois',
    priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_STARTER || '',
    features: [
      'Jusqu\'à 10 missions / mois',
      'Accès aux clients premium',
      'Paiements rapides',
    ],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 24.99,
    priceLabel: '24,99 € / mois',
    priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO || '',
    features: [
      'Missions illimitées',
      'Priorité dans les résultats',
      'Badge "Pro" sur votre profil',
      'Support dédié',
    ],
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: 59.99,
    priceLabel: '59,99 € / mois',
    priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_BUSINESS || '',
    features: [
      'Tout Pro +',
      'Tableau de bord analytique',
      'Accès API',
      'Compte manager dédié',
    ],
    highlight: false,
  },
];

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const isActive = status === 'ACTIVE';
  return (
    <View style={[chip.wrap, isActive ? chip.active : chip.inactive]}>
      <View style={[chip.dot, isActive ? chip.dotActive : chip.dotInactive]} />
      <Text style={[chip.text, isActive ? chip.textActive : chip.textInactive]}>
        {isActive ? 'Actif' : status === 'CANCELLED' ? 'Résilié' : 'En attente'}
      </Text>
    </View>
  );
}

const chip = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  active: { backgroundColor: '#F0FDF4' },
  inactive: { backgroundColor: '#F5F5F5' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: { backgroundColor: '#22C55E' },
  dotInactive: { backgroundColor: '#ADADAD' },
  text: { fontSize: 12, fontWeight: '700' },
  textActive: { color: '#15803D' },
  textInactive: { color: '#888' },
});

// ── Plan Card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isCurrent,
  onSubscribe,
  loading,
}: {
  plan: typeof PLANS[0];
  isCurrent: boolean;
  onSubscribe: (priceId: string) => void;
  loading: boolean;
}) {
  return (
    <View style={[pl.card, plan.highlight && pl.cardHighlight, isCurrent && pl.cardCurrent]}>
      {plan.highlight && !isCurrent && (
        <View style={pl.badge}>
          <Text style={pl.badgeText}>Recommandé</Text>
        </View>
      )}
      {isCurrent && (
        <View style={[pl.badge, pl.badgeCurrent]}>
          <Text style={pl.badgeText}>Plan actuel</Text>
        </View>
      )}
      <View style={pl.top}>
        <Text style={[pl.name, plan.highlight && pl.nameHighlight]}>{plan.name}</Text>
        <Text style={[pl.price, plan.highlight && pl.priceHighlight]}>{plan.priceLabel}</Text>
      </View>
      <View style={pl.features}>
        {plan.features.map((f, i) => (
          <View key={i} style={pl.featureRow}>
            <Ionicons name="checkmark-circle" size={14} color={plan.highlight ? '#FFF' : '#22C55E'} />
            <Text style={[pl.featureText, plan.highlight && pl.featureTextHighlight]}>{f}</Text>
          </View>
        ))}
      </View>
      {!isCurrent && (
        <TouchableOpacity
          style={[pl.btn, plan.highlight && pl.btnHighlight, loading && pl.btnDisabled]}
          onPress={() => onSubscribe(plan.priceId)}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={plan.highlight ? '#1A1A1A' : '#FFF'} />
          ) : (
            <Text style={[pl.btnText, plan.highlight && pl.btnTextHighlight]}>
              S'abonner
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const pl = StyleSheet.create({
  card: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 20,
    marginBottom: 12, gap: 16,
    borderWidth: 1, borderColor: '#F0F0F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  cardHighlight: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  cardCurrent: { borderColor: '#1A1A1A', borderWidth: 2 },
  badge: {
    position: 'absolute', top: -10, right: 16,
    backgroundColor: '#1A1A1A', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeCurrent: { backgroundColor: '#555' },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF', textTransform: 'uppercase', letterSpacing: 0.5 },
  top:  { gap: 4, marginTop: 8 },
  name: { fontSize: 20, fontWeight: '900', color: '#1A1A1A' },
  nameHighlight: { color: '#FFF' },
  price: { fontSize: 14, fontWeight: '600', color: '#ADADAD' },
  priceHighlight: { color: 'rgba(255,255,255,0.6)' },
  features: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: '#555', fontWeight: '500', flex: 1 },
  featureTextHighlight: { color: 'rgba(255,255,255,0.8)' },
  btn: {
    backgroundColor: '#1A1A1A', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  btnHighlight: { backgroundColor: '#FFF' },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  btnTextHighlight: { color: '#1A1A1A' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadSubscription = useCallback(async () => {
    try {
      const res: any = await api.subscription.get();
      const list = res?.data ?? res;
      const subs = Array.isArray(list) ? list : [];
      // Prendre l'abonnement actif ou le plus récent
      const active = subs.find((s: Subscription) => s.status === 'ACTIVE')
        || subs.sort((a: Subscription, b: Subscription) =>
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0]
        || null;
      setSubscription(active);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSubscription(); }, [loadSubscription]);

  const handleSubscribe = useCallback(async (priceId: string) => {
    if (!priceId) {
      showSocketToast('Plan non disponible en mode test.', 'error');
      return;
    }
    setSubscribing(true);
    try {
      const res: any = await api.post('/subscription/create-checkout-session', {
        priceId,
        userId: user?.id,
      });
      const { url } = res?.data ?? res;
      if (!url) throw new Error('URL Stripe manquante');
      await WebBrowser.openBrowserAsync(url);
      // Rafraîchir après retour
      await loadSubscription();
    } catch (e: any) {
      showSocketToast(e?.message || t('subscription.stripe_error'), 'error');
    } finally {
      setSubscribing(false);
    }
  }, [user?.id, t, loadSubscription]);

  const handleCancel = useCallback(() => {
    if (!subscription?.id) return;
    Alert.alert(
      t('subscription.cancel_title'),
      t('subscription.cancel_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('subscription.cancel_confirm_btn'),
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await api.delete(`/subscription/${subscription.id}`);
              showSocketToast(t('subscription.cancelled'), 'success');
              setSubscription(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
            } catch (e: any) {
              showSocketToast(e?.message || t('common.error'), 'error');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  }, [subscription?.id, t]);

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </SafeAreaView>
    );
  }

  const currentPlanName = subscription?.planName?.toLowerCase() || null;

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('profile.subscription')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Current plan summary */}
        {subscription ? (
          <View style={s.currentCard}>
            <View style={s.currentRow}>
              <View>
                <Text style={s.currentLabel}>Abonnement actuel</Text>
                <Text style={s.currentPlan}>{subscription.planName}</Text>
              </View>
              <StatusChip status={subscription.status} />
            </View>
            <View style={s.currentMeta}>
              <Text style={s.currentMetaText}>
                Depuis le {new Date(subscription.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
              {subscription.endDate && (
                <Text style={s.currentMetaText}>
                  Fin le {new Date(subscription.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              )}
            </View>
            {subscription.status === 'ACTIVE' && (
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={handleCancel}
                disabled={cancelling}
                activeOpacity={0.7}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color="#DC2626" />
                  : <Text style={s.cancelBtnText}>{t('subscription.cancel_btn')}</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={s.noPlanCard}>
            <Ionicons name="wallet-outline" size={36} color="#D1D5DB" />
            <Text style={s.noPlanTitle}>Aucun abonnement actif</Text>
            <Text style={s.noPlanSub}>Choisissez un plan pour accéder aux clients premium.</Text>
          </View>
        )}

        <Text style={s.plansTitle}>Nos plans</Text>

        {PLANS.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={currentPlanName === plan.name.toLowerCase()}
            onSubscribe={handleSubscribe}
            loading={subscribing}
          />
        ))}

        <Text style={s.legal}>
          En vous abonnant, vous acceptez nos {' '}
          <Text style={s.legalLink} onPress={() => router.push('/settings/cgu' as any)}>
            Conditions Générales
          </Text>
          . Les paiements sont sécurisés par Stripe.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F8F9FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },

  scroll: { padding: 16, gap: 4, paddingBottom: 48 },

  currentCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 20,
    gap: 12, marginBottom: 20,
    borderWidth: 1, borderColor: '#F0F0F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  currentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currentLabel: { fontSize: 11, fontWeight: '700', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  currentPlan: { fontSize: 22, fontWeight: '900', color: '#1A1A1A' },
  currentMeta: { gap: 3 },
  currentMetaText: { fontSize: 13, color: '#ADADAD', fontWeight: '500' },
  cancelBtn: {
    borderWidth: 1, borderColor: '#FECACA', borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },

  noPlanCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 24,
    alignItems: 'center', gap: 8, marginBottom: 20,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  noPlanTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  noPlanSub: { fontSize: 13, color: '#ADADAD', textAlign: 'center' },

  plansTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A', marginBottom: 8, paddingHorizontal: 4 },

  legal: { fontSize: 12, color: '#ADADAD', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  legalLink: { color: '#555', fontWeight: '600' },
});
