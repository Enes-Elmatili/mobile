import React, { useEffect, useState, useCallback } from 'react';
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
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { PulseDot } from '@/components/ui/PulseDot';
import IconBtn from '@/components/ui/IconBtn';
import { resolveAvatarUrl } from '@/lib/avatarUrl';

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
        <Feather
          key={i}
          name="star"
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
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 11 },
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
  const [busyModal, setBusyModal]   = useState(false);
  const [ctaLoading, setCtaLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.providers.get(id),
      api.ratings.list(id),
    ]).then(([provRes, ratingsRes]) => {
      // Backend renvoie { success, provider } — déballer correctement
      setProvider(provRes?.provider ?? provRes?.data ?? provRes);
      const list = ratingsRes?.data ?? ratingsRes;
      setReviews(Array.isArray(list) ? list : list?.reviews ?? []);
    }).catch(err => {
      devError('[ProviderDetail]', err);
    }).finally(() => setLoading(false));
  }, [id]);

  // ── Callbacks (déclarés AVANT les early returns pour respecter Rules of Hooks) ──
  // firstName est calculé ici (accepte provider null) pour rester avant les returns.
  const firstNameCb = provider?.name?.split(' ')[0] || provider?.name;

  const handleRequestProvider = useCallback(async () => {
    if (!id) return;
    setCtaLoading(true);
    try {
      const av: any = await api.providers.availability(id);
      if (av?.available) {
        router.push({
          pathname: '/new-request',
          params: { preferredProviderId: id, preferredProviderName: firstNameCb },
        });
      } else {
        setBusyModal(true);
      }
    } catch (err) {
      devError('[providers/[id]] availability', err);
      router.push('/new-request');
    } finally {
      setCtaLoading(false);
    }
  }, [id, firstNameCb, router]);

  const handleScheduleWithProvider = useCallback(() => {
    setBusyModal(false);
    router.push({
      pathname: '/new-request',
      params: { preferredProviderId: id, preferredProviderName: firstNameCb, forceScheduled: '1' },
    });
  }, [id, firstNameCb, router]);

  const handleFindOther = useCallback(() => {
    setBusyModal(false);
    router.push('/new-request');
  }, [router]);

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
        <Feather name="alert-circle" size={56} color={theme.textMuted} />
        <Text style={[s.errorText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Prestataire introuvable</Text>
        <TouchableOpacity style={[s.backBtnFallback, { backgroundColor: theme.accent }]} onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}>
          <Text style={[s.backBtnFallbackText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>{t('common.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const avgRating    = provider.avgRating ?? 0;
  const totalRatings = provider.totalRatings ?? reviews.length;
  const jobsDone     = provider.jobsCompleted ?? 0;
  const isOnline     = provider.status === 'ONLINE' || provider.status === 'READY';
  const isVerified   = provider.validationStatus === 'ACTIVE';
  const initials     = avatarInitials(provider.name);
  const displayedReviews = showAll ? reviews : reviews.slice(0, 3);
  const acceptRate   = provider.totalRequests > 0
    ? Math.round((provider.acceptedRequests / provider.totalRequests) * 100)
    : null;
  const memberSince  = provider.createdAt
    ? new Date(provider.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : null;
  const avatarUri = resolveAvatarUrl(provider.avatarUrl);

  // Build subtitle parts: category, experience, city
  const subtitleParts: string[] = [];
  if (provider.categories?.[0]?.name) subtitleParts.push(provider.categories[0].name.toUpperCase());
  if (memberSince) subtitleParts.push(`DEPUIS ${memberSince.toUpperCase()}`);
  if (provider.city) subtitleParts.push(provider.city.toUpperCase());
  const subtitleText = subtitleParts.join(' \u00B7 ');

  // Build stat strip items
  const statItems: { label: string; value: string | number; unit?: string }[] = [
    { label: 'RATING', value: avgRating > 0 ? avgRating.toFixed(1) : '-', unit: '/5' },
    { label: 'JOBS', value: jobsDone },
  ];
  if (acceptRate !== null) {
    statItems.push({ label: 'ON-TIME', value: acceptRate, unit: '%' });
  }
  // Response time placeholder — show if available
  if (provider.avgResponseMin) {
    statItems.push({ label: 'RESP.', value: provider.avgResponseMin, unit: 'min' });
  }

  // First name for CTA (déjà calculé en `firstNameCb` plus haut, on le réutilise)
  const firstName = firstNameCb;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header — IconBtn chevron-left + PROVIDER + IconBtn more-horizontal */}
      <View style={[s.header, { borderBottomColor: theme.borderLight }]}>
        <IconBtn
          icon="chevron-left"
          onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
        />
        <Text style={[s.headerTitle, { color: theme.textMuted, fontFamily: FONTS.mono }]}>PROVIDER</Text>
        <IconBtn icon="more-horizontal" />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar + Name + Subtitle */}
        <View style={s.identitySection}>
          {/* Centered avatar 80px with verified overlay */}
          <View style={s.avatarOuter}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={[s.avatarImg, { borderColor: theme.borderLight }]} />
            ) : (
              <View style={[s.avatarWrap, { backgroundColor: theme.heroBg }]}>
                <Text style={[s.avatarText, { color: theme.heroText, fontFamily: FONTS.bebas }]}>{initials}</Text>
              </View>
            )}
            {isVerified && (
              <View style={[s.verifiedOverlay, { backgroundColor: COLORS.greenBrand, borderColor: theme.bg }]}>
                <Feather name="check" size={10} color="#fff" />
              </View>
            )}
            {isOnline && (
              <View style={[s.onlineDotWrap, { borderColor: theme.bg }]}>
                <PulseDot size={10} />
              </View>
            )}
          </View>

          {/* Name — Bebas 34px centered */}
          <Text style={[s.name, { color: theme.textAlt, fontFamily: FONTS.bebas }]}>{provider.name}</Text>

          {/* Subtitle — mono 11px, textMuted, letterSpacing 1 */}
          {subtitleText.length > 0 && (
            <Text style={[s.subtitle, { color: theme.textMuted, fontFamily: FONTS.mono }]}>{subtitleText}</Text>
          )}

          {/* Badges row */}
          <View style={s.badgesRow}>
            {isVerified && (
              <View style={[s.badge, { backgroundColor: 'rgba(61,139,61,0.10)' }]}>
                <Feather name="shield" size={11} color={COLORS.greenBrand} />
                <Text style={[s.badgeText, { color: COLORS.greenBrand, fontFamily: FONTS.mono }]}>VERIFIED</Text>
              </View>
            )}
            {avgRating > 0 && (
              <View style={[s.badge, { backgroundColor: 'rgba(245,158,11,0.10)' }]}>
                <Feather name="star" size={11} color={COLORS.amber} />
                <Text style={[s.badgeText, { color: COLORS.amber, fontFamily: FONTS.mono }]}>{avgRating.toFixed(1)}</Text>
              </View>
            )}
            {provider.languages?.length > 0 && (
              <View style={[s.badge, { backgroundColor: theme.surface }]}>
                <Feather name="globe" size={11} color={theme.textSub} />
                <Text style={[s.badgeText, { color: theme.textSub, fontFamily: FONTS.mono }]}>{provider.languages.join(', ').toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats card — Card wrapping StatStrip-style layout */}
        <View style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={s.statsRow}>
            {statItems.map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={[s.statDivider, { backgroundColor: theme.borderLight }]} />}
                <View style={s.stat}>
                  <Text style={[s.statLabel, { color: theme.textMuted, fontFamily: FONTS.mono }]}>{item.label}</Text>
                  <View style={s.statValueRow}>
                    <Text style={[s.statValue, { color: theme.text, fontFamily: FONTS.bebas }]}>{item.value}</Text>
                    {item.unit ? (
                      <Text style={[s.statUnit, { color: theme.textSub, fontFamily: FONTS.mono }]}>{item.unit}</Text>
                    ) : null}
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* About section */}
        {provider.description ? (
          <View style={s.sectionWrap}>
            <View style={s.sectionHeaderRow}>
              <Text style={[s.sectionTitle, { color: theme.textMuted, fontFamily: FONTS.mono }]}>ABOUT</Text>
            </View>
            <View style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <Text style={[s.desc, { color: theme.textSub, fontFamily: FONTS.sans }]}>{provider.description}</Text>
            </View>
          </View>
        ) : null}

        {/* Specialties section */}
        {provider.categories?.length > 0 && (
          <View style={s.sectionWrap}>
            <View style={s.sectionHeaderRow}>
              <Text style={[s.sectionTitle, { color: theme.textMuted, fontFamily: FONTS.mono }]}>SPECIALTIES</Text>
            </View>
            <View style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <View style={s.chips}>
                {provider.categories.map((cat: any) => (
                  <View key={cat.id} style={[s.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[s.chipText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>{cat.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Reviews section */}
        <View style={s.sectionWrap}>
          <View style={s.sectionHeaderRow}>
            <Text style={[s.sectionTitle, { color: theme.textMuted, fontFamily: FONTS.mono }]}>
              {t('providers.reviews').toUpperCase()}
            </Text>
            {totalRatings > 0 && (
              <Text style={[s.sectionAction, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>
                {totalRatings} total
              </Text>
            )}
          </View>

          {reviews.length === 0 ? (
            <View style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <View style={s.emptyReviews}>
                <Feather name="message-circle" size={32} color={theme.textDisabled} />
                <Text style={[s.emptyReviewsText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{t('providers.no_reviews')}</Text>
              </View>
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
                  <Feather name="chevron-down" size={14} color={theme.textSub} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

      </ScrollView>

      {/* Bottom CTA — full width accent button */}
      <View style={[s.ctaWrap, { borderTopColor: theme.borderLight, backgroundColor: theme.bg }]}>
        <TouchableOpacity
          style={[s.ctaBtn, { backgroundColor: theme.accent }, ctaLoading && { opacity: 0.6 }]}
          activeOpacity={0.85}
          onPress={handleRequestProvider}
          disabled={ctaLoading}
        >
          {ctaLoading ? (
            <ActivityIndicator color={theme.accentText} />
          ) : (
            <>
              <Text style={[s.ctaText, { color: theme.accentText, fontFamily: FONTS.bebas }]}>
                Demander {firstName}
              </Text>
              <Feather name="arrow-right" size={18} color={theme.accentText} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal — provider BUSY/OFFLINE */}
      <Modal visible={busyModal} transparent animationType="fade" onRequestClose={() => setBusyModal(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setBusyModal(false)}>
          <Pressable style={[s.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]} onPress={(e) => e.stopPropagation()}>
            <View style={[s.modalIconCircle, { backgroundColor: theme.surface }]}>
              <Feather name="clock" size={24} color={theme.textSub} />
            </View>
            <Text style={[s.modalTitle, { color: theme.text, fontFamily: FONTS.bebas }]}>
              {firstName} n'est pas dispo
            </Text>
            <Text style={[s.modalBody, { color: theme.textSub, fontFamily: FONTS.sans }]}>
              {firstName} est actuellement occupé ou hors ligne. Vous pouvez planifier une mission avec lui pour plus tard, ou trouver un autre prestataire disponible maintenant.
            </Text>

            <TouchableOpacity
              style={[s.modalPrimary, { backgroundColor: theme.accent }]}
              onPress={handleScheduleWithProvider}
              activeOpacity={0.85}
            >
              <Feather name="calendar" size={18} color={theme.accentText} />
              <Text style={[s.modalPrimaryText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>
                Planifier avec {firstName}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.modalSecondary, { borderColor: theme.borderLight }]}
              onPress={handleFindOther}
              activeOpacity={0.75}
            >
              <Text style={[s.modalSecondaryText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
                Trouver un autre prestataire
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setBusyModal(false)} activeOpacity={0.7} style={{ paddingVertical: 8 }}>
              <Text style={[s.modalCancel, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Annuler</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  headerTitle: { fontSize: 11, letterSpacing: 1 },

  scroll: { padding: 16, gap: 16, paddingBottom: 24 },

  // ── Identity section (no card bg — sits directly on bg) ──
  identitySection: {
    alignItems: 'center', gap: 8,
    paddingTop: 8, paddingBottom: 4,
  },
  avatarOuter: { position: 'relative', marginBottom: 4 },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2,
  },
  avatarText: { fontSize: 28, letterSpacing: 1 },
  verifiedOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5,
  },
  onlineDotWrap: {
    position: 'absolute', top: 0, right: 0,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2.5,
  },
  name: { fontSize: 34, letterSpacing: 0.4, textAlign: 'center' },
  subtitle: { fontSize: 11, letterSpacing: 1, textAlign: 'center' },

  // ── Badges row ──
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  badgeText: { fontSize: 10.5, letterSpacing: 0.5 },

  // ── Card (shared) ──
  card: {
    borderRadius: 18, padding: 16,
    borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 }, shadowRadius: 4,
    ...Platform.select({ android: { elevation: 1 } }),
  },

  // ── Stats ──
  statsRow: { flexDirection: 'row', alignItems: 'stretch' },
  stat: { flex: 1, paddingHorizontal: 4 },
  statLabel: {
    fontSize: 10.5, letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: { fontSize: 24, lineHeight: 24 },
  statUnit: { fontSize: 11 },
  statDivider: { width: 1, marginVertical: 4 },

  // ── Section layout ──
  sectionWrap: { gap: 10 },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  sectionAction: { fontSize: 12 },

  // ── About ──
  desc: { fontSize: 14, lineHeight: 21 },

  // ── Chips (specialties) ──
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },

  // ── Reviews ──
  emptyReviews: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyReviewsText: { fontSize: 14 },

  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
  },
  seeAllText: { fontSize: 13 },

  // ── Bottom CTA ──
  ctaWrap: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    borderTopWidth: 1,
  },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
    width: '100%',
  },
  ctaText: { fontSize: 28, letterSpacing: 0.5 },

  // ── Error state ──
  errorText: { fontSize: 16, marginTop: 12 },
  backBtnFallback: {
    marginTop: 20,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  backBtnFallbackText: { fontSize: 15 },

  // ── Modal busy ──
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%', maxWidth: 380,
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 22, paddingVertical: 22,
    alignItems: 'center', gap: 12,
  },
  modalIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 28, letterSpacing: 0.4, textAlign: 'center' },
  modalBody: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 8 },
  modalPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', paddingVertical: 13, borderRadius: 12,
  },
  modalPrimaryText: { fontSize: 15 },
  modalSecondary: {
    width: '100%', paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  modalSecondaryText: { fontSize: 15 },
  modalCancel: { fontSize: 13 },
});
