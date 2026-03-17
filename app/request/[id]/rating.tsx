// app/request/[id]/rating.tsx
// v3 — Navigation Lock anti-race condition + Design System dark mode

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  StatusBar,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useOfflineAction } from '@/hooks/useOfflineAction';
import { showSocketToast } from '@/lib/SocketContext';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

// ============================================================================
// CHIPS COMPLIMENTS
// ============================================================================

const getCompliments = (t: (key: string) => string) => [
  { id: 'quality', icon: '✨', label: t('rating.compliment_quality') },
  { id: 'polite', icon: '😊', label: t('rating.compliment_polite') },
  { id: 'fast', icon: '⚡', label: t('rating.compliment_fast') },
  { id: 'material', icon: '🔧', label: t('rating.compliment_material') },
  { id: 'punctual', icon: '⏰', label: t('rating.compliment_punctual') },
  { id: 'clean', icon: '🧹', label: t('rating.compliment_clean') },
  { id: 'pro', icon: '🎯', label: t('rating.compliment_pro') },
  { id: 'recommend', icon: '💬', label: t('rating.compliment_recommend') },
];

const getRatingLabels = (t: (key: string) => string): Record<number, string> => ({
  1: t('rating.rating_1'),
  2: t('rating.rating_2'),
  3: t('rating.rating_3'),
  4: t('rating.rating_4'),
  5: t('rating.rating_5'),
});

// ============================================================================
// STAR — animée au tap
// ============================================================================

function Star({ filled, onPress, accessibilityLabel, textMuted }: { filled: boolean; onPress: () => void; accessibilityLabel?: string; textMuted: string }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1} accessibilityLabel={accessibilityLabel} accessibilityRole="button">
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={filled ? 'star' : 'star-outline'}
          size={44}
          color={filled ? '#FFB800' : textMuted}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ============================================================================
// COMPLIMENT CHIP
// ============================================================================

function ComplimentChip({
  chip,
  selected,
  onPress,
  theme,
}: {
  chip: { id: string; icon: string; label: string };
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.93, duration: 60, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 8 }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          cc.chip,
          { backgroundColor: theme.surface, borderColor: theme.border },
          selected && { backgroundColor: theme.accent, borderColor: theme.accent },
        ]}
        onPress={handlePress}
        activeOpacity={1}
        accessibilityLabel={chip.label}
        accessibilityRole="button"
      >
        <Text style={cc.emoji}>{chip.icon}</Text>
        <Text style={[cc.label, { color: theme.textSub, fontFamily: FONTS.sansMedium }, selected && { color: theme.accentText }]}>{chip.label}</Text>
        {selected && <Ionicons name="checkmark-circle" size={14} color={theme.accentText} />}
      </TouchableOpacity>
    </Animated.View>
  );
}

const cc = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  emoji: { fontSize: 15 },
  label: { fontSize: 13 },
});

// ============================================================================
// MAIN
// ============================================================================

