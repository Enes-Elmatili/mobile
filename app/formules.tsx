// app/formules.tsx — Écran « Ma formule » PRESTATAIRE (lecture seule, graphite premium).
//
// DÉCISION D'AFFICHAGE PILOTÉE PAR LE SERVEUR (réveil sans rebuild) :
//   GET /subscriptions/config → { subscriptionsEnabled, availableTiers }
//     - subscriptionsEnabled=false → on n'affiche QUE la carte Découverte. AUCUN
//       bouton d'achat, AUCUNE mention des paliers payants (exigence review App Store :
//       zéro élément d'achat visible dans le binaire iOS au lancement).
//     - subscriptionsEnabled=true  → la section TierUpgradeSection (paliers + CTA Stripe)
//       se rend EN PLUS — code présent mais CONDITIONNEL. Passer SUBSCRIPTIONS_ENABLED=true
//       côté serveur suffit à la faire apparaître, sans republier l'app.
//   GET /subscriptions/me → plan courant + promoZeroMissionsRemaining (offre 0%).
//   GET /tiers → données d'affichage des paliers (zéro grille en dur).
//
// SOURCE UNIQUE COULEURS : tokens GRAPHITE de @/hooks/use-app-theme (zéro hex en dur).
// SOURCE UNIQUE TEXTES   : i18n (namespace formules.*) — FR/NL/EN. Haptics via feedback.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Animated, Easing, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useStripe } from '@stripe/stripe-react-native';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { feedback } from '@/lib/feedback/feedback';
import { formatEURCents } from '@/lib/format';
import { FONTS, GRAPHITE as G } from '@/hooks/use-app-theme';

const A165 = { start: { x: 0.15, y: 0 }, end: { x: 0.85, y: 1 } };
const A180 = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
const AHORIZ = { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };

interface Tier {
  tier: string; label: string; monthlyPriceCents: number; commissionRate: number;
  missionCap: number | null; recommended: boolean; order: number; perks: string[];
}
interface TiersResponse { subscriptionsEnabled: boolean; currentTier: string | null; tiers: Tier[]; }
interface SubConfig { subscriptionsEnabled: boolean; availableTiers: string[]; }
interface SubMe { tier: string; status: string; currentPeriodEnd: string | null; promoZeroMissionsRemaining: number; }

// Palier gratuit de repli (résilience si /tiers est indisponible) — le taux réel
// provient normalement du serveur ; ce défaut n'apparaît qu'en cas d'échec réseau.
const DECOUVERTE_FALLBACK: Tier = {
  tier: 'DECOUVERTE', label: 'Découverte', monthlyPriceCents: 0,
  commissionRate: 0.20, missionCap: null, recommended: false, order: 0, perks: [],
};

const ratePct = (rate: number) => Math.round(rate * 100);
// Formatage monétaire unifié via lib/format (plus de toFixed inline).
const euros = (cents: number) => formatEURCents(cents);

function GradientRule() {
  return <LinearGradient colors={['transparent', G.border, 'transparent']} start={AHORIZ.start} end={AHORIZ.end} style={s.rule} />;
}

