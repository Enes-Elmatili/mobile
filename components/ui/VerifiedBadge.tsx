// components/ui/VerifiedBadge.tsx — Green circle with check icon
// Design system pattern: verified provider indicator
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/use-app-theme';

interface VerifiedBadgeProps {
  size?: number;
}

export default function VerifiedBadge({ size = 16 }: VerifiedBadgeProps) {
  const theme = useAppTheme();
  return (
    <View style={[
      s.circle,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.verifiedBg,
      },
    ]}>
      <Feather name="check" size={size * 0.68} color={theme.verifiedFg} />
    </View>
  );
}

const s = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
