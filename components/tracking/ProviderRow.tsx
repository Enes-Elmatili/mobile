// components/tracking/ProviderRow.tsx
// Le prestataire en une ligne : vrai avatar, nom, note · missions, message
// (avec non-lus) et appel. Partagé par le suivi, le devis reçu et le planifié.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import Avatar from '@/components/ui/Avatar';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import { cleanName } from '@/lib/displayName';
import { formatRating } from '@/lib/mission/brief';

export type ProviderLike = {
  id?: string | number | null;
  userId?: string | null;
  name?: string | null;
  user?: { name?: string | null } | null;
  avatarUrl?: string | null;
  avgRating?: number | null;
  jobsCompleted?: number | null;
  phone?: string | null;
  validationStatus?: string | null;
};

/** Nom affichable (jamais un slug ni un email). */
export function providerName(p: ProviderLike | null | undefined): string {
  return cleanName(p?.name ?? p?.user?.name ?? null);
}
/** Prénom seul pour les titres (« Yassine a accepté »). */
export function providerFirstName(p: ProviderLike | null | undefined): string {
  return providerName(p).split(/\s+/)[0];
}

type Props = {
  provider: ProviderLike;
  unread?: number;
  onMessage?: () => void;
  onCall?: () => void;
  onOpenProfile?: () => void;
  /** Sans fond (dans une carte déjà contrastée). */
  plain?: boolean;
};

function RoundBtn({ icon, onPress, label, primary, badge }: { icon: React.ComponentProps<typeof Feather>['name']; onPress?: () => void; label: string; primary?: boolean; badge?: number }) {
  const theme = useAppTheme();
  const press = usePressScale();
  if (!onPress) return null;
  return (
    <Pressable onPress={() => { feedback.haptic('light'); onPress(); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}>
      <Animated.View style={[s.btn, { backgroundColor: primary ? theme.accent : theme.surfaceAlt }, press.style]}>
        <Feather name={icon} size={15} color={(primary ? theme.accentText : theme.text) as string} />
        {badge ? (
          <View style={[s.badge, { backgroundColor: theme.greenText, borderColor: theme.cardBg }]}>
            <Text style={[s.badgeText, { color: theme.accentText }]}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export function ProviderRow({ provider, unread = 0, onMessage, onCall, onOpenProfile, plain = false }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const name = providerName(provider);
  const meta = [formatRating(provider.avgRating), provider.jobsCompleted != null ? t('mission.missions_count', { n: provider.jobsCompleted }) : null].filter(Boolean).join(' · ');
  return (
    <View style={[s.row, !plain && { backgroundColor: theme.bg, borderRadius: 16, padding: 12 }]}>
      <Pressable onPress={onOpenProfile} disabled={!onOpenProfile} style={s.id} accessibilityRole={onOpenProfile ? 'button' : undefined} accessibilityLabel={name}>
        <Avatar name={name} size={44} avatarUrl={provider.avatarUrl} verified={provider.validationStatus === 'ACTIVE'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.name, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{name}</Text>
          {meta ? <Text style={[s.meta, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{meta}</Text> : null}
        </View>
      </Pressable>
      <RoundBtn icon="message-circle" onPress={onMessage} label={t('tracking.message', { name })} badge={unread} />
      <RoundBtn icon="phone" onPress={onCall} label={t('tracking.call', { name })} primary />
    </View>
  );
}

const s = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  id:   { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: FONTS.sansMedium, fontSize: 14 },
  meta: { fontFamily: FONTS.sans, fontSize: 12, marginTop: 2 },
  btn:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  badgeText: { fontFamily: FONTS.monoMedium, fontSize: 9, lineHeight: 11 },
});
