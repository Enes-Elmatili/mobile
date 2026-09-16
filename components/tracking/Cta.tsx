// components/tracking/Cta.tsx — l'action du stade : un bouton plein de 56 pt,
// toujours à la même place, retour à l'appui. `tone` vert pour clôturer.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';

type Props = { label: string; onPress: () => void; icon?: React.ComponentProps<typeof Feather>['name']; disabled?: boolean; loading?: boolean; tone?: 'accent' | 'green' | 'ghost' };

export function Cta({ label, onPress, icon, disabled = false, loading = false, tone = 'accent' }: Props) {
  const theme = useAppTheme();
  const press = usePressScale(0.97);
  const bg = tone === 'green' ? theme.greenText : tone === 'ghost' ? 'transparent' : theme.accent;
  const fg = tone === 'ghost' ? theme.text : tone === 'green' ? theme.bg : theme.accentText;
  return (
    <Pressable onPress={() => { feedback.haptic('light'); onPress(); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} disabled={disabled || loading} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || loading }}>
      <Animated.View style={[s.btn, tone === 'ghost' ? { borderWidth: 1, borderColor: theme.border, height: 48 } : null, { backgroundColor: bg, opacity: disabled ? 0.35 : 1 }, press.style]}>
        {loading ? <ActivityIndicator color={fg as string} /> : (
          <>
            {icon ? <Feather name={icon} size={18} color={fg as string} /> : null}
            <Text style={[s.label, { color: fg }, tone === 'ghost' && { fontSize: 16 }]} maxFontSizeMultiplier={1.2}>{label.toUpperCase()}</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  label: { fontFamily: FONTS.bebas, fontSize: 18, letterSpacing: 1.5, includeFontPadding: false },
});
