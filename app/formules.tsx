// app/formules.tsx — Écran "Formules" PRESTATAIRE (graphite premium, carrousel animé).
//
// SOURCE UNIQUE DONNÉES : GET /api/tiers (zéro grille en dur).
// SOURCE UNIQUE COULEURS : tokens GRAPHITE de @/hooks/use-app-theme (zéro hex en dur).
// Carrousel scroll-driven : la carte CENTRÉE est mise en avant (scale + halo + opacité
// pleine), les voisines s'effacent → chaque palier devient désirable à son tour (pas
// seulement Pro). Haptics via le moteur feedback (jamais Haptics en direct).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  StatusBar, Dimensions, Animated, Easing, Platform, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { api } from '@/lib/api';
import { feedback } from '@/lib/feedback/feedback';
import { FONTS, GRAPHITE as G } from '@/hooks/use-app-theme';

// Permet à la session Checkout de se terminer proprement au retour deep-link.
WebBrowser.maybeCompleteAuthSession();

const A165 = { start: { x: 0.15, y: 0 }, end: { x: 0.85, y: 1 } };
const A180 = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
const AHORIZ = { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };

interface Tier {
  tier: string; label: string; monthlyPriceCents: number; commissionRate: number;
  missionCap: number | null; recommended: boolean; order: number; perks: string[];
}
interface TiersResponse { subscriptionsEnabled: boolean; currentTier: string | null; tiers: Tier[]; }

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 48, 360);
const CARD_GAP = 16;
const ITEM = CARD_W + CARD_GAP;

const priceLabel = (cents: number) => (cents === 0 ? 'Gratuit' : `${(cents / 100).toFixed(2).replace('.', ',')} €`);
const commissionLabel = (rate: number) => `${Math.round(rate * 100)} % de commission`;
const capLabel = (cap: number | null) => (cap === null ? 'Missions illimitées' : `${cap} missions / mois`);

function GradientRule() {
  return <LinearGradient colors={['transparent', G.border, 'transparent']} start={AHORIZ.start} end={AHORIZ.end} style={s.rule} />;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
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
    <View style={s.carouselRow}>
      {[0, 1].map((i) => (
        <Animated.View key={i} style={[s.cardOuter, { width: CARD_W, opacity: pulse }]}>
          <LinearGradient colors={G.gradCard} start={A165.start} end={A165.end} style={[s.cardInner, { borderColor: G.border, borderWidth: 1, gap: 14 }]}>
            {[120, 90, 200, 200, 200].map((w, k) => (
              <View key={k} style={{ width: w, height: k < 2 ? 30 : 14, borderRadius: 7, backgroundColor: G.skeleton }} />
            ))}
          </LinearGradient>
        </Animated.View>
      ))}
    </View>
  );
}

