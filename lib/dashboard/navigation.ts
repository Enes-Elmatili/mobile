// lib/dashboard/navigation.ts — où mène un tap sur l'accueil client, selon
// l'état de la demande. Pur : renvoie les cibles, l'écran fait router.push.
import type { MissionLink } from './types';

/** Les paramètres de /request/[id]/missionview (le suivi) pour une demande. */
export function missionViewParams(r: MissionLink, locale: string, nowLabel: () => string) {
  const scheduledFor = r.scheduledFor || r.preferredTimeStart;
  return {
    id:             String(r.id),
    serviceName:    r.title || r.serviceType || r.name || '',
    address:        r.address || '',
    price:          String(r.price || ''),
    scheduledLabel: scheduledFor
      ? new Date(scheduledFor).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : nowLabel(),
    expiresAt: r.expiresAt || '',
    lat: String(r.lat || ''),
    lng: String(r.lng || ''),
  };
}

/** Un devis : à relire s'il est envoyé (QUOTE_SENT), sinon on suit la demande. */
export function quoteHref(r: { id: string | number; status?: string | null }) {
  const path = r.status?.toUpperCase() === 'QUOTE_SENT'
    ? '/request/[id]/quote-review' as const
    : '/request/[id]/missionview' as const;
  return { pathname: path, params: { id: String(r.id) } };
}

// Routage par état (même règle que documents.tsx) :
// paiement jamais finalisé → reprise du paiement, pas le récap
// qui laisserait croire que la demande est visible des prestataires.
export function upcomingHref(r: { id: string | number; status?: string | null }) {
  return r.status?.toUpperCase() === 'PENDING_PAYMENT'
    ? { pathname: '/request/[id]/resume-payment' as const, params: { id: String(r.id) } }
    : { pathname: '/request/[id]/scheduled' as const, params: { id: String(r.id), mode: 'recap' } };
}
