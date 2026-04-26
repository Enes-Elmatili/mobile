import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme } from '@/hooks/use-app-theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Override default padding (16) */
  pad?: number;
}

export default function Card({ children, style, pad }: CardProps) {
  const theme = useAppTheme();
  return (
    <View style={[
      styles.card,
      {
        backgroundColor: theme.cardBg,
        borderColor: theme.borderLight,
        shadowOpacity: theme.shadowOpacity,
      },
      pad !== undefined && { padding: pad },
      style,
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
});
