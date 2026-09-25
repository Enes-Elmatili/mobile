// components/tracking/DoneContent.tsx
// Terminé : le bilan d'abord (avant / après, durée, montant, reçu), la note
// ensuite — on note ce qu'on vient de voir. Rendu dans la feuille du suivi
// (missionview, stade « done ») et par la route rating (liens profonds).
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Reanimated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { api } from '@/lib/api';
import { useOfflineAction } from '@/hooks/useOfflineAction';
import { showSocketToast } from '@/lib/SocketContext';
import { feedback } from '@/lib/feedback/feedback';
import { spring } from '@/lib/motion/springs';
import { usePressScale } from '@/lib/motion/press';
import { useEntrance } from '@/lib/motion/useEntrance';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { formatClock, formatEUR } from '@/lib/format';
import { briefOf, workOf } from '@/lib/mission/brief';
import { minutesSince } from '@/lib/mission/stage';
import Avatar from '@/components/ui/Avatar';
import { PhotoViewer, photoUri } from '@/components/mission/photos';
import { providerName } from './ProviderRow';
import { PressScale } from '@/components/ui/PressScale';

// ─── Puces ───────────────────────────────────────────────────────────────────
type Chip = { id: string; icon: React.ComponentProps<typeof Feather>['name']; label: string };
const compliments = (t: (k: string) => string): Chip[] => [
  { id: 'quality',   icon: 'star',           label: t('rating.compliment_quality') },
  { id: 'polite',    icon: 'smile',          label: t('rating.compliment_polite') },
  { id: 'fast',      icon: 'zap',            label: t('rating.compliment_fast') },
  { id: 'material',  icon: 'tool',           label: t('rating.compliment_material') },
  { id: 'punctual',  icon: 'clock',          label: t('rating.compliment_punctual') },
  { id: 'clean',     icon: 'check-circle',   label: t('rating.compliment_clean') },
  { id: 'pro',       icon: 'target',         label: t('rating.compliment_pro') },
  { id: 'recommend', icon: 'message-circle', label: t('rating.compliment_recommend') },
];
const negatives = (t: (k: string) => string): Chip[] => [
  { id: 'late',    icon: 'clock',          label: t('rating.negative_late') },
  { id: 'quality', icon: 'alert-triangle', label: t('rating.negative_quality') },
  { id: 'rude',    icon: 'frown',          label: t('rating.negative_rude') },
  { id: 'messy',   icon: 'trash-2',        label: t('rating.negative_messy') },
];

const STAR_WAVE_MS = 25;
const STAR_SPRING = spring(500, 1.0);
const STAR_LAST_SPRING = spring(500, 0.7);

