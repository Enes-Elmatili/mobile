// components/ui/DigitReel.tsx
// Un nombre affiché chiffre par chiffre, chaque chiffre roulant vers sa cible
// (compteur d'aéroport). Pour l'ETA : « 6 min » ne saute pas à « 5 min ».
import React from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { splitDigits, useDigitReel } from '@/lib/motion/useDigitReel';

function Reel({ digit, lineHeight, textStyle }: { digit: number; lineHeight: number; textStyle: TextStyle }) {
  const style = useDigitReel(digit, lineHeight);
  return (
    <View style={{ height: lineHeight, overflow: 'hidden' }}>
      <Animated.View style={style}>
        {Array.from({ length: 10 }, (_, i) => (
          <Text key={i} style={[textStyle, { height: lineHeight, lineHeight, includeFontPadding: false }]}>
            {i}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

type Props = {
  value: number | string;
  textStyle: TextStyle;
  lineHeight: number;
  accessibilityLabel?: string;
};

/** Affiche `value` (ex. 21) chiffre par chiffre, chaque chiffre roulant vers sa cible. */
export function DigitReel({ value, textStyle, lineHeight, accessibilityLabel }: Props) {
  const digits = splitDigits(value);
  return (
    <View style={s.row} accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? String(value)}>
      {digits.map((d, i) => (
        // La clé inclut le nombre de chiffres : passer de 10 à 9 reconstruit sans animer.
        <Reel key={`${digits.length}-${i}`} digit={d} lineHeight={lineHeight} textStyle={textStyle} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({ row: { flexDirection: 'row' } });
