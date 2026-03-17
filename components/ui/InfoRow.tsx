import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

interface InfoRowProps {
  icon: string;
  label: string;
  value: string | number;
  highlight?: boolean;
}

export default function InfoRow({ icon, label, value, highlight }: InfoRowProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
      <View style={styles.header}>
        <Ionicons name={icon as any} size={20} color={theme.textSub} />
        <Text style={[styles.label, { color: theme.textSub }]}>{label}</Text>
      </View>
      <Text style={[styles.value, { color: theme.text }, highlight && styles.valueHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    lineHeight: 24,
  },
  valueHighlight: {
    fontSize: 32,
    fontWeight: '700',
  },
});
