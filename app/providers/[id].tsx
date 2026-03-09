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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';

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
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-outline'}
          size={size}
          color={i <= Math.round(rating) ? '#F59E0B' : '#D1D5DB'}
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
  const clientName = review.client?.name || review.client?.email?.split('@')[0] || 'Client';
  const initials   = avatarInitials(clientName);

  return (
    <View style={rv.card}>
      <View style={rv.row}>
        <View style={rv.avatar}>
          <Text style={rv.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={rv.name}>{clientName}</Text>
          <Stars rating={review.rating} size={12} />
        </View>
        <Text style={rv.date}>{timeAgo(review.createdAt)}</Text>
      </View>
      {!!review.comment && (
        <Text style={rv.comment}>{review.comment}</Text>
      )}
    </View>
  );
}

const rv = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  name:    { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  date:    { fontSize: 11, color: '#ADADAD', fontWeight: '500' },
  comment: { fontSize: 13, color: '#555', lineHeight: 19 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ProviderDetailScreen() {
  const router = useRouter();
  const { t }  = useTranslation();
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
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </SafeAreaView>
    );
  }

  if (!provider) {
    return (
      <SafeAreaView style={s.center}>
        <Ionicons name="alert-circle-outline" size={56} color="#ADADAD" />
        <Text style={s.errorText}>Prestataire introuvable</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>{t('common.back')}</Text>
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
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBack} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Prestataire</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Identity */}
        <View style={s.identity}>
          <View style={s.avatarWrap}>
            <Text style={s.avatarText}>{initials}</Text>
            {isOnline && <View style={s.onlineDot} />}
          </View>
          <Text style={s.name}>{provider.name}</Text>
          {provider.city ? (
            <View style={s.cityRow}>
              <Ionicons name="location-outline" size={13} color="#ADADAD" />
              <Text style={s.cityText}>{provider.city}</Text>
            </View>
          ) : null}
          {provider.description ? (
            <Text style={s.desc}>{provider.description}</Text>
          ) : null}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statValue}>
              {avgRating > 0 ? avgRating.toFixed(1) : '—'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 2, marginVertical: 3 }}>
              <Stars rating={avgRating} size={12} />
            </View>
            <Text style={s.statLabel}>
              {totalRatings > 0 ? `${totalRatings} ${t('providers.rating').toLowerCase()}` : t('providers.rating')}
            </Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <Text style={s.statValue}>{jobsDone}</Text>
            <Text style={s.statLabel}>{t('providers.missions')}</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.stat}>
            <View style={[s.statusDot, isOnline && s.statusDotOnline]} />
            <Text style={s.statLabel}>
              {isOnline ? t('providers.online') : t('providers.offline')}
            </Text>
          </View>
        </View>

        {/* Categories */}
        {provider.categories?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Catégories</Text>
            <View style={s.chips}>
              {provider.categories.map((cat: any) => (
                <View key={cat.id} style={s.chip}>
                  <Text style={s.chipText}>{cat.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Reviews */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{t('providers.reviews')}</Text>
            {reviews.length > 0 && (
              <Text style={s.reviewCount}>
                {reviews.length} avis
              </Text>
            )}
          </View>

          {reviews.length === 0 ? (
            <View style={s.emptyReviews}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color="#E0E0E0" />
              <Text style={s.emptyReviewsText}>{t('providers.no_reviews')}</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {displayedReviews.map(review => (
                <ReviewCard key={review.id} review={review} />
              ))}
              {reviews.length > 3 && !showAll && (
                <TouchableOpacity
                  style={s.seeAllBtn}
                  onPress={() => setShowAll(true)}
                  activeOpacity={0.75}
                >
                  <Text style={s.seeAllText}>
                    {t('providers.see_all_reviews')} ({reviews.length - 3} de plus)
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#555" />
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
  root: { flex: 1, backgroundColor: '#F8F9FB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },

  scroll: { padding: 16, gap: 12, paddingBottom: 48 },

  identity: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 20,
    alignItems: 'center', gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  avatarWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  onlineDot: {
    position: 'absolute', bottom: 4, right: 4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#22C55E',
    borderWidth: 2.5, borderColor: '#FFF',
  },
  name: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginTop: 4 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cityText: { fontSize: 13, color: '#ADADAD', fontWeight: '500' },
  desc: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: '#ADADAD', fontWeight: '600', textAlign: 'center' },
  statDivider: { width: 1, height: 44, backgroundColor: '#F0F0F0' },
  statusDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#D1D5DB', marginBottom: 4,
  },
  statusDotOnline: { backgroundColor: '#22C55E' },

  section: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 16, gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  reviewCount: { fontSize: 12, color: '#ADADAD', fontWeight: '600' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#F5F5F5', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  chipText: { fontSize: 13, color: '#555', fontWeight: '600' },

  emptyReviews: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyReviewsText: { fontSize: 14, color: '#ADADAD', fontWeight: '500' },

  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  seeAllText: { fontSize: 13, fontWeight: '600', color: '#555' },

  errorText: { fontSize: 16, color: '#ADADAD', marginTop: 12 },
  backBtn: {
    marginTop: 20, backgroundColor: '#1A1A1A',
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  backBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
