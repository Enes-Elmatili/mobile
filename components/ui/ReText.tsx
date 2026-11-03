// components/ui/ReText.tsx
// Texte animé sans re-render React : un TextInput non éditable dont la prop
// `text` est écrite depuis le thread UI (useAnimatedProps).
import React from 'react';
import { TextInput, type TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  animatedProps: React.ComponentProps<typeof AnimatedTextInput>['animatedProps'];
  style?: TextStyle | TextStyle[];
  accessibilityLabel?: string;
};

export function ReText({ animatedProps, style, accessibilityLabel }: Props) {
  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      caretHidden
      pointerEvents="none"
      animatedProps={animatedProps}
      accessibilityLabel={accessibilityLabel}
      style={[{ padding: 0, margin: 0, includeFontPadding: false, fontVariant: ['tabular-nums'] }, style]}
    />
  );
}
