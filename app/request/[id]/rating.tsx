// app/request/[id]/rating.tsx
// Client note le prestataire — chips compliments, étoiles animées, zéro formulaire lourd

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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';

// ============================================================================
// CHIPS COMPLIMENTS
// ============================================================================

const COMPLIMENTS = [
  { id: 'quality', icon: '✨', label: 'Top qualité' },
  { id: 'polite', icon: '😊', label: 'Super poli' },
  { id: 'fast', icon: '⚡', label: 'Rapide' },
  { id: 'material', icon: '🔧', label: 'Bon matos' },
  { id: 'punctual', icon: '⏰', label: 'Ponctuel' },
  { id: 'clean', icon: '🧹', label: 'Chantier propre' },
  { id: 'pro', icon: '🎯', label: 'Très pro' },
  { id: 'recommend', icon: '💬', label: 'Je recommande' },
];

const RATING_LABELS: Record<number, string> = {
  1: 'Très mauvais',
  2: 'Mauvais',
  3: 'Correct',
  4: 'Bien',
  5: 'Excellent',
};

// ============================================================================
// STAR — animée au tap
// ============================================================================

function Star({ filled, onPress }: { filled: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={filled ? 'star' : 'star-outline'}
          size={44}
          color={filled ? '#FFB800' : '#E5E7EB'}
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
  chip: typeof COMPLIMENTS[0];
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
    backgroundColor: '#F5F5F5', borderRadius: 20,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipSelected: { backgroundColor: '#111', borderColor: '#111' },
  emoji: { fontSize: 15 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  labelSelected: { color: '#FFF' },
});

// ============================================================================
// MAIN
// ============================================================================

export default function RatingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [rating, setRating] = useState(0);
  const [selectedCompliments, setSelectedCompliments] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const slideUp = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
      Alert.alert('Note requise', 'Donnez au moins une étoile');
      return;
    }
    if (!request?.providerId) {
      Alert.alert('Erreur', 'Prestataire introuvable');
      return;
    }

    try {
      setSubmitting(true);
      const complimentLabels = COMPLIMENTS
        .filter(c => selectedCompliments.includes(c.id))
        .map(c => c.label)
        .join(', ');

      await api.post('/ratings', {
        providerId: request.providerId,
        requestId: Number(id),
        rating,
        comment: [complimentLabels, comment].filter(Boolean).join(' — '),
      });

      router.replace('/(tabs)/dashboard');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible d\'envoyer l\'évaluation');
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
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={20} color="#111" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(tabs)/dashboard')} style={s.skipBtn}>
            <Text style={s.skipText}>Plus tard</Text>
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
          <Text style={s.providerLabel}>Votre mission avec</Text>
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
              <Star key={star} filled={rating >= star} onPress={() => setRating(star)} />
            ))}
          </View>
          {rating > 0 && (
            <Text style={s.ratingLabel}>{RATING_LABELS[rating]}</Text>
          )}
        </View>

        {/* ── Chips compliments — apparaissent dès qu'une étoile est choisie ── */}
        {rating >= 4 && (
          <Animated.View style={[s.section, { opacity: fadeAnim }]}>
            <Text style={s.sectionTitle}>Ce qui vous a plu ?</Text>
            <View style={s.chipsWrap}>
              {COMPLIMENTS.map(chip => (
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
            <Text style={s.sectionTitle}>Ce qui n'a pas fonctionné ?</Text>
            <View style={s.chipsWrap}>
              {[
                { id: 'late', icon: '⏰', label: 'En retard' },
                { id: 'quality', icon: '⚠️', label: 'Mauvaise qualité' },
                { id: 'rude', icon: '😞', label: 'Peu aimable' },
                { id: 'messy', icon: '🗑️', label: 'Chantier sale' },
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
            >
              <Ionicons name={noteOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#888" />
              <Text style={s.noteToggleText}>Ajouter un commentaire</Text>
            </TouchableOpacity>
            {noteOpen && (
              <TextInput
                style={s.noteInput}
                placeholder="Décrivez votre expérience..."
                placeholderTextColor="#ADADAD"
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                autoFocus
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
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={s.submitBtnText}>
                {rating === 0 ? 'Donnez une note d\'abord' : 'Envoyer l\'évaluation'}
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
  root: { flex: 1, backgroundColor: '#FFF' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  skipText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },

  // Prestataire
  providerBlock: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  providerLabel: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },
  providerName: { fontSize: 22, fontWeight: '800', color: '#111' },
  serviceTag: {
    backgroundColor: '#F5F5F5', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 5, marginTop: 4,
  },
  serviceTagText: { fontSize: 12, fontWeight: '600', color: '#555' },

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
    backgroundColor: '#F7F7F7', borderRadius: 14,
    padding: 14, fontSize: 15, color: '#111',
    minHeight: 90, marginTop: 10,
    borderWidth: 1.5, borderColor: '#EBEBEB',
  },

  // Footer CTA
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  submitBtn: {
    backgroundColor: '#111', borderRadius: 16, height: 56,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  submitBtnDisabled: { backgroundColor: '#D1D5DB' },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});