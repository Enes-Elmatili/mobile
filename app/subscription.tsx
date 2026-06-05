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
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/lib/api';
import { showSocketToast } from '@/lib/SocketContext';
import { feedback } from '@/lib/feedback/feedback';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

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
    priceLabelKey: 'ext.subscription_starter_price',
    priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_STARTER || '',
    featureKeys: [
      'ext.subscription_starter_f1',
      'ext.subscription_starter_f2',
      'ext.subscription_starter_f3',
    ],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 24.99,
    priceLabelKey: 'ext.subscription_pro_price',
    priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_PRO || '',
    featureKeys: [
      'ext.subscription_pro_f1',
      'ext.subscription_pro_f2',
      'ext.subscription_pro_f3',
      'ext.subscription_pro_f4',
    ],
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: 59.99,
    priceLabelKey: 'ext.subscription_business_price',
    priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_BUSINESS || '',
    featureKeys: [
      'ext.subscription_business_f1',
      'ext.subscription_business_f2',
      'ext.subscription_business_f3',
      'ext.subscription_business_f4',
    ],
    highlight: false,
  },
];

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const isActive = status === 'ACTIVE';
  return (
    <View style={[
      chip.wrap,
      { backgroundColor: isActive ? theme.badgeDoneBg : theme.surface },
    ]}>
      <View style={[
        chip.dot,
        { backgroundColor: isActive ? COLORS.green : theme.textMuted },
      ]} />
      <Text style={[
        chip.text,
        { color: isActive ? COLORS.green : theme.textMuted, fontFamily: FONTS.sansMedium },
      ]}>
        {isActive ? t('ext.subscription_active') : status === 'CANCELLED' ? t('ext.subscription_cancelled_state') : t('ext.subscription_pending')}
      </Text>
    </View>
  );
}