// ── Skeleton (carte unique, layout vertical) ────────────────────────────────────
function Skeleton() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={s.scrollPad}>
      <Animated.View style={[s.cardOuter, { opacity: pulse }]}>
        <LinearGradient colors={G.gradCard} start={A165.start} end={A165.end} style={[s.cardInner, { borderColor: G.border, borderWidth: 1, gap: 14 }]}>
          {[120, 90, 200, 200].map((w, k) => (
            <View key={k} style={{ width: w, height: k < 2 ? 30 : 14, borderRadius: 7, backgroundColor: G.skeleton }} />
          ))}
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ── Carte « palier actuel » (Découverte en lecture seule) ──────────────────────
function CurrentPlanCard({ tier, promoActive, showFreeExtras }: {
  tier: Tier; promoActive: boolean; showFreeExtras: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={s.cardOuter}>
      <LinearGradient colors={G.gradCard} start={A165.start} end={A165.end} style={[s.cardInner, { borderColor: G.border, borderWidth: 1 }]}>
        <View pointerEvents="none" style={[s.insetTop, { backgroundColor: G.insetTop }]} />

        <View style={s.badgeRow}>
          <View style={[s.badge, { backgroundColor: G.textPrimary }]}>
            <Text style={[s.badgeText, { color: G.onAccent, fontFamily: FONTS.mono }]}>{t('formules.current_badge').toUpperCase()}</Text>
          </View>
        </View>

        <Text style={[s.tierLabel, { color: G.textPrimary, fontFamily: FONTS.bebas }]}>{tier.label}</Text>
        <View style={s.priceRow}>
          <Text style={[s.price, { color: G.textPrimary, fontFamily: FONTS.bebas }]}>
            {tier.monthlyPriceCents === 0 ? t('formules.free') : euros(tier.monthlyPriceCents)}
          </Text>
          {tier.monthlyPriceCents > 0 && (
            <Text style={[s.priceSuffix, { color: G.textMuted, fontFamily: FONTS.sans }]}>{t('formules.per_month')}</Text>
          )}
        </View>

        <GradientRule />
        <View style={s.factRow}>
          <Feather name="percent" size={14} color={promoActive ? G.textMuted : G.greenLight} />
          <Text style={[s.factText, { color: G.textSecondary, fontFamily: FONTS.sansMedium }, promoActive && s.struck]}>
            {t('formules.commission_rate', { rate: ratePct(tier.commissionRate) })}
          </Text>
        </View>
        <View style={s.factRow}>
          <Feather name="briefcase" size={14} color={G.textMuted} />
          <Text style={[s.factText, { color: G.textSecondary, fontFamily: FONTS.sansMedium }]}>
            {tier.missionCap === null ? t('formules.unlimited_missions') : t('formules.missions_per_month', { cap: tier.missionCap })}
          </Text>
        </View>

        {showFreeExtras && (
          <>
            <GradientRule />
            <View style={s.perks}>
              {[t('formules.perk_payout_weekly'), t('formules.perk_support_standard')].map((p, i) => (
                <View key={i} style={s.perkRow}>
                  <Feather name="check" size={15} color={G.green} />
                  <Text style={[s.perkText, { color: G.textSecondary, fontFamily: FONTS.sans }]}>{p}</Text>
                </View>
              ))}
            </View>
            <View style={s.note}>
              <Feather name="info" size={14} color={G.textMuted} />
              <Text style={[s.noteText, { color: G.textMuted, fontFamily: FONTS.sans }]}>{t('formules.free_note')}</Text>
            </View>
          </>
        )}
      </LinearGradient>
    </View>
  );
}

// ── Bannière promo « offre de lancement » (0% commission) ──────────────────────
function PromoBanner({ remaining, nominalPct }: { remaining: number; nominalPct: number }) {
  const { t } = useTranslation();
  return (
    <>
      <LinearGradient colors={G.gradProCard} start={A165.start} end={A165.end} style={[s.promo, { borderColor: G.promoBorder }]}>
        <View style={s.promoTop}>
          <View style={[s.promoChip, { backgroundColor: G.promoChipBg, borderColor: G.promoChipBorder }]}>
            <Feather name="gift" size={18} color={G.greenLight} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.promoTitle, { color: G.greenLight, fontFamily: FONTS.bebas }]}>{t('formules.promo_title')}</Text>
            <Text style={[s.promoSub, { color: G.green, fontFamily: FONTS.mono }]}>{t('formules.promo_subtitle').toUpperCase()}</Text>
          </View>
        </View>
        <Text style={[s.promoBody, { color: G.textSecondary, fontFamily: FONTS.sans }]}>{t('formules.promo_body')}</Text>
        <View style={[s.promoCount, { borderTopColor: G.promoDivider }]}>
          <Feather name="clock" size={15} color={G.greenLight} />
          <Text style={[s.promoCountText, { color: G.textPrimary, fontFamily: FONTS.sansMedium }]}>
            {t('formules.promo_remaining', { count: remaining })}
          </Text>
        </View>
      </LinearGradient>
      <View style={[s.note, s.notePad]}>
        <Feather name="info" size={14} color={G.textMuted} />
        <Text style={[s.noteText, { color: G.textMuted, fontFamily: FONTS.sans }]}>{t('formules.promo_footer', { rate: nominalPct })}</Text>
      </View>
    </>
  );
}

