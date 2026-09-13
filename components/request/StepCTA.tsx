// components/request/StepCTA.tsx
// Bouton principal du stepper (planche 4A) : une pilule plate de 52 pt, le
// libellé à gauche, une flèche ou le montant à droite. Désactivé : le bouton
// reste visible à 35 % et une ligne au-dessus dit ce qui manque.
// Retour à l'appui (usePressScale, règle 4), haptique medium au onPress.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Ligne d'indication affichée au-dessus quand le bouton est désactivé. */
  hint?: string;
  /** Montant à droite (étape 4). Sans montant : une flèche. */
  amount?: string;
  /** Étape 4 : libellé en Bebas 24. */
  emphasis?: boolean;
  /** Bouton posé sur un dégradé (étape 1) : ni fond ni bordure haute. */
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StepCTA({ label, onPress, disabled, loading, hint, amount, emphasis, floating, style }: Props) {
  const theme = useAppTheme();
  const press = usePressScale();
  const inert = !!disabled || !!loading;

  const handlePress = () => {
    if (inert) return;
    feedback.haptic('medium');
    onPress();
  };

  return (
    <View style={[s.wrap, !floating && { backgroundColor: theme.bg, borderTopColor: theme.borderLight, borderTopWidth: 1 }, style]}>
      {disabled && !loading && hint ? (
        <Text style={[s.hint, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{hint}</Text>
      ) : null}
      <Animated.View style={[press.style, disabled && s.dimmed]}>
        <Pressable
          onPress={handlePress}
          onPressIn={inert ? undefined : press.onPressIn}
          onPressOut={inert ? undefined : press.onPressOut}
          disabled={inert}
          accessibilityRole="button"
          accessibilityLabel={amount ? `${label} ${amount}` : label}
          accessibilityState={{ disabled: inert, busy: !!loading }}
          style={[s.btn, { backgroundColor: theme.accent }]}
        >
          {loading ? (
            <ActivityIndicator color={theme.accentText as string} />
          ) : (
            <>
              <Text
                style={[s.label, emphasis && s.labelEmphasis, { color: theme.accentText }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
              >
                {label}
              </Text>
              {amount ? (
                <View style={[s.amount, { backgroundColor: theme.isDark ? 'rgba(10,10,10,0.08)' : 'rgba(255,255,255,0.14)' }]}>
                  <Text style={[s.amountText, { color: theme.accentText }]}>{amount}</Text>
                </View>
              ) : (
                <View style={s.arrow}>
                  <Feather name="arrow-right" size={20} color={theme.accentText as string} />
                </View>
              )}
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:          { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  hint:          { fontFamily: FONTS.sans, fontSize: 12.5, textAlign: 'center', marginBottom: 10 },
  dimmed:        { opacity: 0.35 },
  btn:           { height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 22, paddingRight: 8 },
  label:         { flex: 1, fontFamily: FONTS.sansMedium, fontSize: 17 },
  labelEmphasis: { fontFamily: FONTS.bebas, fontSize: 24, letterSpacing: 0.5, includeFontPadding: false },
  arrow:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  amount:        { height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  amountText:    { fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 0.3, includeFontPadding: false, fontVariant: ['tabular-nums'] },
});
