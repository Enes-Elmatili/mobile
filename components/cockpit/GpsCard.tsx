// components/cockpit/GpsCard.tsx — localisation refusée : sans position, rien
// n'arrive. Une carte à la place de la journée, un seul bouton : Autoriser
// (ouvre les réglages du système).
import React, { memo } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { usePresence } from '@/lib/motion/usePresence';
import { feedback } from '@/lib/feedback/feedback';

type Props = { visible: boolean; bottom: number; left: number; width: number };

function GpsCardBase({ visible, bottom, left, width }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { style: presence } = usePresence(visible, { from: 'bottom' });
  return (
    <Animated.View style={[s.wrap, { bottom, left, width }, presence]} pointerEvents={visible ? 'box-none' : 'none'}>
      <Pressable
        onPress={() => { feedback.haptic('light'); Linking.openSettings(); }}
        style={({ pressed }) => [s.card, { backgroundColor: theme.cardBg, borderColor: theme.danger, opacity: pressed ? 0.7 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={`${t('cockpit.gps_refused')}. ${t('cockpit.gps_allow')}`}
      >
        <Text style={[s.text, { color: theme.textSub }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{t('cockpit.gps_refused')}</Text>
        <Text style={[s.cta, { color: theme.text, backgroundColor: theme.surface }]} maxFontSizeMultiplier={1.1}>{t('cockpit.gps_allow').toUpperCase()}</Text>
      </Pressable>
    </Animated.View>
  );
}

export const GpsCard = memo(GpsCardBase);

const s = StyleSheet.create({
  wrap: { position: 'absolute', zIndex: 5 },
  card: { borderRadius: 16, borderWidth: 1, minHeight: 56, padding: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1, fontFamily: FONTS.sans, fontSize: 13 },
  cta: { fontFamily: FONTS.bebas, fontSize: 15, letterSpacing: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, overflow: 'hidden', includeFontPadding: false },
});
