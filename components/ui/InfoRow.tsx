import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InfoRowProps {
  icon: string;
  label: string;
  value: string | number;
  highlight?: boolean;
}

export default function InfoRow({ icon, label, value, highlight }: InfoRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name={icon as any} size={20} color="#666" />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, highlight && styles.valueHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
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
    color: '#666',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
  },
  valueHighlight: {
    fontSize: 32,
    fontWeight: '700',
  },
});
