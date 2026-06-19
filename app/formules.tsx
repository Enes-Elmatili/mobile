// app/formules.tsx — Écran "Formules" PRESTATAIRE (graphite premium).
//
// SOURCE UNIQUE DONNÉES : GET /api/tiers (aucune grille en dur → zéro drift money).
// SOURCE UNIQUE COULEURS : tokens GRAPHITE de @/hooks/use-app-theme (aucun hex en
// dur ici). Commission & plafond rendus depuis leurs champs DÉDIÉS (commissionRate,
// missionCap), jamais depuis les perks. NE touche PAS app/subscription.tsx (client).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, Animated, Easing, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { api } from '@/lib/api';
import { FONTS, GRAPHITE as G } from '@/hooks/use-app-theme';

// Géométrie des dégradés (≈165° / 180° approximés en points RN — pas des couleurs).
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
function TierCard({ tier, isCurrent, subscriptionsEnabled }: { tier: Tier; isCurrent: boolean; subscriptionsEnabled: boolean }) {
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
          <TouchableOpacity activeOpacity={0.85} style={s.ctaWrap}>
            <LinearGradient colors={G.gradCta} start={A180.start} end={A180.end} style={s.cta}>
              <Text style={[s.ctaText, { color: G.onAccent, fontFamily: FONTS.sansMedium }]}>Choisir {tier.label}</Text>
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

  if (pro) {
    return (
      <View style={{ width: CARD_W }}>
        <Svg width={'100%' as any} height={'100%' as any} style={s.halo} pointerEvents="none">
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="34%" rx="55%" ry="42%">
              <Stop offset="0" stopColor={G.halo} stopOpacity="0.30" />
              <Stop offset="1" stopColor={G.halo} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#halo)" />
        </Svg>
        <LinearGradient colors={G.gradProBorder} start={A165.start} end={A165.end} style={s.cardOuterPro}>
          <LinearGradient colors={G.gradProCard} start={A165.start} end={A165.end} style={[s.cardInner, s.cardInnerPro]}>
            {Body}
          </LinearGradient>
        </LinearGradient>
      </View>
    );
  }
  return (
    <View style={[s.cardOuter, { width: CARD_W }]}>
      <LinearGradient colors={G.gradCard} start={A165.start} end={A165.end} style={[s.cardInner, { borderColor: G.border, borderWidth: 1 }]}>
        {Body}
      </LinearGradient>
    </View>
  );
}

// ── Écran ─────────────────────────────────────────────────────────────────────
export default function FormulesScreen() {
  const router = useRouter();
  const [data, setData] = useState<TiersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await api.get<TiersResponse>('/tiers');
      const payload = (res as any)?.data ?? res;
      setData(payload);
      const recoIdx = payload?.tiers?.findIndex((t: Tier) => t.recommended) ?? -1;
      if (recoIdx > 0) setPage(recoIdx);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onScroll = (e: any) => setPage(Math.round(e.nativeEvent.contentOffset.x / (CARD_W + CARD_GAP)));

  return (
    <View style={s.root}>
      <LinearGradient colors={G.gradBg} start={A180.start} end={A180.end} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" />

        <View style={[s.header, { borderBottomColor: G.border }]}>
          <TouchableOpacity
            style={[s.backBtn, { backgroundColor: G.scrim }]}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/provider-dashboard' as any))}
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
            <TouchableOpacity activeOpacity={0.85} style={s.ctaWrap} onPress={load}>
              <LinearGradient colors={G.gradCta} start={A180.start} end={A180.end} style={[s.cta, s.retry]}>
                <Feather name="refresh-cw" size={15} color={G.onAccent} />
                <Text style={[s.ctaText, { color: G.onAccent, fontFamily: FONTS.sansMedium }]}>Réessayer</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_W + CARD_GAP} decelerationRate="fast"
              contentContainerStyle={s.carouselContent}
              onMomentumScrollEnd={onScroll}
              contentOffset={{ x: page * (CARD_W + CARD_GAP), y: 0 }}
            >
              {data?.tiers.map((t) => (
                <TierCard key={t.tier} tier={t} isCurrent={t.tier === data.currentTier} subscriptionsEnabled={data.subscriptionsEnabled} />
              ))}
            </ScrollView>

            <View style={s.dots}>
              {data?.tiers.map((t, i) => (
                i === page ? (
                  <LinearGradient key={t.tier} colors={G.gradCta} start={AHORIZ.start} end={AHORIZ.end} style={[s.dot, { width: 20 }]} />
                ) : (
                  <View key={t.tier} style={[s.dot, { width: 7, backgroundColor: G.border }]} />
                )
              ))}
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
  carouselContent: { paddingHorizontal: 24, paddingVertical: 16, gap: CARD_GAP },

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
  dot: { height: 7, borderRadius: 4 },

  errorTitle: { fontSize: 16, textAlign: 'center' },
});
