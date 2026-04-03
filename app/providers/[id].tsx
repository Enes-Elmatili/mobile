import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { PulseDot } from '@/components/ui/PulseDot';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Review {
  id: string;
  clientId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  client?: { name?: string; email?: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={i <= Math.round(rating) ? COLORS.amber : theme.textDisabled}
        />
      ))}
    </View>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return 'Hier';
  if (d < 30)  return `Il y a ${d} jours`;
  const m = Math.floor(d / 30);
  if (m < 12)  return `Il y a ${m} mois`;
  return `Il y a ${Math.floor(m / 12)} an${Math.floor(m / 12) > 1 ? 's' : ''}`;
}

function avatarInitials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const theme = useAppTheme();
  const clientName = review.client?.name || review.client?.email?.split('@')[0] || 'Client';
  const initials   = avatarInitials(clientName);

  return (
    <View style={[rv.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
      <View style={rv.row}>
        <View style={[rv.avatar, { backgroundColor: theme.heroBg }]}>
          <Text style={[rv.avatarText, { color: theme.heroText, fontFamily: FONTS.sansMedium }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[rv.name, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{clientName}</Text>
          <Stars rating={review.rating} size={12} />
        </View>
        <Text style={[rv.date, { color: theme.textMuted, fontFamily: FONTS.mono }]}>{timeAgo(review.createdAt)}</Text>
      </View>
      {!!review.comment && (
        <Text style={[rv.comment, { color: theme.textSub, fontFamily: FONTS.sans }]}>{review.comment}</Text>
      )}
    </View>
  );
}

const rv = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
  },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13 },
  name:    { fontSize: 13 },
  date:    { fontSize: 11 },
  comment: { fontSize: 13, lineHeight: 19 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ProviderDetailScreen() {
  const router = useRouter();
  const { t }  = useTranslation();
  const theme  = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [provider, setProvider]     = useState<any>(null);
  const [reviews,  setReviews]      = useState<Review[]>([]);
  const [loading,  setLoading]      = useState(true);
  const [showAll,  setShowAll]      = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.providers.get(id),
      api.ratings.list(id),
    ]).then(([provRes, ratingsRes]) => {
      setProvider(provRes?.data ?? provRes);
      const list = ratingsRes?.data ?? ratingsRes;
      setReviews(Array.isArray(list) ? list : list?.reviews ?? []);
    }).catch(err => {
      devError('[ProviderDetail]', err);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.accent} />
      </SafeAreaView>
    );
  }

  if (!provider) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <Ionicons name="alert-circle-outline" size={56} color={theme.textMuted} />
        <Text style={[s.errorText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Prestataire introuvable</Text>
        <TouchableOpacity style={[s.backBtnBottom, { backgroundColor: theme.accent }]} onPress={() => router.back()}>
          <Text style={[s.backBtnBottomText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>{t('common.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const avgRating    = provider.avgRating ?? 0;
  const totalRatings = provider.totalRatings ?? reviews.length;
  const jobsDone     = provider.jobsCompleted ?? 0;
  const isOnline     = provider.status === 'ONLINE' || provider.status === 'READY';
  const initials     = avatarInitials(provider.name);
  const displayedReviews = showAll ? reviews : reviews.slice(0, 3);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity style={[s.headerBack, { backgroundColor: theme.surface }]} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Prestataire</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Identity */}
        <View style={[s.identity, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
          <View style={[s.avatarWrap, { backgroundColor: theme.heroBg }]}>
            <Text style={[s.avatarText, { color: theme.heroText, fontFamily: FONTS.bebas }]}>{initials}</Text>
            {isOnline && (
              <View style={[s.onlineDotWrap, { borderColor: theme.cardBg }]}>
                <PulseDot size={10} />
              </View>
            )}
          </View>
          <Text style={[s.name, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>{provider.name}</Text>
          {provider.city ? (
            <View style={s.cityRow}>
              <Ionicons name="location-outline" size={13} color={theme.textMuted} />
              <Text style={[s.cityText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{provider.city}</Text>
            </View>
          ) : null}
          {provider.description ? (
            <Text style={[s.desc, { color: theme.textSub, fontFamily: FONTS.sans }]}>{provider.description}</Text>
          ) : null}
        </View>

        {/* Stats */}
        <View style={[s.statsRow, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
          <View style={s.stat}>
            <Text style={[s.statValue, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>
              {avgRating > 0 ? avgRating.toFixed(1) : '-'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 2, marginVertical: 3 }}>
              <Stars rating={avgRating} size={12} />
            </View>
            <Text style={[s.statLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>
              {totalRatings > 0 ? `${totalRatings} ${t('providers.rating').toLowerCase()}` : t('providers.rating')}
            </Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: theme.borderLight }]} />
          <View style={s.stat}>
            <Text style={[s.statValue, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>{jobsDone}</Text>
            <Text style={[s.statLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('providers.missions')}</Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: theme.borderLight }]} />
          <View style={s.stat}>
            {isOnline ? <PulseDot size={8} /> : <View style={[s.statusDot, { backgroundColor: theme.textDisabled }]} />}
            <Text style={[s.statLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>
              {isOnline ? t('providers.online') : t('providers.offline')}
            </Text>
          </View>
        </View>

        {/* Categories */}
        {provider.categories?.length > 0 && (
          <View style={[s.section, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
            <Text style={[s.sectionTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Catégories</Text>
            <View style={s.chips}>
              {provider.categories.map((cat: any) => (
                <View key={cat.id} style={[s.chip, { backgroundColor: theme.surface }]}>
                  <Text style={[s.chipText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>{cat.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Reviews */}
        <View style={[s.section, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('providers.reviews')}</Text>
            {reviews.length > 0 && (
              <Text style={[s.reviewCount, { color: theme.textMuted, fontFamily: FONTS.mono }]}>
                {reviews.length} avis
              </Text>
            )}
          </View>

          {reviews.length === 0 ? (
            <View style={s.emptyReviews}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={theme.textDisabled} />
              <Text style={[s.emptyReviewsText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{t('providers.no_reviews')}</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {displayedReviews.map(review => (
                <ReviewCard key={review.id} review={review} />
              ))}
              {reviews.length > 3 && !showAll && (
                <TouchableOpacity
                  style={[s.seeAllBtn, { backgroundColor: theme.surface }]}
                  onPress={() => setShowAll(true)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.seeAllText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>
                    {t('providers.see_all_reviews')} ({reviews.length - 3} de plus)
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={theme.textSub} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17 },

  scroll: { padding: 16, gap: 12, paddingBottom: 48 },

  identity: {
    borderRadius: 20, padding: 20,
    alignItems: 'center', gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  avatarWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatarText: { fontSize: 30, letterSpacing: 1 },
  onlineDotWrap: {
    position: 'absolute', bottom: 4, right: 4,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2.5,
  },
  name: { fontSize: 26, marginTop: 4 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cityText: { fontSize: 13 },
  desc: { fontSize: 14, textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 26, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, textAlign: 'center' },
  statDivider: { width: 1, height: 44 },
  statusDot: {
    width: 12, height: 12, borderRadius: 6,
    marginBottom: 4,
  },

  section: {
    borderRadius: 18, padding: 16, gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15 },
  reviewCount: { fontSize: 12 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  chipText: { fontSize: 13 },

  emptyReviews: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyReviewsText: { fontSize: 14 },

  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
  },
  seeAllText: { fontSize: 13 },

  errorText: { fontSize: 16, marginTop: 12 },
  backBtnBottom: {
    marginTop: 20,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  backBtnBottomText: { fontSize: 15 },
});
