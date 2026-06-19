// app/formules.tsx — Écran "Formules" PRESTATAIRE.
//
// SOURCE UNIQUE : toutes les données de palier viennent de GET /api/tiers (backend).
// Aucune grille en dur ici → zéro drift possible avec le money-source (config/tiers.js).
// La commission et le plafond sont rendus depuis leurs champs dédiés de l'API
// (commissionRate, missionCap), jamais depuis les perks marketing.
//
// v1 carrousel premium — structure inspirée de app/subscription.tsx (client) mais
// 100% pilotée par l'API. À valider/ajuster contre le mockup HTML validé.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Dimensions, Animated, Easing, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

// ── Types (miroir de la réponse GET /api/tiers) ───────────────────────────────
interface Tier {
  tier: string;
  label: string;
  monthlyPriceCents: number;
  commissionRate: number; // 0..1
  missionCap: number | null; // null = illimité
  recommended: boolean;
  order: number;
  perks: string[];
}
interface TiersResponse {
  subscriptionsEnabled: boolean;
  currentTier: string | null;
  tiers: Tier[];
}

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 48, 360);
const CARD_GAP = 16;

// ── Helpers d'affichage (formatage seulement) ─────────────────────────────────
const priceLabel = (cents: number) => (cents === 0 ? 'Gratuit' : `${(cents / 100).toFixed(2).replace('.', ',')} €`);
const commissionLabel = (rate: number) => `${Math.round(rate * 100)} % de commission`;
const capLabel = (cap: number | null) => (cap === null ? 'Missions illimitées' : `${cap} missions / mois`);

// ── Skeleton (chargement) ─────────────────────────────────────────────────────
function Skeleton() {
  const theme = useAppTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={s.carouselRow}>
      {[0, 1].map((i) => (
        <Animated.View
          key={i}
          style={[s.card, { width: CARD_W, backgroundColor: theme.cardBg, borderColor: theme.border, opacity: pulse, gap: 14 }]}
        >
          <View style={[sk.bar, { width: 120, height: 26, backgroundColor: theme.surface }]} />
          <View style={[sk.bar, { width: 90, height: 38, backgroundColor: theme.surface }]} />
          {[0, 1, 2, 3].map((k) => (
            <View key={k} style={[sk.bar, { width: '85%', height: 14, backgroundColor: theme.surface }]} />
          ))}
        </Animated.View>
      ))}
    </View>
  );
}

