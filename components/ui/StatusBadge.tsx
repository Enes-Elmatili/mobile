import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

type Status = 'PUBLISHED' | 'ACCEPTED' | 'ONGOING' | 'DONE' | 'CANCELLED' | 'PENDING_PAYMENT';

interface StatusBadgeProps {
  status: Status;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: string }> = {
  DONE: { label: 'Terminé', color: COLORS.green, icon: 'check-circle' },
  CANCELLED: { label: 'Annulé', color: COLORS.red, icon: 'x-circle' },
  ONGOING: { label: 'En cours', color: COLORS.statusOngoing, icon: 'clock' },
  PUBLISHED: { label: 'Publié', color: COLORS.amber, icon: 'eye' },
  ACCEPTED: { label: 'Accepté', color: COLORS.statusAccepted, icon: 'check' },
  PENDING_PAYMENT: { label: 'Paiement', color: COLORS.statusPending, icon: 'credit-card' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const theme = useAppTheme();
  const config = STATUS_CONFIG[status] || { label: status, color: theme.textMuted, icon: 'help-circle' };

  // Use a subtle background tint with the status color for dark mode support
  const bgColor = theme.isDark
    ? `${config.color}22`  // ~13% opacity
    : `${config.color}18`; // ~9% opacity

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Feather name={config.icon as any} size={16} color={config.color} />
      <Text style={[styles.text, { color: config.color, fontFamily: FONTS.sansMedium }]}>{config.label}</Text>
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
    fontSize: 12,
    marginLeft: 6,
    textTransform: 'uppercase',
  },
});
