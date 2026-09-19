// components/ui/SlideToConfirm.tsx
// Un engagement mérite un geste : accepter une mission se fait en glissant.
// Élastique si on lâche tôt, projection de l'élan si on flick (lib/motion).
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS, alpha } from '@/hooks/use-app-theme';
import { useSlideToConfirm } from '@/lib/motion/useSlideToConfirm';

const KNOB = 52;
const HEIGHT = 58;

type Props = {
  label?: string;
  doneLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
  /** Après confirmation, le curseur reste au bout et le libellé passe à `doneLabel`. */
  done?: boolean;
};

export function SlideToConfirm({ label, doneLabel, onConfirm, disabled = false, done = false }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const { gesture, knobStyle, fillStyle, labelStyle } = useSlideToConfirm({ trackWidth, knobSize: KNOB, onConfirm });
  const activeGesture = useMemo(() => gesture.enabled(!(disabled || done)), [gesture, disabled, done]);
  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={[s.track, { backgroundColor: theme.surface, borderColor: done ? COLORS.green : theme.border, opacity: disabled ? 0.5 : 1 }]}
      accessibilityRole="adjustable"
      accessibilityLabel={label ?? t('common.slide_to_accept')}
      accessibilityHint={t('common.slide_to_accept_hint')}
    >
      <Animated.View style={[s.fill, { backgroundColor: alpha(COLORS.greenBrand, 0.16) }, fillStyle]} />
      <Animated.View style={[s.labelWrap, labelStyle]} pointerEvents="none">
        <Text style={[s.label, { color: done ? COLORS.green : theme.textSub }]} numberOfLines={1}>
          {done ? (doneLabel ?? t('common.accepted')) : (label ?? t('common.slide_to_accept'))}
        </Text>
      </Animated.View>
      <GestureDetector gesture={activeGesture}>
        <Animated.View style={[s.knob, { backgroundColor: done ? COLORS.green : theme.accent }, knobStyle]}>
          <Feather name={done ? 'check' : 'arrow-right'} size={20} color={theme.accentText as string} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({
  track: { height: HEIGHT, borderRadius: HEIGHT / 2, borderWidth: 1, overflow: 'hidden', justifyContent: 'center' },
  // Rond par lui-même : iOS ne découpe pas toujours un enfant carré dans un
  // parent arrondi à bordure (le coin vert qui dépassait de la piste).
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 0, borderRadius: HEIGHT / 2 },
  labelWrap: { position: 'absolute', left: KNOB + 6, right: 16, alignItems: 'center' },
  label: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 16, letterSpacing: 1.2 },
  knob: { position: 'absolute', left: 3, top: 3, width: KNOB, height: KNOB, borderRadius: KNOB / 2, alignItems: 'center', justifyContent: 'center' },
});