// ── Carte palier ──────────────────────────────────────────────────────────────
function TierCard({ tier, isCurrent, subscriptionsEnabled }: { tier: Tier; isCurrent: boolean; subscriptionsEnabled: boolean }) {
  const theme = useAppTheme();
  const highlight = tier.recommended;
  return (
    <View
      style={[
        s.card,
        { width: CARD_W, backgroundColor: theme.cardBg, borderColor: theme.border, shadowOpacity: theme.shadowOpacity },
        highlight && { borderColor: COLORS.green, borderWidth: 2 },
        isCurrent && !highlight && { borderColor: theme.accent, borderWidth: 2 },
      ]}
    >
      {/* Badges */}
      <View style={s.badgeRow}>
        {highlight && (
          <View style={[s.badge, { backgroundColor: COLORS.green }]}>
            <Text style={[s.badgeText, { color: '#0A0A0A', fontFamily: FONTS.mono }]}>RECOMMANDÉ</Text>
          </View>
        )}
        {isCurrent && (
          <View style={[s.badge, { backgroundColor: theme.accent }]}>
            <Text style={[s.badgeText, { color: theme.accentText, fontFamily: FONTS.mono }]}>PALIER ACTUEL</Text>
          </View>
        )}
      </View>

      {/* Nom + prix */}
      <Text style={[s.tierLabel, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>{tier.label}</Text>
      <View style={s.priceRow}>
        <Text style={[s.price, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>{priceLabel(tier.monthlyPriceCents)}</Text>
        {tier.monthlyPriceCents > 0 && (
          <Text style={[s.priceSuffix, { color: theme.textMuted, fontFamily: FONTS.sans }]}>/ mois</Text>
        )}
      </View>

      {/* Commission + plafond (champs DÉDIÉS, pas perks) */}
      <View style={[s.factRow, { borderColor: theme.border }]}>
        <Feather name="percent" size={14} color={COLORS.green} />
        <Text style={[s.factText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>{commissionLabel(tier.commissionRate)}</Text>
      </View>
      <View style={[s.factRow, { borderColor: theme.border }]}>
        <Feather name="briefcase" size={14} color={theme.textMuted} />
        <Text style={[s.factText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>{capLabel(tier.missionCap)}</Text>
      </View>

      {/* Perks marketing */}
      <View style={s.perks}>
        {tier.perks.map((p, i) => (
          <View key={i} style={s.perkRow}>
            <Feather name="check" size={15} color={COLORS.green} />
            <Text style={[s.perkText, { color: theme.textSub, fontFamily: FONTS.sans }]}>{p}</Text>
          </View>
        ))}
      </View>

      {/* CTA — masqué tant que les abonnements ne sont pas activés (beta) */}
      {subscriptionsEnabled ? (
        !isCurrent ? (
          <TouchableOpacity style={[s.cta, { backgroundColor: highlight ? COLORS.green : theme.accent }]} activeOpacity={0.85}>
            <Text style={[s.ctaText, { color: highlight ? '#0A0A0A' : theme.accentText, fontFamily: FONTS.sansMedium }]}>
              Choisir {tier.label}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.cta, s.ctaCurrent, { borderColor: theme.border }]}>
            <Text style={[s.ctaText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Votre formule</Text>
          </View>
        )
      ) : (
        <View style={[s.cta, s.ctaCurrent, { borderColor: theme.border }]}>
          <Text style={[s.ctaText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>Bientôt disponible</Text>
        </View>
      )}
    </View>
  );
}

// ── Écran ─────────────────────────────────────────────────────────────────────
export default function FormulesScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const [data, setData] = useState<TiersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<TiersResponse>('/tiers');
      const payload = (res as any)?.data ?? res;
      setData(payload);
      // Démarrer sur le palier recommandé si présent.
      const recoIdx = payload?.tiers?.findIndex((t: Tier) => t.recommended) ?? -1;
      if (recoIdx > 0) setPage(recoIdx);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    setPage(Math.round(x / (CARD_W + CARD_GAP)));
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: theme.surface }]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/provider-dashboard' as any))}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>FORMULES</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Bandeau */}
      {!loading && !error && (
        <View style={s.banner}>
          <Text style={[s.bannerTitle, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>
            Gagnez plus, gardez plus
          </Text>
          <Text style={[s.bannerSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
            Plus votre formule monte, plus votre commission baisse.
          </Text>
        </View>
      )}

      {/* Contenu */}
      {loading ? (
        <Skeleton />
      ) : error ? (
        <View style={s.center}>
          <Feather name="wifi-off" size={36} color={theme.textVeryMuted} />
          <Text style={[s.errorTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Impossible de charger les formules</Text>
          <TouchableOpacity style={[s.retry, { backgroundColor: theme.accent }]} onPress={load} activeOpacity={0.85}>
            <Feather name="refresh-cw" size={15} color={theme.accentText} />
            <Text style={[s.retryText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={s.carouselContent}
            onMomentumScrollEnd={onScroll}
            contentOffset={{ x: page * (CARD_W + CARD_GAP), y: 0 }}
          >
            {data?.tiers.map((t) => (
              <TierCard
                key={t.tier}
                tier={t}
                isCurrent={t.tier === data.currentTier}
                subscriptionsEnabled={data.subscriptionsEnabled}
              />
            ))}
          </ScrollView>

          {/* Pagination */}
          <View style={s.dots}>
            {data?.tiers.map((t, i) => (
              <View
                key={t.tier}
                style={[
                  s.dot,
                  { backgroundColor: i === page ? COLORS.green : theme.border, width: i === page ? 20 : 7 },
                ]}
              />
            ))}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const sk = StyleSheet.create({
  bar: { borderRadius: 7 },
});

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, letterSpacing: 1 },

  banner: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, gap: 4 },
  bannerTitle: { fontSize: 30, letterSpacing: 0.5 },
  bannerSub: { fontSize: 14, lineHeight: 19 },

  carouselRow: { flexDirection: 'row', gap: CARD_GAP, paddingHorizontal: 24, paddingTop: 16 },
  carouselContent: { paddingHorizontal: 24, paddingVertical: 16, gap: CARD_GAP },

  card: {
    borderRadius: 22, padding: 22, borderWidth: 1, gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
    }),
  },
  badgeRow: { flexDirection: 'row', gap: 8, minHeight: 22 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10, letterSpacing: 0.5 },

  tierLabel: { fontSize: 30 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  price: { fontSize: 34 },
  priceSuffix: { fontSize: 14, marginBottom: 6 },

  factRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  factText: { fontSize: 14 },

  perks: { gap: 9, marginTop: 4 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  perkText: { fontSize: 13.5, flex: 1 },

  cta: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  ctaCurrent: { backgroundColor: 'transparent', borderWidth: 1 },
  ctaText: { fontSize: 15 },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingBottom: 24, paddingTop: 4 },
  dot: { height: 7, borderRadius: 4 },

  errorTitle: { fontSize: 16, textAlign: 'center' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 11, marginTop: 4 },
  retryText: { fontSize: 14 },
});
