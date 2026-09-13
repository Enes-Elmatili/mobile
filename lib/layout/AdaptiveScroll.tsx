// lib/layout/AdaptiveScroll.tsx
// Un formulaire qui s'étire sur 780 pt devient inconfortable : lignes de
// texte trop longues, CTA géant. Sur « regular », le contenu garde une
// largeur de lecture (560 pt) et se centre ; sur « compact », rien ne change.
import React from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useLayoutClass } from './useLayoutClass';

export const READING_MAX_WIDTH = 560;

type Props = ScrollViewProps & {
  /** Largeur max du contenu sur regular. */
  maxWidth?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function AdaptiveScroll({ maxWidth = READING_MAX_WIDTH, contentContainerStyle, children, ...rest }: Props) {
  const { isRegular } = useLayoutClass();
  return (
    <ScrollView {...rest} contentContainerStyle={[contentContainerStyle, isRegular && [s.centered, { maxWidth }]]}>
      {children}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  centered: { alignSelf: 'center', width: '100%' },
});