// ── Carte palier ──────────────────────────────────────────────────────────────
// haloOpacity : Animated.Value pilotée par le scroll → le halo glow apparaît quand
// la carte est centrée (vaut pour TOUTES les cartes, pas seulement Pro).
function TierCard({ tier, isCurrent, subscriptionsEnabled, haloOpacity, onChoose, choosing }: {
  tier: Tier; isCurrent: boolean; subscriptionsEnabled: boolean;
  haloOpacity: Animated.AnimatedInterpolation<number>;
  onChoose: (tier: string) => void; choosing: boolean;
}) {
  const pro = tier.recommended;

  const Body = (
    <>
      <View pointerEvents="none" style={[s.insetTop, { backgroundColor: G.insetTop }]} />

      <View style={s.badgeRow}>
        {pro && (
          <LinearGradient colors={G.gradCta} start={A180.start} end={A180.end} style={s.badge}>
            <Text style={[s.badgeText, { color: G.onAccent, fontFamily: FONTS.mono }]}>RECOMMANDÉ</Text>
          </LinearGradient>
        )}
        {isCurrent && (
          <View style={[s.badge, { backgroundColor: G.textPrimary }]}>
            <Text style={[s.badgeText, { color: G.onAccent, fontFamily: FONTS.mono }]}>PALIER ACTUEL</Text>
          </View>
        )}
      </View>

      <Text style={[s.tierLabel, { color: G.textPrimary, fontFamily: FONTS.bebas }]}>{tier.label}</Text>
      <View style={s.priceRow}>
        <Text style={[s.price, { color: G.textPrimary, fontFamily: FONTS.bebas }]}>{priceLabel(tier.monthlyPriceCents)}</Text>
        {tier.monthlyPriceCents > 0 && <Text style={[s.priceSuffix, { color: G.textMuted, fontFamily: FONTS.sans }]}>/ mois</Text>}
      </View>

      <GradientRule />
      <View style={s.factRow}>
        <Feather name="percent" size={14} color={G.greenLight} />
        <Text style={[s.factText, { color: G.textSecondary, fontFamily: FONTS.sansMedium }]}>{commissionLabel(tier.commissionRate)}</Text>
      </View>
      <View style={s.factRow}>
        <Feather name="briefcase" size={14} color={G.textMuted} />
        <Text style={[s.factText, { color: G.textSecondary, fontFamily: FONTS.sansMedium }]}>{capLabel(tier.missionCap)}</Text>
      </View>
      <GradientRule />

      <View style={s.perks}>
        {tier.perks.map((p, i) => (
          <View key={i} style={s.perkRow}>
            <Feather name="check" size={15} color={G.green} />
            <Text style={[s.perkText, { color: G.textSecondary, fontFamily: FONTS.sans }]}>{p}</Text>
          </View>
        ))}
      </View>

      {subscriptionsEnabled ? (
        !isCurrent ? (
          <TouchableOpacity
            activeOpacity={0.85}
            style={s.ctaWrap}
            disabled={choosing}
            onPress={() => { feedback.haptic('light'); onChoose(tier.tier); }}
          >
            <LinearGradient colors={G.gradCta} start={A180.start} end={A180.end} style={s.cta}>
              {choosing ? (
                <ActivityIndicator color={G.onAccent} />
              ) : (
                <Text style={[s.ctaText, { color: G.onAccent, fontFamily: FONTS.sansMedium }]}>Choisir {tier.label}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={[s.cta, s.ctaGhost, { borderColor: G.border }]}>
            <Text style={[s.ctaText, { color: G.textMuted, fontFamily: FONTS.sansMedium }]}>Votre formule</Text>
          </View>
        )
      ) : (
        <View style={[s.cta, s.ctaGhost, { borderColor: G.border }]}>
          <Text style={[s.ctaText, { color: G.textMuted, fontFamily: FONTS.sansMedium }]}>Bientôt disponible</Text>
        </View>
      )}
    </>
  );

  return (
    <View style={{ width: CARD_W }}>
      {/* Halo radial qui suit le focus (toutes les cartes) */}
      <Animated.View style={[s.halo, { opacity: haloOpacity }]} pointerEvents="none">
        <Svg width={'100%' as any} height={'100%' as any}>
          <Defs>
            <RadialGradient id={`halo-${tier.tier}`} cx="50%" cy="34%" rx="55%" ry="42%">
              <Stop offset="0" stopColor={G.halo} stopOpacity="0.32" />
              <Stop offset="1" stopColor={G.halo} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#halo-${tier.tier})`} />
        </Svg>
      </Animated.View>

      {pro ? (
        <LinearGradient colors={G.gradProBorder} start={A165.start} end={A165.end} style={s.cardOuterPro}>
          <LinearGradient colors={G.gradProCard} start={A165.start} end={A165.end} style={[s.cardInner, s.cardInnerPro]}>
            {Body}
          </LinearGradient>
        </LinearGradient>
      ) : (
        <View style={s.cardOuter}>
          <LinearGradient colors={G.gradCard} start={A165.start} end={A165.end} style={[s.cardInner, { borderColor: G.border, borderWidth: 1 }]}>
            {Body}
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

// ── Écran ─────────────────────────────────────────────────────────────────────
export default function FormulesScreen() {
  const router = useRouter();
  const [data, setData] = useState<TiersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [choosingTier, setChoosingTier] = useState<string | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const pageRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await api.get<TiersResponse>('/tiers');
      setData((res as any)?.data ?? res);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Souscription d'un palier : Checkout Stripe (mode subscription) ouvert dans un
  // navigateur in-app, retour via deep link fixed://formules. Le palier ACTIF est
  // posé par le webhook Stripe (asynchrone) → au retour "success" on rafraîchit
  // /tiers (le currentTier peut mettre quelques secondes à basculer).
  const handleChoose = useCallback(async (tier: string) => {
    if (choosingTier) return;
    setChoosingTier(tier);
    try {
      const returnUrl = Linking.createURL('formules');
      const res: any = await api.subscription.createCheckoutSession(tier, returnUrl);
      if (!res?.url) throw new Error("Impossible de démarrer l'abonnement.");
      const result = await WebBrowser.openAuthSessionAsync(res.url, returnUrl);
      if (result.type === 'success' && result.url?.includes('status=success')) {
        feedback.success('Abonnement en cours d’activation…');
        await load();
      } else if (result.type === 'success' && result.url?.includes('status=cancel')) {
        feedback.haptic('light'); // annulation explicite — pas d'erreur
      }
    } catch (e: any) {
      // e.message = message FR du backend (TIER_NOT_CONFIGURED, SUBSCRIPTIONS_DISABLED…)
      feedback.error(e?.message || "Impossible de démarrer l'abonnement.");
    } finally {
      setChoosingTier(null);
    }
  }, [choosingTier, load]);

  // Snap → haptic de sélection (uniquement au changement de carte).
  const onMomentumEnd = (e: any) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / ITEM);
    if (p !== pageRef.current) { pageRef.current = p; feedback.haptic('selection'); }
  };

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
          <Text style={[s.headerTitle, { color: G.textPrimary, fontFamily: FONTS.bebas }]}>FORMULES</Text>
          <View style={{ width: 38 }} />
        </View>

        {!loading && !error && (
          <View style={s.banner}>
            <Text style={[s.bannerTitle, { color: G.textPrimary, fontFamily: FONTS.bebas }]}>Gagnez plus, gardez plus</Text>
            <Text style={[s.bannerSub, { color: G.textMuted, fontFamily: FONTS.sans }]}>Plus votre formule monte, plus votre commission baisse.</Text>
          </View>
        )}

        {loading ? (
          <Skeleton />
        ) : error ? (
          <View style={s.center}>
            <Feather name="wifi-off" size={36} color={G.textVeryMuted} />
            <Text style={[s.errorTitle, { color: G.textPrimary, fontFamily: FONTS.sansMedium }]}>Impossible de charger les formules</Text>
            <TouchableOpacity activeOpacity={0.85} style={s.ctaWrap} onPress={() => { feedback.haptic('light'); load(); }}>
              <LinearGradient colors={G.gradCta} start={A180.start} end={A180.end} style={[s.cta, s.retry]}>
                <Feather name="refresh-cw" size={15} color={G.onAccent} />
                <Text style={[s.ctaText, { color: G.onAccent, fontFamily: FONTS.sansMedium }]}>Réessayer</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Animated.ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM} decelerationRate="fast"
              scrollEventThrottle={16}
              contentContainerStyle={s.carouselContent}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
              onMomentumScrollEnd={onMomentumEnd}
            >
              {data?.tiers.map((t, i) => {
                const inputRange = [(i - 1) * ITEM, i * ITEM, (i + 1) * ITEM];
                const scale = scrollX.interpolate({ inputRange, outputRange: [0.93, 1, 0.93], extrapolate: 'clamp' });
                const opacity = scrollX.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });
                const translateY = scrollX.interpolate({ inputRange, outputRange: [12, 0, 12], extrapolate: 'clamp' });
                const haloOpacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' });
                return (
                  <Animated.View key={t.tier} style={{ transform: [{ scale }, { translateY }], opacity }}>
                    <TierCard
                      tier={t}
                      isCurrent={t.tier === data.currentTier}
                      subscriptionsEnabled={data.subscriptionsEnabled}
                      haloOpacity={haloOpacity}
                      onChoose={handleChoose}
                      choosing={choosingTier === t.tier}
                    />
                  </Animated.View>
                );
              })}
            </Animated.ScrollView>

            {/* Pagination — point actif élargi en dégradé */}
            <View style={s.dots}>
              {data?.tiers.map((t, i) => {
                const inputRange = [(i - 1) * ITEM, i * ITEM, (i + 1) * ITEM];
                const dotW = scrollX.interpolate({ inputRange, outputRange: [7, 22, 7], extrapolate: 'clamp' });
                const dotO = scrollX.interpolate({ inputRange, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
                return (
                  <Animated.View key={t.tier} style={[s.dotWrap, { width: dotW, opacity: dotO }]}>
                    <LinearGradient colors={G.gradCta} start={AHORIZ.start} end={AHORIZ.end} style={s.dotFill} />
                  </Animated.View>
                );
              })}
            </View>
          </>
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
  headerTitle: { fontSize: 22, letterSpacing: 1 },

  banner: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, gap: 4 },
  bannerTitle: { fontSize: 30, letterSpacing: 0.5 },
  bannerSub: { fontSize: 14, lineHeight: 19 },

  carouselRow: { flexDirection: 'row', gap: CARD_GAP, paddingHorizontal: 24, paddingTop: 16 },
  carouselContent: { paddingHorizontal: 24, paddingVertical: 20, gap: CARD_GAP, alignItems: 'flex-start' },

  cardOuter: {
    borderRadius: 22,
    ...Platform.select({
      ios: { shadowColor: G.shadow, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 5 },
    }),
  },
  cardOuterPro: {
    borderRadius: 22, padding: 2,
    ...Platform.select({
      ios: { shadowColor: G.gradProBorder[2], shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 8 },
    }),
  },
  cardInner: { borderRadius: 22, padding: 22, gap: 12, overflow: 'hidden' },
  cardInnerPro: { borderRadius: 20 },
  insetTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  halo: { position: 'absolute', top: -30, left: -60, right: -60, bottom: -10 },

  badgeRow: { flexDirection: 'row', gap: 8, minHeight: 22 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10, letterSpacing: 0.5 },

  tierLabel: { fontSize: 30 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  price: { fontSize: 34 },
  priceSuffix: { fontSize: 14, marginBottom: 6 },

  rule: { height: 1, width: '100%' },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  factText: { fontSize: 14 },

  perks: { gap: 9, marginTop: 4 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  perkText: { fontSize: 13.5, flex: 1 },

  ctaWrap: { marginTop: 8 },
  cta: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, marginTop: 8 },
  ctaText: { fontSize: 15 },
  retry: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingVertical: 12 },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingBottom: 24, paddingTop: 4 },
  dotWrap: { height: 7, borderRadius: 4, overflow: 'hidden' },
  dotFill: { flex: 1 },

  errorTitle: { fontSize: 16, textAlign: 'center' },
});