const chip = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12 },
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
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={[
      pl.card,
      { backgroundColor: theme.cardBg, borderColor: theme.border, shadowOpacity: theme.shadowOpacity },
      plan.highlight && { backgroundColor: theme.accent, borderColor: theme.accent },
      isCurrent && { borderColor: theme.accent, borderWidth: 2 },
    ]}>
      {plan.highlight && !isCurrent && (
        <View style={[pl.badge, { backgroundColor: theme.accent }]}>
          <Text style={[pl.badgeText, { color: theme.accentText, fontFamily: FONTS.mono }]}>{t('ext.subscription_recommended')}</Text>
        </View>
      )}
      {isCurrent && (
        <View style={[pl.badge, { backgroundColor: theme.textSub }]}>
          <Text style={[pl.badgeText, { fontFamily: FONTS.mono }]}>{t('ext.subscription_current_plan')}</Text>
        </View>
      )}
      <View style={pl.top}>
        <Text style={[pl.name, { color: plan.highlight ? theme.accentText : theme.textAlt, fontFamily: FONTS.bebas }]}>
          {plan.name}
        </Text>
        <Text style={[pl.price, { color: plan.highlight ? theme.heroSub : theme.textMuted, fontFamily: FONTS.bebas }]}>
          {t(plan.priceLabelKey)}
        </Text>
      </View>
      <View style={pl.features}>
        {plan.featureKeys.map((k, i) => (
          <View key={i} style={pl.featureRow}>
            <Feather name="check-circle" size={14} color={plan.highlight ? theme.accentText : COLORS.green} />
            <Text style={[pl.featureText, { color: plan.highlight ? theme.heroText : theme.textSub, fontFamily: FONTS.sans }]}>
              {t(k)}
            </Text>
          </View>
        ))}
      </View>
      {!isCurrent && (
        <TouchableOpacity
          style={[
            pl.btn,
            { backgroundColor: plan.highlight ? theme.accentText : theme.accent },
            loading && pl.btnDisabled,
          ]}
          onPress={() => onSubscribe(plan.priceId)}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={plan.highlight ? theme.accent : theme.accentText} />
          ) : (
            <Text style={[pl.btnText, { color: plan.highlight ? theme.accent : theme.accentText, fontFamily: FONTS.sansMedium }]}>
              {t('ext.subscription_subscribe')}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const pl = StyleSheet.create({
  card: {
    borderRadius: 18, padding: 20,
    marginBottom: 12, gap: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  badge: {
    position: 'absolute', top: -10, right: 16,
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  top:  { gap: 4, marginTop: 8 },
  name: { fontSize: 20 },
  price: { fontSize: 14 },
  features: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, flex: 1 },
  btn: {
    borderRadius: 13,
    paddingVertical: 13, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 15 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useAppTheme();

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
      showSocketToast(t('ext.subscription_unavailable'), 'error');
      return;
    }
    setSubscribing(true);
    try {
      const res: any = await api.post('/subscription/create-checkout-session', {
        priceId,
        userId: user?.id,
      });
      const { url } = res?.data ?? res;
      if (!url) throw new Error(t('ext.subscription_url_missing'));
      await WebBrowser.openBrowserAsync(url);
      // Rafraîchir après retour
      await loadSubscription();
    } catch (e: any) {
      showSocketToast(e?.message || t('subscription.stripe_error'), 'error');
    } finally {
      setSubscribing(false);
    }
  }, [user?.id, t, loadSubscription]);

  const handleCancel = useCallback(async () => {
    if (!subscription?.id) return;
    const ok = await feedback.confirm({
      titleKey: 'subscription.cancel_title',
      messageKey: 'subscription.cancel_confirm',
      confirmKey: 'subscription.cancel_confirm_btn',
      cancelKey: 'common.cancel',
      destructive: true,
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await api.delete(`/subscription/${subscription.id}`);
      showSocketToast(t('subscription.cancelled_msg'), 'success');
      setSubscription(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
    } catch (e: any) {
      showSocketToast(e?.message || t('common.error'), 'error');
    } finally {
      setCancelling(false);
    }
  }, [subscription?.id, t]);

  if (loading) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  const currentPlanName = subscription?.planName?.toLowerCase() || null;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.surface }]}
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('profile.subscription')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Current plan summary */}
        {subscription ? (
          <View style={[s.currentCard, { backgroundColor: theme.cardBg, borderColor: theme.border, shadowOpacity: theme.shadowOpacity }]}>
            <View style={s.currentRow}>
              <View>
                <Text style={[s.currentLabel, { color: theme.textMuted, fontFamily: FONTS.mono }]}>{t('ext.subscription_actual')}</Text>
                <Text style={[s.currentPlan, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>{subscription.planName}</Text>
              </View>
              <StatusChip status={subscription.status} />
            </View>
            <View style={s.currentMeta}>
              <Text style={[s.currentMetaText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                {t('ext.subscription_since')} {new Date(subscription.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
              {subscription.endDate && (
                <Text style={[s.currentMetaText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                  {t('ext.subscription_end')} {new Date(subscription.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              )}
            </View>
            {subscription.status === 'ACTIVE' && (
              <TouchableOpacity
                style={[s.cancelBtn, { borderColor: theme.isDark ? 'rgba(220,38,38,0.3)' : 'rgba(220,38,38,0.2)' }]}
                onPress={handleCancel}
                disabled={cancelling}
                activeOpacity={0.7}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color={theme.danger} />
                  : <Text style={[s.cancelBtnText, { color: theme.danger, fontFamily: FONTS.sansMedium }]}>{t('subscription.cancel_btn')}</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={[s.noPlanCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Feather name="credit-card" size={36} color={theme.textVeryMuted} />
            <Text style={[s.noPlanTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('ext.subscription_no_active')}</Text>
            <Text style={[s.noPlanSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{t('ext.subscription_no_active_sub')}</Text>
          </View>
        )}

        <Text style={[s.plansTitle, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>{t('ext.subscription_our_plans')}</Text>

        {PLANS.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={currentPlanName === plan.name.toLowerCase()}
            onSubscribe={handleSubscribe}
            loading={subscribing}
          />
        ))}

        <Text style={[s.legal, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
          {t('ext.subscription_legal_prefix')} {' '}
          <Text style={[s.legalLink, { color: theme.textSub, fontFamily: FONTS.sansMedium }]} onPress={() => router.push('/settings/cgu' as any)}>
            {t('ext.subscription_legal_link')}
          </Text>
          {t('ext.subscription_legal_suffix')}
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17 },

  scroll: { padding: 16, gap: 4, paddingBottom: 48 },

  currentCard: {
    borderRadius: 18, padding: 20,
    gap: 12, marginBottom: 20,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  currentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currentLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  currentPlan: { fontSize: 22 },
  currentMeta: { gap: 3 },
  currentMetaText: { fontSize: 13 },
  cancelBtn: {
    borderWidth: 1, borderRadius: 13,
    paddingVertical: 10, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14 },

  noPlanCard: {
    borderRadius: 18, padding: 24,
    alignItems: 'center', gap: 8, marginBottom: 20,
    borderWidth: 1,
  },
  noPlanTitle: { fontSize: 16 },
  noPlanSub: { fontSize: 13, textAlign: 'center' },

  plansTitle: { fontSize: 15, marginBottom: 8, paddingHorizontal: 4 },

  legal: { fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  legalLink: { fontSize: 12 },
});
