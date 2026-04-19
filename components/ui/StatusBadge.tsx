import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

// ── Unified StatusChip — one component, all statuses, zero drift ──────────
// Design audit V1.0: uppercase DM Mono, 5/9px padding, 6px colored dot + text.

type Status =
  | 'PENDING_PAYMENT'
  | 'PUBLISHED'
  | 'ACCEPTED'
  | 'ONGOING'
  | 'DONE'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'QUOTE_PENDING'
  | 'QUOTE_SENT'
  | 'QUOTE_ACCEPTED'
  | 'QUOTE_REFUSED'
  | 'QUOTE_EXPIRED';

interface StatusBadgeProps {
  status: string;
  /** Override default label */
  label?: string;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: 'PAIEMENT',       color: COLORS.statusPending },
  PUBLISHED:       { label: 'PUBLIÉ',         color: COLORS.amber },
  ACCEPTED:        { label: 'ACCEPTÉ',        color: COLORS.statusAccepted },
  ONGOING:         { label: 'EN COURS',       color: COLORS.statusOngoing },
  DONE:            { label: 'TERMINÉ',        color: COLORS.green },
  CANCELLED:       { label: 'ANNULÉ',         color: COLORS.red },
  REFUNDED:        { label: 'REMBOURSÉ',      color: COLORS.red },
  QUOTE_PENDING:   { label: 'DEVIS EN ATTENTE', color: COLORS.amber },
  QUOTE_SENT:      { label: 'DEVIS ENVOYÉ',  color: COLORS.orangeBrand },
  QUOTE_ACCEPTED:  { label: 'DEVIS ACCEPTÉ', color: COLORS.greenBrand },
  QUOTE_REFUSED:   { label: 'DEVIS REFUSÉ',  color: COLORS.red },
  QUOTE_EXPIRED:   { label: 'DEVIS EXPIRÉ',  color: COLORS.red },
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const theme = useAppTheme();
  const config = STATUS_CONFIG[status as Status] || { label: status, color: theme.textMuted };

  const bgColor = theme.isDark
    ? `${config.color}22`  // ~13% opacity
    : `${config.color}15`; // ~8% opacity

  return (
    <View style={[s.badge, { backgroundColor: bgColor }]}>
      <View style={[s.dot, { backgroundColor: config.color }]} />
      <Text style={[s.text, { color: config.color }]}>{label || config.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 10,
    fontFamily: FONTS.mono,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