export default function RatingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();

  const compliments = getCompliments(t);
  const ratingLabels = getRatingLabels(t);

  const [rating, setRating] = useState(0);
  const [selectedCompliments, setSelectedCompliments] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { execute: submitRatingOffline } = useOfflineAction('SUBMIT_RATING', {
    onQueued: () => {
      showSocketToast(t('offline.ratingQueued'), 'info');
      router.replace('/(tabs)/dashboard');
    },
    onSuccess: () => router.replace('/(tabs)/dashboard'),
    onError: (err) => Alert.alert(t('common.error'), err.message || t('rating.submit_error')),
  });

  const slideUp = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Navigation Lock — bloque le retour physique Android ──────────────────
  // Sans ce verrou, le layout parent peut rediriger vers /dashboard avant que
  // l'utilisateur ait eu le temps de noter (race condition).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    loadRequest();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [id]);

  const loadRequest = async () => {
    try {
      const response = await api.get(`/requests/${id}`);
      setRequest(response.data || response);
    } catch (error) {
      devError('Error loading request:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCompliment = (chipId: string) => {
    setSelectedCompliments(prev =>
      prev.includes(chipId) ? prev.filter(c => c !== chipId) : [...prev, chipId]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert(t('rating.rating_required_title'), t('rating.rating_required_msg'));
      return;
    }
    if (!request?.providerId) {
      Alert.alert(t('common.error'), t('rating.provider_not_found'));
      return;
    }

    setSubmitting(true);
    const complimentLabels = compliments
      .filter(c => selectedCompliments.includes(c.id))
      .map(c => c.label)
      .join(', ');

    const payload = {
      providerId: request.providerId,
      requestId: Number(id),
      rating,
      comment: [complimentLabels, comment].filter(Boolean).join(' — '),
    };

    try {
      await submitRatingOffline(
        () => api.post('/ratings', payload),
        payload as Record<string, unknown>,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.loading, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const providerName = request?.provider?.name || 'le prestataire';

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header — Navigation Lock ── */}
        {/* Pas de bouton retour : on bloque la race condition layout/socket */}
        <View style={s.header}>
          <View style={[s.closeBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="close" size={20} color={theme.textDisabled} />
          </View>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/dashboard')} style={s.skipBtn} accessibilityRole="button">
            <Text style={[s.skipText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>{t('rating.skip')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Prestataire ── */}
        <Animated.View style={[s.providerBlock, { opacity: fadeAnim, transform: [{ translateY: slideUp }] }]}>
          {/* Avatar initiales */}
          <View style={[s.avatar, { backgroundColor: theme.accent }]}>
            <Text style={[s.avatarText, { color: theme.accentText, fontFamily: FONTS.bebas }]}>
              {providerName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
            </Text>
          </View>
          <Text style={[s.providerLabel, { color: theme.textSub, fontFamily: FONTS.sans }]}>{t('rating.your_mission_with')}</Text>
          <Text style={[s.providerName, { color: theme.text, fontFamily: FONTS.bebas }]}>{providerName}</Text>
          {request?.serviceType && (
            <View style={[s.serviceTag, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.serviceTagText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>{request.serviceType}</Text>
            </View>
          )}
        </Animated.View>

        {/* ── Étoiles ── */}
        <View style={s.starsBlock}>
          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map(star => (
              <Star key={star} filled={rating >= star} onPress={() => setRating(star)} accessibilityLabel={`${star}/5`} textMuted={theme.textDisabled} />
            ))}
          </View>
          {rating > 0 && (
            <Text style={[s.ratingLabel, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{ratingLabels[rating]}</Text>
          )}
        </View>

        {/* ── Chips compliments — apparaissent dès qu'une étoile est choisie ── */}
        {rating >= 4 && (
          <Animated.View style={[s.section, { opacity: fadeAnim }]}>
            <Text style={[s.sectionTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{t('rating.what_you_liked')}</Text>
            <View style={s.chipsWrap}>
              {compliments.map(chip => (
                <ComplimentChip
                  key={chip.id}
                  chip={chip}
                  selected={selectedCompliments.includes(chip.id)}
                  onPress={() => toggleCompliment(chip.id)}
                  theme={theme}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {rating > 0 && rating < 4 && (
          <Animated.View style={[s.section, { opacity: fadeAnim }]}>
            <Text style={[s.sectionTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{t('rating.what_went_wrong')}</Text>
            <View style={s.chipsWrap}>
              {[
                { id: 'late', icon: '⏰', label: t('rating.negative_late') },
                { id: 'quality', icon: '⚠️', label: t('rating.negative_quality') },
                { id: 'rude', icon: '😞', label: t('rating.negative_rude') },
                { id: 'messy', icon: '🗑️', label: t('rating.negative_messy') },
              ].map(chip => (
                <ComplimentChip
                  key={chip.id}
                  chip={chip}
                  selected={selectedCompliments.includes(chip.id)}
                  onPress={() => toggleCompliment(chip.id)}
                  theme={theme}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Note texte collapsible ── */}
        {rating > 0 && (
          <View style={s.section}>
            <TouchableOpacity
              style={s.noteToggle}
              onPress={() => setNoteOpen(p => !p)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Ionicons name={noteOpen ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSub} />
              <Text style={[s.noteToggleText, { color: theme.textSub, fontFamily: FONTS.sans }]}>{t('rating.add_comment')}</Text>
            </TouchableOpacity>
            {noteOpen && (
              <TextInput
                style={[s.noteInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontFamily: FONTS.sans }]}
                placeholder={t('rating.describe_experience')}
                placeholderTextColor={theme.textMuted}
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                autoFocus
                accessibilityLabel={t('rating.add_comment')}
              />
            )}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ── CTA fixe en bas ── */}
      <View style={[s.footer, { backgroundColor: theme.bg, borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[s.submitBtn, { backgroundColor: theme.accent }, (rating === 0 || submitting) && { backgroundColor: theme.textDisabled }]}
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={rating === 0 ? t('rating.rate_first') : t('rating.submit_review')}
        >
          {submitting ? (
            <ActivityIndicator color={theme.accentText} />
          ) : (
            <>
              <Text style={[s.submitBtnText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>
                {rating === 0 ? t('rating.rate_first') : t('rating.submit_review')}
              </Text>
              {rating > 0 && <Ionicons name="arrow-forward" size={18} color={theme.accentText} />}
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const s = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  skipText: { fontSize: 14 },

  // Prestataire
  providerBlock: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: { fontSize: 24 },
  providerLabel: { fontSize: 13 },
  providerName: { fontSize: 28, letterSpacing: 1 },
  serviceTag: {
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 5, marginTop: 4,
    borderWidth: 1,
  },
  serviceTagText: { fontSize: 12 },

  // Étoiles
  starsBlock: { alignItems: 'center', marginBottom: 8 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  ratingLabel: { fontSize: 17 },

  // Section chips
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 14, marginBottom: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Note toggle
  noteToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  noteToggleText: { fontSize: 13 },
  noteInput: {
    borderRadius: 14,
    padding: 14, fontSize: 15,
    minHeight: 90, marginTop: 10,
    borderWidth: 1.5,
  },

  // Footer CTA
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
  },
  submitBtn: {
    borderRadius: 16, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  submitBtnText: { fontSize: 16 },
});
