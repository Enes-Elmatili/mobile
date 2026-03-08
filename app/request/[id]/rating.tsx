// app/request/[id]/rating.tsx
// v2 — Navigation Lock anti-race condition + Palette Silver unifiée

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
import { useOfflineAction } from '@/hooks/useOfflineAction';
import { showSocketToast } from '@/lib/SocketContext';

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

function Star({ filled, onPress, accessibilityLabel }: { filled: boolean; onPress: () => void; accessibilityLabel?: string }) {
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
          color={filled ? '#FFB800' : '#B0B0B0'}
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
}: {
  chip: { id: string; icon: string; label: string };
  selected: boolean;
  onPress: () => void;
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
        style={[cc.chip, selected && cc.chipSelected]}
        onPress={handlePress}
        activeOpacity={1}
        accessibilityLabel={chip.label}
        accessibilityRole="button"
      >
        <Text style={cc.emoji}>{chip.icon}</Text>
        <Text style={[cc.label, selected && cc.labelSelected]}>{chip.label}</Text>
        {selected && <Ionicons name="checkmark-circle" size={14} color="#FFF" />}
      </TouchableOpacity>
    </Animated.View>
  );
}

const cc = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#F0F1F4', borderRadius: 20,
    borderWidth: 1.5, borderColor: '#DCDDE0',
  },
  chipSelected: { backgroundColor: '#111', borderColor: '#111' },
  emoji: { fontSize: 15 },
  label: { fontSize: 13, fontWeight: '600', color: '#444' },
  labelSelected: { color: '#FFF' },
});

// ============================================================================
// MAIN
// ============================================================================

export default function RatingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();

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
      console.error('Error loading request:', error);
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
      <View style={s.loading}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  const providerName = request?.provider?.name || 'le prestataire';

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8E9EC" />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header — Navigation Lock ── */}
        {/* Pas de bouton retour : on bloque la race condition layout/socket */}
        <View style={s.header}>
          <View style={s.closeBtn}>
            <Ionicons name="close" size={20} color="#D0D1D6" />
          </View>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/dashboard')} style={s.skipBtn} accessibilityRole="button">
            <Text style={s.skipText}>{t('rating.skip')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Prestataire ── */}
        <Animated.View style={[s.providerBlock, { opacity: fadeAnim, transform: [{ translateY: slideUp }] }]}>
          {/* Avatar initiales */}
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {providerName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
            </Text>
          </View>
          <Text style={s.providerLabel}>{t('rating.your_mission_with')}</Text>
          <Text style={s.providerName}>{providerName}</Text>
          {request?.serviceType && (
            <View style={s.serviceTag}>
              <Text style={s.serviceTagText}>{request.serviceType}</Text>
            </View>
          )}
        </Animated.View>

        {/* ── Étoiles ── */}
        <View style={s.starsBlock}>
          <View style={s.stars}>
            {[1, 2, 3, 4, 5].map(star => (
              <Star key={star} filled={rating >= star} onPress={() => setRating(star)} accessibilityLabel={`${star}/5`} />
            ))}
          </View>
          {rating > 0 && (
            <Text style={s.ratingLabel}>{ratingLabels[rating]}</Text>
          )}
        </View>

        {/* ── Chips compliments — apparaissent dès qu'une étoile est choisie ── */}
        {rating >= 4 && (
          <Animated.View style={[s.section, { opacity: fadeAnim }]}>
            <Text style={s.sectionTitle}>{t('rating.what_you_liked')}</Text>
            <View style={s.chipsWrap}>
              {compliments.map(chip => (
                <ComplimentChip
                  key={chip.id}
                  chip={chip}
                  selected={selectedCompliments.includes(chip.id)}
                  onPress={() => toggleCompliment(chip.id)}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {rating > 0 && rating < 4 && (
          <Animated.View style={[s.section, { opacity: fadeAnim }]}>
            <Text style={s.sectionTitle}>{t('rating.what_went_wrong')}</Text>
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
              <Ionicons name={noteOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#888" />
              <Text style={s.noteToggleText}>{t('rating.add_comment')}</Text>
            </TouchableOpacity>
            {noteOpen && (
              <TextInput
                style={s.noteInput}
                placeholder={t('rating.describe_experience')}
                placeholderTextColor="#ADADAD"
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
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.submitBtn, (rating === 0 || submitting) && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel={rating === 0 ? t('rating.rate_first') : t('rating.submit_review')}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={s.submitBtnText}>
                {rating === 0 ? t('rating.rate_first') : t('rating.submit_review')}
              </Text>
              {rating > 0 && <Ionicons name="arrow-forward" size={18} color="#FFF" />}
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
  root: { flex: 1, backgroundColor: '#E8E9EC' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8E9EC' },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F0F1F4',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#DCDDE0',
  },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  skipText: { fontSize: 14, fontWeight: '600', color: '#888' },

  // Prestataire
  providerBlock: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  providerLabel: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },
  providerName: { fontSize: 22, fontWeight: '800', color: '#111' },
  serviceTag: {
    backgroundColor: '#F0F1F4', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 5, marginTop: 4,
    borderWidth: 1, borderColor: '#DCDDE0',
  },
  serviceTagText: { fontSize: 12, fontWeight: '600', color: '#666' },

  // Étoiles
  starsBlock: { alignItems: 'center', marginBottom: 8 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  ratingLabel: { fontSize: 17, fontWeight: '700', color: '#111' },

  // Section chips
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Note toggle
  noteToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  noteToggleText: { fontSize: 13, fontWeight: '500', color: '#888' },
  noteInput: {
    backgroundColor: '#F0F1F4', borderRadius: 14,
    padding: 14, fontSize: 15, color: '#111',
    minHeight: 90, marginTop: 10,
    borderWidth: 1.5, borderColor: '#DCDDE0',
  },

  // Footer CTA
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#E8E9EC',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1, borderTopColor: '#DCDDE0',
  },
  submitBtn: {
    backgroundColor: '#111', borderRadius: 16, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  submitBtnDisabled: { backgroundColor: '#CACBCE' },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});