// ── TierUpgradeSection — rendu UNIQUEMENT si subscriptionsEnabled=true ──────────
function UpgradeCard({ tier, onChoose, choosing }: { tier: Tier; onChoose: (t: string) => void; choosing: boolean }) {
  const { t } = useTranslation();
  const pro = tier.recommended;

  const Body = (
    <>
      <View style={s.upTop}>
        <View style={{ flex: 1 }}>
          {pro && (
            <LinearGradient colors={G.gradCta} start={A180.start} end={A180.end} style={s.upBadge}>
              <Text style={[s.badgeText, { color: G.onAccent, fontFamily: FONTS.mono }]}>{t('formules.recommended_badge').toUpperCase()}</Text>
            </LinearGradient>
          )}
          <Text style={[s.upName, { color: G.textPrimary, fontFamily: FONTS.bebas }]}>{tier.label}</Text>
        </View>
        <View style={s.priceRow}>
          <Text style={[s.upPrice, { color: G.textPrimary, fontFamily: FONTS.bebas }]}>{euros(tier.monthlyPriceCents)}</Text>
          <Text style={[s.priceSuffix, { color: G.textMuted, fontFamily: FONTS.sans }]}>{t('formules.per_month')}</Text>
        </View>
      </View>

      <View style={[s.factRow, { paddingVertical: 4 }]}>
        <Feather name="percent" size={13} color={G.greenLight} />
        <Text style={[s.factText, { color: G.green, fontFamily: FONTS.sansMedium }]}>{t('formules.commission_rate', { rate: ratePct(tier.commissionRate) })}</Text>
      </View>

      {tier.perks.length > 0 && (
        <View style={[s.perks, { marginTop: 6 }]}>
          {tier.perks.map((p, i) => (
            <View key={i} style={s.perkRow}>
              <Feather name="check" size={14} color={G.green} />
              <Text style={[s.perkText, { color: G.textSecondary, fontFamily: FONTS.sans }]}>{p}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity activeOpacity={0.85} style={s.ctaWrap} disabled={choosing} onPress={() => { feedback.haptic('light'); onChoose(tier.tier); }}>
        <LinearGradient colors={G.gradCta} start={A180.start} end={A180.end} style={s.cta}>
          {choosing
            ? <ActivityIndicator color={G.onAccent} />
            : <Text style={[s.ctaText, { color: G.onAccent, fontFamily: FONTS.sansMedium }]}>{t('formules.cta_choose', { label: tier.label })}</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </>
  );

  return pro ? (
    <LinearGradient colors={G.gradProBorder} start={A165.start} end={A165.end} style={s.upOuterPro}>
      <LinearGradient colors={G.gradProCard} start={A165.start} end={A165.end} style={[s.cardInner, s.upInner]}>{Body}</LinearGradient>
    </LinearGradient>
  ) : (
    <View style={[s.cardOuter, s.upOuter]}>
      <LinearGradient colors={G.gradCard} start={A165.start} end={A165.end} style={[s.cardInner, s.upInner, { borderColor: G.border, borderWidth: 1 }]}>{Body}</LinearGradient>
    </View>
  );
}

// ── Écran ─────────────────────────────────────────────────────────────────────
export default function FormulesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [config, setConfig] = useState<SubConfig | null>(null);
  const [me, setMe] = useState<SubMe | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [choosingTier, setChoosingTier] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const unwrap = (r: any) => r?.data ?? r;
      const [cfg, meRes, tiersRes] = await Promise.all([
        api.get<SubConfig>('/subscriptions/config').then(unwrap),
        api.get<SubMe>('/subscriptions/me').then(unwrap),
        api.get<TiersResponse>('/tiers').then(unwrap).catch(() => null),
      ]);
      setConfig(cfg);
      setMe(meRes);
      setTiers(tiersRes?.tiers ?? []);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Souscription d'un palier (état C uniquement) — Stripe PaymentSheet natif. Le
  // backend crée une Subscription `default_incomplete` ; au paiement, le webhook pose
  // le palier ACTIF (asynchrone) → on rafraîchit /subscriptions/me + /tiers.
  const handleChoose = useCallback(async (tier: string) => {
    if (choosingTier) return;
    setChoosingTier(tier);
    try {
      const res: any = await api.subscription.createSubscription(tier);
      if (!res?.paymentIntentClientSecret) throw new Error(t('formules.subscribe_error'));

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Fixed',
        paymentIntentClientSecret: res.paymentIntentClientSecret,
        customerEphemeralKeySecret: res.ephemeralKey,
        customerId: res.customerId,
        applePay: { merchantCountryCode: 'BE' },
        googlePay: { merchantCountryCode: 'BE', testEnv: false },
      });
      if (initError) throw new Error(initError.message);

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') feedback.error(presentError.message);
        return;
      }
      feedback.success(t('formules.subscribe_success'));
      await load();
    } catch (e: any) {
      feedback.error(e?.message || t('formules.subscribe_error'));
    } finally {
      setChoosingTier(null);
    }
  }, [choosingTier, load, initPaymentSheet, presentPaymentSheet, t]);

  const subscriptionsEnabled = config?.subscriptionsEnabled ?? false;
  const currentTierKey = me?.tier ?? 'DECOUVERTE';
  const currentTier = tiers.find((x) => x.tier === currentTierKey) ?? DECOUVERTE_FALLBACK;
  const promoRemaining = me?.promoZeroMissionsRemaining ?? 0;
  const promoActive = promoRemaining > 0;
  const availableTiers = config?.availableTiers ?? [];
  const paidTiers = tiers
    .filter((x) => x.tier !== currentTierKey && availableTiers.includes(x.tier))
    .sort((a, b) => a.order - b.order);

  return (
    <View style={s.root}>
      <LinearGradient colors={G.gradBg} start={A180.start} end={A180.end} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" />

        <View style={[s.header, { borderBottomColor: G.border }]}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: G.scrim }]}
            onPress={() => { feedback.haptic('light'); router.canGoBack() ? router.back() : router.replace('/(tabs)/provider-dashboard' as any); }}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={G.textPrimary} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: G.textPrimary, fontFamily: FONTS.bebas }]}>{t('formules.title').toUpperCase()}</Text>
          <View style={{ width: 38 }} />
        </View>

        {loading ? (
          <Skeleton />
        ) : error ? (
          <View style={s.center}>
            <Feather name="wifi-off" size={36} color={G.textVeryMuted} />
            <Text style={[s.errorTitle, { color: G.textPrimary, fontFamily: FONTS.sansMedium }]}>{t('formules.load_error')}</Text>
            <TouchableOpacity activeOpacity={0.85} style={s.ctaWrap} onPress={() => { feedback.haptic('light'); load(); }}>
              <LinearGradient colors={G.gradCta} start={A180.start} end={A180.end} style={[s.cta, s.retry]}>
                <Feather name="refresh-cw" size={15} color={G.onAccent} />
                <Text style={[s.ctaText, { color: G.onAccent, fontFamily: FONTS.sansMedium }]}>{t('formules.retry')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>
            {/* Bandeau d'accroche — uniquement quand les paliers payants sont actifs. */}
            {subscriptionsEnabled && (
              <View style={s.banner}>
                <Text style={[s.bannerTitle, { color: G.textPrimary, fontFamily: FONTS.bebas }]}>{t('formules.banner_title')}</Text>
                <Text style={[s.bannerSub, { color: G.textMuted, fontFamily: FONTS.sans }]}>{t('formules.banner_sub')}</Text>
              </View>
            )}

            {/* Carte du palier actuel (toujours affichée). Les extras du palier gratuit
                (perks + note) n'apparaissent qu'à l'état pur « gratuit, sans promo ». */}
            <CurrentPlanCard tier={currentTier} promoActive={promoActive} showFreeExtras={!subscriptionsEnabled && !promoActive} />

            {/* Offre de lancement 0% — uniquement si un crédit promo est actif. */}
            {promoActive && <PromoBanner remaining={promoRemaining} nominalPct={ratePct(currentTier.commissionRate)} />}

            {/* Bloc tiers payants — code présent mais CONDITIONNEL au flag serveur. */}
            {subscriptionsEnabled && paidTiers.length > 0 && (
              <>
                <Text style={[s.upTitle, { color: G.textMuted, fontFamily: FONTS.bebas }]}>{t('formules.upgrade_title').toUpperCase()}</Text>
                {paidTiers.map((tier) => (
                  <UpgradeCard key={tier.tier} tier={tier} onChoose={handleChoose} choosing={choosingTier === tier.tier} />
                ))}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.gradBg[2] },
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, letterSpacing: 1.5 },

  scrollPad: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36 },

  banner: { paddingHorizontal: 4, paddingBottom: 16, gap: 5 },
  bannerTitle: { fontSize: 30, letterSpacing: 0.5, lineHeight: 32 },
  bannerSub: { fontSize: 14, lineHeight: 19 },

  cardOuter: {
    borderRadius: 22,
    ...Platform.select({
      ios: { shadowColor: G.shadow, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 5 },
    }),
  },
  cardInner: { borderRadius: 22, padding: 22, gap: 12, overflow: 'hidden' },
  insetTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },

  badgeRow: { flexDirection: 'row', gap: 8, minHeight: 22 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, letterSpacing: 0.5 },

  tierLabel: { fontSize: 31, letterSpacing: 0.5 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  price: { fontSize: 34 },
  priceSuffix: { fontSize: 14, marginBottom: 6 },

  rule: { height: 1, width: '100%' },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  factText: { fontSize: 14 },
  struck: { textDecorationLine: 'line-through', color: G.textMuted },

  perks: { gap: 10, marginTop: 4 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  perkText: { fontSize: 13.5, flex: 1 },

  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14 },
  notePad: { paddingHorizontal: 4 },
  noteText: { fontSize: 12.5, lineHeight: 18, flex: 1 },

  // Promo
  promo: { borderRadius: 20, padding: 18, marginTop: 16, borderWidth: 1, overflow: 'hidden' },
  promoTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promoChip: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  promoTitle: { fontSize: 24, letterSpacing: 0.5, lineHeight: 26 },
  promoSub: { fontSize: 10, letterSpacing: 1, marginTop: 3 },
  promoBody: { fontSize: 13.5, lineHeight: 19, marginTop: 13 },
  promoCount: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 13, borderTopWidth: 1 },
  promoCountText: { fontSize: 14 },

  // Upgrade section
  upTitle: { fontSize: 14, letterSpacing: 1.4, marginTop: 24, marginBottom: 14, marginLeft: 4 },
  upOuterPro: {
    borderRadius: 22, padding: 2, marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: G.gradProBorder[2], shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 8 },
    }),
  },
  upOuter: { marginBottom: 12 },
  upInner: { padding: 18, gap: 8 },
  upTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  upBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 8 },
  upName: { fontSize: 24, letterSpacing: 0.5 },
  upPrice: { fontSize: 22 },

  ctaWrap: { marginTop: 8 },
  cta: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 15 },
  retry: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 12 },

  errorTitle: { fontSize: 16, textAlign: 'center' },
});
