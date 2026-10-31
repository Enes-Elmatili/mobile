// lib/dashboard/status.ts — statut d'une demande → ce que l'accueil affiche
// (libellé, icône, LED, teinte du badge). Pur : `t` est passé en paramètre.
import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';
import { COLORS } from '@/hooks/use-app-theme';

export type FeatherName = ComponentProps<typeof Feather>['name'];
type T = (key: string) => string;

export type StatusInfo = { label: string; icon: FeatherName; ledColor: string };

export const getStatusInfo = (status: string, t: T): StatusInfo => {
  const s = (status || 'PENDING').toUpperCase();
  const map: Record<string, StatusInfo> = {
    DONE:            { label: t('dashboard.status_done'),      icon: 'check-circle', ledColor: COLORS.green },
    CANCELLED:       { label: t('dashboard.status_cancelled'), icon: 'x-circle',     ledColor: COLORS.red },
    ONGOING:         { label: t('dashboard.status_ongoing'),   icon: 'clock',        ledColor: COLORS.green },
    PUBLISHED:       { label: t('dashboard.status_published'), icon: 'radio',        ledColor: COLORS.amber },
    ACCEPTED:        { label: t('dashboard.status_accepted'),  icon: 'check',        ledColor: COLORS.green },
    PENDING_PAYMENT: { label: t('dashboard.status_payment'),   icon: 'credit-card',  ledColor: COLORS.amber },
    QUOTE_PENDING:   { label: t('dashboard.status_quote_pending'),  icon: 'file-text',    ledColor: COLORS.amber },
    QUOTE_SENT:      { label: t('dashboard.status_quote_sent'),     icon: 'file-text',    ledColor: COLORS.green },
    QUOTE_ACCEPTED:  { label: t('dashboard.status_quote_accepted'), icon: 'check-circle', ledColor: COLORS.green },
    QUOTE_REFUSED:   { label: t('dashboard.status_cancelled'),      icon: 'x-circle',     ledColor: COLORS.red },
    QUOTE_EXPIRED:   { label: t('dashboard.status_quote_expired'),  icon: 'clock',        ledColor: COLORS.red },
    EXPIRED:         { label: t('dashboard.status_expired'),   icon: 'clock',        ledColor: COLORS.red },
  };
  return map[s] || { label: s, icon: 'help-circle', ledColor: COLORS.amber };
};

/** Teinte du badge d'une ligne d'activité : terminée, annulée/expirée, ou en cours. */
export type BadgeTone = 'done' | 'cancelled' | 'pending';

export function activityBadgeTone(status?: string | null): BadgeTone {
  const statusKey = status?.toUpperCase();
  if (statusKey === 'CANCELLED' || statusKey === 'EXPIRED') return 'cancelled';
  if (['PUBLISHED', 'PENDING', 'PENDING_PAYMENT', 'ACCEPTED', 'ONGOING', 'QUOTE_PENDING'].includes(statusKey || '')) return 'pending';
  return 'done';
}

/** Le badge d'une carte « À venir » : paiement en attente, devis, ou planifiée. */
export type UpcomingKind = { isQuote: boolean; isAccepted: boolean; isPendingPayment: boolean };

export function upcomingKindOf(r: { status?: string | null; pricingMode?: string | null }): UpcomingKind {
  const statusUp = (r.status || '').toUpperCase();
  return {
    isQuote: r.pricingMode === 'estimate' || r.pricingMode === 'diagnostic',
    isAccepted: statusUp === 'ACCEPTED',
    // Paiement jamais finalisé (PaymentSheet abandonnée) : la demande n'est PAS
    // visible des prestataires — l'état doit être explicite avant même le tap.
    isPendingPayment: statusUp === 'PENDING_PAYMENT',
  };
}

export const getServiceIcon = (label?: string): FeatherName => {
  if (!label) return 'tool';
  const t = label.toLowerCase();
  if (t.includes('bricol'))                             return 'tool';
  if (t.includes('jardin') || t.includes('pelouse'))    return 'feather';
  if (t.includes('ménage') || t.includes('nettoyage'))  return 'star';
  if (t.includes('démén') || t.includes('demen'))       return 'package';
  if (t.includes('peint'))                              return 'edit-2';
  if (t.includes('plomb'))                              return 'droplet';
  if (t.includes('électr') || t.includes('electr'))     return 'zap';
  if (t.includes('chauff'))                             return 'zap';
  if (t.includes('serrur'))                             return 'key';
  if (t.includes('urgence'))                            return 'tool';
  if (t.includes('rénov') || t.includes('renov'))       return 'tool';
  return 'tool';
};
