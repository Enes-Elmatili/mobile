// components/ui/PriceDisplay.tsx — Bebas Neue formatted price with currency
// Design system pattern: prices always use Bebas with smaller currency symbol
import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { FONTS } from '@/hooks/use-app-theme';

interface PriceDisplayProps {
  amount: number | string;
  currency?: string;
  size?: number;
  color?: string;
  style?: TextStyle;
}

export default function PriceDisplay({ amount, currency = '\u20AC', size = 40, color, style }: PriceDisplayProps) {
  return (
    <Text style={[
      s.base,
      { fontSize: size, color },
      style,
    ]}>
      {amount}
      <Text style={{ fontSize: size * 0.55, marginLeft: 1 }}>{currency}</Text>
    </Text>
  );
}

const s = StyleSheet.create({
  base: {
    fontFamily: FONTS.bebas,
    letterSpacing: 0.4,
    lineHeight: undefined, // Let RN compute from fontSize
  },
});