function Star({ index, rating, onPress, label, muted }: { index: number; rating: number; onPress: () => void; label: string; muted: string }) {
  const filled = rating >= index;
  const scale = useSharedValue(1);
  const prev = useRef(rating);
  useEffect(() => {
    const before = prev.current;
    prev.current = rating;
    const up = rating > before;
    const from = Math.min(before, rating), to = Math.max(before, rating);
    if (index <= from || index > to) return;
    const order = up ? index - from - 1 : to - index;
    const isLast = up && index === rating;
    scale.value = 1.25;
    scale.value = withDelay(order * STAR_WAVE_MS, withSpring(1, isLast ? STAR_LAST_SPRING : STAR_SPRING));
    if (up) {
      const h = setTimeout(() => feedback.haptic(isLast ? 'selection' : 'light'), order * STAR_WAVE_MS);
      return () => clearTimeout(h);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- réagit à la note seulement
  }, [rating]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <PressScale onPress={onPress} accessibilityLabel={label} accessibilityRole="button" hitSlop={4}>
      <Reanimated.View style={style}><Feather name="star" size={38} color={filled ? COLORS.amber : muted} /></Reanimated.View>
    </PressScale>
  );
}

function ChipButton({ chip, selected, onPress }: { chip: Chip; selected: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const press = usePressScale(0.93);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityLabel={chip.label} accessibilityRole="button" accessibilityState={{ selected }}>
      <Reanimated.View style={[s.chip, { backgroundColor: selected ? theme.accent : theme.surface, borderColor: selected ? theme.accent : theme.border }, press.style]}>
        <Feather name={chip.icon} size={13} color={(selected ? theme.accentText : theme.textSub) as string} />
        <Text style={[s.chipText, { color: selected ? theme.accentText : theme.textSub }]} maxFontSizeMultiplier={1.2}>{chip.label}</Text>
      </Reanimated.View>
    </Pressable>
  );
}


type Props = {
  request: any;
  /** Sous la barre de statut quand le bloc occupe tout l'écran. */
  topInset?: number;
};

export function DoneContent({ request, topInset = 0 }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [chips, setChips] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const entrance = useEntrance(24);

  const { execute: submitOffline } = useOfflineAction('SUBMIT_RATING', {
    onQueued: () => { showSocketToast(t('offline.ratingQueued'), 'info'); router.replace('/(tabs)/dashboard'); },
    onSuccess: () => { feedback.event('mission_complete'); router.replace('/(tabs)/dashboard'); },
    onError: (err) => feedback.error(err.message || t('rating.submit_error')),
  });

  // Le retour physique Android ne doit pas court-circuiter le bilan.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const submit = async () => {
    if (rating === 0) { feedback.error('rating.rating_required_msg'); return; }
    if (!request?.providerId) { feedback.error('rating.provider_not_found'); return; }
    setSubmitting(true);
    const pool = rating >= 4 ? compliments(t) : negatives(t);
    const labels = pool.filter((c) => chips.includes(c.id)).map((c) => c.label).join(', ');
    const payload = { providerId: request.providerId, requestId: Number(request.id), rating, comment: [labels, comment.trim()].filter(Boolean).join(' — ') };
    try { await submitOffline(() => api.post('/ratings', payload), payload as Record<string, unknown>); }
    finally { setSubmitting(false); }
  };

  const brief = briefOf(request);
  const work = workOf(request);
  const name = providerName(request.provider);
  const firstName = name.split(/\s+/)[0];
  const completedAt = brief.timeline.completedAt ?? request.completedAt ?? null;
  const startedAt = brief.timeline.startedAt ?? brief.timeline.arrivedAt ?? null;
  const duration = startedAt && completedAt ? minutesSince(startedAt, new Date(completedAt).getTime()) : null;
  const amount = request.price != null && Number(request.price) > 0 ? Number(request.price) : null;
  const shots = [work.beforePhotoUrl, work.afterPhotoUrl].filter(Boolean) as string[];
  const gallery = shots.length ? shots.map((u, i) => ({ id: i, url: u, shotKey: i === 0 && work.beforePhotoUrl ? 'before' : 'after', width: 0, height: 0 })) : brief.photos;
  const pool = rating >= 4 ? compliments(t) : negatives(t);
  const toggle = (cid: string) => setChips((cur) => (cur.includes(cid) ? cur.filter((c) => c !== cid) : [...cur, cid]));

  return (
    <View style={[s.root, { backgroundColor: theme.cardBg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.scroll, { paddingTop: topInset + 16, paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Reanimated.View style={entrance.style}>
            <Text style={[s.kicker, { color: theme.textMuted }]}>{t('tracking.done_kicker', { time: formatClock(completedAt ?? Date.now()) })}</Text>
            <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{t('tracking.done_title')}</Text>
            <Text style={[s.sub, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{duration != null && duration > 0 ? t('tracking.done_sub', { name: firstName, n: duration }) : t('tracking.done_sub_no_duration', { name: firstName })}</Text>

            {shots.length ? (
              <View style={s.compare}>
                {work.beforePhotoUrl ? (
                  <PressScale style={[s.shot, { backgroundColor: theme.surface }]} onPress={() => setViewer(0)} accessibilityRole="imagebutton" accessibilityLabel={t('tracking.before')}>
                    <Image source={{ uri: photoUri(work.beforePhotoUrl) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                    <Text style={[s.shotTag, { color: theme.text, backgroundColor: theme.cardBg }]}>{t('tracking.before')}</Text>
                  </PressScale>
                ) : null}
                {work.afterPhotoUrl ? (
                  <PressScale style={[s.shot, { backgroundColor: theme.surface }]} onPress={() => setViewer(work.beforePhotoUrl ? 1 : 0)} accessibilityRole="imagebutton" accessibilityLabel={t('tracking.after')}>
                    <Image source={{ uri: photoUri(work.afterPhotoUrl) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                    <Text style={[s.shotTag, { color: theme.text, backgroundColor: theme.cardBg }]}>{t('tracking.after')}</Text>
                  </PressScale>
                ) : null}
              </View>
            ) : null}

            <View style={s.facts}>
              {duration != null && duration > 0 ? (
                <View style={[s.fact, { backgroundColor: theme.surface }]}><Text style={[s.factValue, { color: theme.text }]}>{duration}</Text><Text style={[s.factLabel, { color: theme.textMuted }]}>{t('tracking.fact_minutes').toUpperCase()}</Text></View>
              ) : null}
              {amount != null ? (
                <View style={[s.fact, { backgroundColor: theme.surface }]}><Text style={[s.factValue, { color: theme.text }]}>{formatEUR(amount, 0)}</Text><Text style={[s.factLabel, { color: theme.textMuted }]}>{t('tracking.fact_paid').toUpperCase()}</Text></View>
              ) : null}
              <PressScale style={[s.fact, { backgroundColor: theme.surface }]} onPress={() => router.push({ pathname: '/(tabs)/documents', params: { openRequestId: String(request.id) } })} accessibilityRole="button" accessibilityLabel={`${t('tracking.fact_receipt')} · ${t('tracking.fact_receipt_where')}`}>
                <Text style={[s.factValue, { color: theme.text }]}>{t('tracking.fact_receipt')}</Text>
                <Text style={[s.factLabel, { color: theme.textMuted }]}>{t('tracking.fact_receipt_where').toUpperCase()}</Text>
              </PressScale>
            </View>

            <View style={s.rateHead}>
              <Avatar name={name} size={40} avatarUrl={request.provider?.avatarUrl} />
              <Text style={[s.question, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{t('tracking.rate_question')}</Text>
            </View>
            <View style={s.stars} accessibilityRole="radiogroup">
              {[1, 2, 3, 4, 5].map((i) => <Star key={i} index={i} rating={rating} onPress={() => { setRating(i); setChips([]); }} label={t(`rating.rating_${i}`)} muted={theme.textMuted as string} />)}
            </View>
            {rating > 0 ? <Text style={[s.ratingLabel, { color: theme.textSub }]}>{t(`rating.rating_${rating}`)}</Text> : null}

            {rating > 0 ? (
              <>
                <Text style={[s.chipsTitle, { color: theme.textMuted }]}>{(rating >= 4 ? t('rating.what_you_liked') : t('rating.what_went_wrong')).toUpperCase()}</Text>
                <View style={s.chips}>
                  {pool.map((c) => <ChipButton key={c.id} chip={c} selected={chips.includes(c.id)} onPress={() => { feedback.haptic('selection'); toggle(c.id); }} />)}
                </View>
                <PressScale onPress={() => setNoteOpen((v) => !v)} style={s.noteToggle} accessibilityRole="button" accessibilityState={{ expanded: noteOpen }}>
                  <Text style={[s.noteToggleText, { color: theme.textSub }]}>{t('rating.add_comment')}</Text>
                  <Feather name={noteOpen ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSub as string} />
                </PressScale>
                {noteOpen ? (
                  <TextInput
                    style={[s.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                    placeholder={t('rating.describe_experience')} placeholderTextColor={theme.textMuted as string}
                    value={comment} onChangeText={setComment} multiline maxLength={500} textAlignVertical="top"
                  />
                ) : null}
              </>
            ) : null}
          </Reanimated.View>
        </ScrollView>

        <View style={[s.footer, { backgroundColor: theme.cardBg, borderTopColor: theme.borderLight, paddingBottom: insets.bottom + 12 }]}>
          <PressScale
            style={[s.cta, { backgroundColor: rating === 0 || submitting ? theme.textDisabled : theme.accent }]}
            onPress={submit} disabled={rating === 0 || submitting}
            accessibilityRole="button" accessibilityLabel={rating === 0 ? t('rating.rate_first') : t('rating.submit_review')}
          >
            {submitting ? <ActivityIndicator color={theme.accentText as string} /> : <Text style={[s.ctaText, { color: theme.accentText }]}>{(rating === 0 ? t('rating.rate_first') : t('rating.submit_review')).toUpperCase()}</Text>}
          </PressScale>
          <PressScale onPress={() => router.replace('/(tabs)/dashboard')} style={s.later} accessibilityRole="button" accessibilityLabel={t('tracking.later')}>
            <Text style={[s.laterText, { color: theme.textMuted }]}>{t('tracking.later')}</Text>
          </PressScale>
        </View>
      </KeyboardAvoidingView>

      <PhotoViewer photos={gallery} index={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  kicker: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.5 },
  title: { fontFamily: FONTS.bebas, fontSize: 34, includeFontPadding: false, marginTop: 6 },
  sub: { fontFamily: FONTS.sans, fontSize: 13.5, marginTop: 4 },
  compare: { flexDirection: 'row', gap: 8, marginTop: 16 },
  shot: { flex: 1, aspectRatio: 4 / 3, borderRadius: 14, overflow: 'hidden' },
  shotTag: { position: 'absolute', left: 8, bottom: 8, fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  facts: { flexDirection: 'row', gap: 8, marginTop: 10 },
  fact: { flex: 1, padding: 10, borderRadius: 12 },
  factValue: { fontFamily: FONTS.bebas, fontSize: 20, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  factLabel: { fontFamily: FONTS.sans, fontSize: 10, letterSpacing: 0.5, marginTop: 2 },
  rateHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 26 },
  question: { flex: 1, fontFamily: FONTS.bebas, fontSize: 22, includeFontPadding: false, letterSpacing: 0.3 },
  stars: { flexDirection: 'row', gap: 10, marginTop: 12 },
  ratingLabel: { fontFamily: FONTS.sansMedium, fontSize: 13, marginTop: 8 },
  chipsTitle: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1.5, marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: FONTS.sansMedium, fontSize: 12.5 },
  noteToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingVertical: 6 },
  noteToggleText: { fontFamily: FONTS.sansMedium, fontSize: 13 },
  input: { marginTop: 8, minHeight: 96, borderRadius: 14, borderWidth: 1, padding: 12, fontFamily: FONTS.sans, fontSize: 14 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1 },
  cta: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: FONTS.bebas, fontSize: 17, letterSpacing: 1.5, includeFontPadding: false },
  later: { alignItems: 'center', paddingVertical: 10 },
  laterText: { fontFamily: FONTS.sansMedium, fontSize: 13 },
});
