import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Status = 'PUBLISHED' | 'ACCEPTED' | 'ONGOING' | 'DONE' | 'CANCELLED' | 'PENDING_PAYMENT';

interface StatusBadgeProps {
  status: Status;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: string }> = {
  DONE: { label: 'Terminé', color: '#22C55E', icon: 'checkmark-circle' },
  CANCELLED: { label: 'Annulé', color: '#EF4444', icon: 'close-circle' },
  ONGOING: { label: 'En cours', color: '#3B82F6', icon: 'time' },
  PUBLISHED: { label: 'Publié', color: '#F59E0B', icon: 'eye' },
  ACCEPTED: { label: 'Accepté', color: '#8B5CF6', icon: 'hand-left' },
  PENDING_PAYMENT: { label: 'Paiement', color: '#EC4899', icon: 'card' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, color: '#6B7280', icon: 'help-circle' };

  return (
    <View style={[styles.badge, { backgroundColor: config.color }]}>
      <Ionicons name={config.icon as any} size={16} color="#fff" />
      <Text style={styles.text}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
});
