// components/notifications/NotifRow.tsx — une ligne de la cloche.
// Trois familles, trois couleurs (mission ambre · argent vert · compte gris) ;
// le non-lu, c'est le point sur l'icône et la graisse du titre — pas un fond.
// La puce « MISSION #47 » dit où le tap mène. Glisser à gauche supprime.
import React, { memo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, COLORS, FONTS } from '@/hooks/use-app-theme';
import { feedback } from '@/lib/feedback/feedback';
import { familyOf, refChip, timeLabel, type Family, type Notif } from '@/lib/notifications/model';

const FAMILY_ICON: Record<Family, React.ComponentProps<typeof Feather>['name']> = {
  mission: 'map-pin', money: 'credit-card', account: 'user', message: 'message-square', news: 'bell',
};

function DeleteAction({ progress }: { progress: SharedValue<number> }) {
  const { t } = useTranslation();
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.value * 1.5), transform: [{ scale: 0.85 + 0.15 * Math.min(1, progress.value) }] }));
  return (
    <View style={s.action}>
      <Animated.View style={[s.actionPill, style]}>
        <Feather name="trash-2" size={16} color="#FCA5A5" />
        <Text style={s.actionText} maxFontSizeMultiplier={1.1}>{t('common.delete').toUpperCase()}</Text>
      </Animated.View>
    </View>
  );
}

type Props = { item: Notif; first: boolean; now: Date; onOpen: (n: Notif) => void; onLongPress: (n: Notif) => void; onDelete: (id: string) => void };

function NotifRowBase({ item, first, now, onOpen, onLongPress, onDelete }: Props) {
  const theme = useAppTheme();
  const { t, i18n } = useTranslation();
  const swipeRef = useRef<SwipeableMethods>(null);
  const family = familyOf(item);
  const unread = !item.readAt;
  const tone = family === 'mission' ? COLORS.amber : family === 'money' ? COLORS.greenBrand : theme.textSub;
  const chip = refChip(item, t);
  const when = timeLabel(item.createdAt, t, now, i18n.language);
  const a11y = [unread ? t('notifications.unread') : null, item.title, item.message, when, chip?.label].filter(Boolean).join(', ');

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={1.6}
      overshootFriction={8}
      rightThreshold={72}
      renderRightActions={(progress) => <DeleteAction progress={progress} />}
      onSwipeableOpen={() => { feedback.haptic('light'); onDelete(item.id); }}
    >
      <Pressable
        onPress={() => onOpen(item)}
        onLongPress={() => onLongPress(item)}
        delayLongPress={350}
        style={({ pressed }) => [s.row, { backgroundColor: pressed ? theme.surface : theme.bg }]}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityHint={t('notifications.row_hint')}
      >
        {!first ? <View style={[s.sep, { backgroundColor: theme.borderLight }]} /> : null}
        <View style={[s.ic, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Feather name={FAMILY_ICON[family]} size={18} color={tone as string} />
          {unread ? <View style={[s.dot, { backgroundColor: theme.accent, borderColor: theme.bg }]} /> : null}
        </View>
        <View style={s.body}>
          <View style={s.head}>
            <Text style={[s.title, { color: theme.text, fontFamily: unread ? FONTS.sansBold : FONTS.sansMedium }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{item.title}</Text>
            <Text style={[s.when, { color: theme.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={1.1}>{when.toUpperCase()}</Text>
          </View>
          <Text style={[s.msg, { color: theme.textSub }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{item.message}</Text>
          {chip ? (
            <View style={[s.chip, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Feather name={chip.primary ? 'arrow-right' : 'file-text'} size={11} color={chip.primary ? (theme.text as string) : (theme.textSub as string)} />
              <Text style={[s.chipText, { color: chip.primary ? theme.text : theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.1}>{chip.label}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

export const NotifRow = memo(NotifRowBase);

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'flex-start' },
  sep: { position: 'absolute', left: 76, right: 20, top: 0, height: StyleSheet.hairlineWidth },
  ic: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  body: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 14.5, lineHeight: 19 },
  when: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 0.5, flexShrink: 0 },
  msg: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18.5, marginTop: 3 },
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 6, borderWidth: 1 },
  chipText: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1 },
  action: { width: 96, justifyContent: 'center', alignItems: 'center', backgroundColor: '#3A1111' },
  actionPill: { alignItems: 'center', gap: 4 },
  actionText: { fontFamily: FONTS.bebas, fontSize: 13, letterSpacing: 1.5, color: '#FCA5A5', includeFontPadding: false },
});
