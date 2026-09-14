// components/tracking/StageHeader.tsx
// L'en-tête de la feuille de suivi : ligne mono (le fait et l'heure), titre
// Bebas, sous-titre. Chaque changement de stade entre par un léger fondu +
// glissé (useEntrance), coupe nette sous réduction des animations.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useEntrance } from '@/lib/motion';
import { PulseDot } from '@/components/ui/PulseDot';

type Props = {
  kicker: string;
  title?: string | null;
  sub?: string | null;
  /** Point vert qui respire devant la ligne mono (position en direct). */
  live?: boolean;
  /** Change à chaque stade : rejoue l'entrée. */
  stageKey: string;
};

export function StageHeader({ kicker, title, sub, live = false, stageKey }: Props) {
  const theme = useAppTheme();
  const entrance = useEntrance(10);
  useEffect(() => { entrance.replay(); }, [stageKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={entrance.style}>
      <View style={s.kickerRow}>
        {live ? <PulseDot size={6} color={COLORS.greenBrand} /> : null}
        <Text style={[s.kicker, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{kicker}</Text>
      </View>
      {title ? <Text style={[s.title, { color: theme.text }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{title}</Text> : null}
      {sub ? <Text style={[s.sub, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{sub}</Text> : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker:    { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.5 },
  title:     { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 0.3, includeFontPadding: false, marginTop: 6 },
  sub:       { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18, marginTop: 4 },
});
