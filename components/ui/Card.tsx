import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function Card({ children, style }: CardProps) {
  const theme = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, shadowOpacity: theme.shadowOpacity }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
});
