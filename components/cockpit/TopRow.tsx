// components/cockpit/TopRow.tsx — le haut de l'accueil : profil · gain du jour
// · messages · cloche. Le gain du jour reste au centre, toujours visible, et
// roule (DigitReel) quand une mission se clôture, avec un éclat vert court.
// La rangée s'efface vers le haut quand une demande monte.
import React, { memo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, COLORS, FONTS } from '@/hooks/use-app-theme';
import { usePresence } from '@/lib/motion/usePresence';
import { useReduceMotion } from '@/lib/motion/sheet';
import { DigitReel } from '@/components/ui/DigitReel';
import { feedback } from '@/lib/feedback/feedback';
import { PressScale } from '@/components/ui/PressScale';

type Props = {
  visible: boolean;
  top: number;
  left: number;
  width: number;
  /** Gains nets du jour (cents). */
  todayCents: number;
  /** Faux tant que le premier chargement n'est pas arrivé : on ne fête pas une valeur initiale. */
  settled: boolean;
  unreadMessages: number;
  unreadNotifs: number;
  onProfile: () => void;
  onToday: () => void;
  onMessages: () => void;
  onNotifs: () => void;
};

function RoundButton({ icon, badge, onPress, label }: { icon: React.ComponentProps<typeof Feather>['name']; badge?: number; onPress: () => void; label: string }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const a11y = badge && badge > 0 ? `${label}, ${t('cockpit.unread', { count: badge })}` : label;
  return (
    <PressScale onPress={() => { feedback.haptic('light'); onPress(); }} style={[s.rb, { backgroundColor: theme.cardBg, borderColor: theme.border, shadowOpacity: theme.isDark ? 0.35 : 0.12  }]} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={6}>
      <Feather name={icon} size={18} color={theme.text} />
      {badge && badge > 0 ? (
        <View style={[s.badge, { backgroundColor: theme.accent }]}>
          <Text style={[s.badgeText, { color: theme.accentText }]} maxFontSizeMultiplier={1}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </PressScale>
  );
}

function TopRowBase({ visible, top, left, width, todayCents, settled, unreadMessages, unreadNotifs, onProfile, onToday, onMessages, onNotifs }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const reduced = useReduceMotion();
  const { style: presence } = usePresence(visible, { from: 'island' });
  const euros = Math.max(0, Math.round(todayCents / 100));

  // Éclat vert quand le jour monte (clôture d'une mission) — une fois, court.
  const glow = useSharedValue(0);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (!settled) return;
    if (prev.current != null && euros > prev.current) {
      if (!reduced) glow.value = withSequence(withTiming(1, { duration: 250 }), withTiming(0, { duration: 900 }));
      feedback.haptic('success');
    }
    prev.current = euros;
  }, [euros, settled, reduced, glow]);
  const green = COLORS.greenBrand;
  const border = theme.border as string;
  const pillStyle = useAnimatedStyle(() => ({ borderColor: glow.value > 0.5 ? green : border }));
  const burst = useAnimatedStyle(() => ({ opacity: glow.value * 0.45 }));

  return (
    <Animated.View style={[s.row, { top, left, width }, presence]} pointerEvents={visible ? 'box-none' : 'none'}>
      <RoundButton icon="user" onPress={onProfile} label={t('cockpit.profile')} />
      <PressScale onPress={() => { feedback.haptic('light'); onToday(); }}  accessibilityRole="button" accessibilityLabel={t('cockpit.today_a11y', { amount: euros })}>
        <Animated.View style={[s.pill, { backgroundColor: theme.cardBg, shadowOpacity: theme.isDark ? 0.35 : 0.12 }, pillStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: green }, burst]} pointerEvents="none" />
          <View style={s.amount}>
            <DigitReel value={euros} lineHeight={22} textStyle={{ fontFamily: FONTS.bebas, fontSize: 22, lineHeight: 22, color: theme.text as string, letterSpacing: 0.3 }} />
            <Text style={[s.euro, { color: theme.text }]} maxFontSizeMultiplier={1}> €</Text>
          </View>
          <Text style={[s.k, { color: theme.textSub }]} maxFontSizeMultiplier={1}>{t('cockpit.today').toUpperCase()}</Text>
        </Animated.View>
      </PressScale>
      <View style={s.side}>
        <RoundButton icon="message-square" badge={unreadMessages} onPress={onMessages} label={t('cockpit.messages')} />
        <RoundButton icon="bell" badge={unreadNotifs} onPress={onNotifs} label={t('common.notifications')} />
      </View>
    </Animated.View>
  );
}

export const TopRow = memo(TopRowBase);

const s = StyleSheet.create({
  row: { position: 'absolute', zIndex: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rb: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: FONTS.sansBold, fontSize: 10, lineHeight: 12 },
  pill: { height: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden', shadowColor: '#000', shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  amount: { flexDirection: 'row', alignItems: 'flex-end' },
  euro: { fontFamily: FONTS.bebas, fontSize: 22, lineHeight: 22, letterSpacing: 0.3, includeFontPadding: false },
  k: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.5 },
  side: { flexDirection: 'row', gap: 8 },
});
