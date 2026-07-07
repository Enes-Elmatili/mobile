// lib/requestDestination.ts
// ─── Source de vérité unique : état d'une demande → écran + libellé de CTA ────
// Une notification (ou un deep-link) porte une intention figée à l'instant de sa
// création. Mais le statut de la demande, lui, continue d'évoluer. On RE-résout
// donc TOUJOURS la destination ET le libellé du CTA contre l'état COURANT avant
// de naviguer, jamais après être arrivé sur l'écran.
//   → plus de "searching view" sur une mission annulée/terminée
//   → plus de page de notation ré-ouverte alors que la note est déjà postée
//   → plus de CTA qui ment ("Voir la mission" sur une mission notée)
//   → côté prestataire : devis accepté → la mission réelle, pas un dashboard vide
// Tous les points d'entrée (CTA notif client/prestataire, deep-link push)
// consomment ce module : la logique d'état vit à un seul endroit.

import { router } from 'expo-router';
import { api } from './api';
import { devWarn } from './logger';

export interface RequestLike {
  id: number | string;
  status?: string;
  reviewExists?: boolean;
  preferredTimeStart?: string | null;
}

export interface RequestDestination {
  pathname: string;
  params?: Record<string, string>;
  replace?: boolean;
  ctaKey: string;   // clé i18n du libellé (namespace `notifications`)
  icon: string;     // icône Feather
}

// ─── Destinations "feed" sans état (fallbacks) ───────────────────────────────
const DASHBOARD: RequestDestination =
  { pathname: '/(tabs)/dashboard', replace: true, ctaKey: 'go_to_space', icon: 'grid' };
const PROVIDER_MISSIONS: RequestDestination =
  { pathname: '/(tabs)/missions', replace: true, ctaKey: 'cta_view_missions', icon: 'briefcase' };
// L'onglet Opportunités vit DANS l'écran Missions (tab interne par défaut) —
// l'ancien écran /(tabs)/opportunities a été supprimé.
const PROVIDER_OPPORTUNITIES: RequestDestination =
  { pathname: '/(tabs)/missions', replace: true, ctaKey: 'cta_view_opportunities', icon: 'compass' };

// Remboursement : on mène à la PREUVE — la facture précise passée en "Remboursé"
// (ouverte directement dans l'onglet Documents via `openRequestId`).
export function refundDestination(requestId?: string): RequestDestination {
  return {
    pathname: '/(tabs)/documents',
    params: requestId ? { openRequestId: requestId } : undefined,
    ctaKey: 'cta_view_refund',
    icon: 'rotate-ccw',
  };
}

// Mission planifiée = rendez-vous fixé à plus de 30 min dans le futur : pas de
// tracking prématuré, on renvoie vers le récap.
function isScheduled(req: RequestLike): boolean {
  if (!req.preferredTimeStart) return false;
  const ts = new Date(req.preferredTimeStart).getTime();
  return Number.isFinite(ts) && ts > Date.now() + 30 * 60 * 1000;
}

// ─── Résolveur CLIENT ─────────────────────────────────────────────────────────
export function resolveRequestDestination(req: RequestLike | null | undefined): RequestDestination {
  if (!req?.id) return DASHBOARD;
  const id = String(req.id);
  const status = (req.status || '').toUpperCase();
  const missionView = (ctaKey: string, icon: string): RequestDestination =>
    ({ pathname: '/request/[id]/missionview', params: { id }, ctaKey, icon });

  switch (status) {
    case 'PENDING_PAYMENT':
      return { pathname: '/request/[id]/resume-payment', params: { id }, ctaKey: 'cta_resume_payment', icon: 'credit-card' };

    case 'PUBLISHED':       // recherche de prestataire → searching view légitime
      return missionView('cta_track_search', 'search');
    case 'ONGOING':         // prestataire en route / sur place → tracking
    case 'QUOTE_ACCEPTED':  // transition backend en cours → loader missionview
      return missionView('cta_track_mission', 'map-pin');

    case 'ACCEPTED':
      return isScheduled(req)
        ? { pathname: '/request/[id]/scheduled', params: { id, mode: 'recap' }, ctaKey: 'cta_view_recap', icon: 'calendar' }
        : missionView('cta_track_mission', 'map-pin');

    case 'QUOTE_PENDING':
      return { pathname: '/request/[id]/quote-pending', params: { id }, ctaKey: 'cta_track_quote', icon: 'clock' };
    case 'QUOTE_SENT':
      return { pathname: '/request/[id]/quote-review', params: { id }, ctaKey: 'cta_view_quote', icon: 'file-text' };

    case 'QUOTE_REFUSED':
    case 'QUOTE_EXPIRED':
    case 'CANCELLED':
      return DASHBOARD;

    case 'DONE':
      // Mission terminée : on note SI ce n'est pas déjà fait, sinon la facture.
      return req.reviewExists
        ? { pathname: '/(tabs)/documents', params: { openRequestId: id }, ctaKey: 'cta_view_invoice', icon: 'file-text' }
        : { pathname: '/request/[id]/rating', params: { id }, ctaKey: 'cta_rate', icon: 'star' };

    case 'REFUNDED':
      return refundDestination(id);

    default:
      return DASHBOARD;
  }
}

// ─── Résolveur PRESTATAIRE ──────────────────────────────────────────────────
// Utilisé pour les notifs liées au propre devis du prestataire (quote_accepted /
// quote_refused) : la demande lui est alors assignée, on a accès à son détail.
export function resolveProviderDestination(req: RequestLike | null | undefined): RequestDestination {
  if (!req?.id) return PROVIDER_MISSIONS;
  const id = String(req.id);
  const status = (req.status || '').toUpperCase();

  switch (status) {
    case 'QUOTE_PENDING':                 // le prestataire doit (encore) envoyer son devis
      return { pathname: '/request/[id]/send-quote', params: { id }, ctaKey: 'cta_send_quote', icon: 'edit-3' };
    case 'QUOTE_SENT':                    // devis envoyé, en attente du client
      return PROVIDER_MISSIONS;

    case 'QUOTE_ACCEPTED':
    case 'ACCEPTED':
    case 'ONGOING':                       // mission active du prestataire
      return { pathname: '/request/[id]/ongoing', params: { id }, ctaKey: 'cta_view_mission', icon: 'briefcase' };

    case 'DONE':                          // mission terminée → ses gains
      return { pathname: '/request/[id]/earnings', params: { id }, ctaKey: 'cta_view_earnings', icon: 'dollar-sign' };

    case 'QUOTE_REFUSED':
    case 'QUOTE_EXPIRED':
    case 'PUBLISHED':
    case 'PENDING_PAYMENT':               // opportunité perdue / pas encore à lui → le flux d'opportunités
      return PROVIDER_OPPORTUNITIES;

    case 'CANCELLED':
    case 'REFUNDED':
      return PROVIDER_MISSIONS;

    default:
      return PROVIDER_MISSIONS;
  }
}

// ─── Classification d'une notification → intention de navigation ─────────────
const PROVIDER_OPPORTUNITY_TYPES = new Set(['new_request', 'new_opportunity', 'preferred_request', 'preferred_opportunity']);
const PROVIDER_QUOTE_TYPES = new Set(['quote_accepted', 'quote_refused']);
const CLIENT_REQUEST_CATEGORIES = new Set(['mission', 'mission_update', 'rating', 'dispute']);
const CLIENT_REQUEST_SCREENS = new Set(['MissionView', 'QuoteReview', 'Rating']);

export type NotifIntent =
  | { kind: 'support' }
  | { kind: 'kyc' }
  | { kind: 'opportunity' }
  | { kind: 'refund'; requestId?: string }
  | { kind: 'client-request'; requestId: string }
  | { kind: 'provider-request'; requestId: string }
  | { kind: 'screen' }
  | { kind: 'space' };

export function classifyNotification(data: any): NotifIntent {
  if (!data) return { kind: 'space' };
  const { category, type, screen, requestId } = data;
  const rid = requestId != null ? String(requestId) : undefined;

  if (category === 'support' || type === 'support_escalation') return { kind: 'support' };
  if (type === 'kyc_status') return { kind: 'kyc' };
  if (PROVIDER_OPPORTUNITY_TYPES.has(type)) return { kind: 'opportunity' };
  if (PROVIDER_QUOTE_TYPES.has(type) && rid) return { kind: 'provider-request', requestId: rid };
  if (category === 'refund' || type === 'refund') return { kind: 'refund', requestId: rid };
  if (rid && (CLIENT_REQUEST_CATEGORIES.has(category) || CLIENT_REQUEST_SCREENS.has(screen) || type === 'quote_received')) {
    return { kind: 'client-request', requestId: rid };
  }
  if (screen) return { kind: 'screen' };
  return { kind: 'space' };
}

// ─── Navigation ──────────────────────────────────────────────────────────────
export function navigateToDestination(dest: RequestDestination): void {
  const target = dest.params ? { pathname: dest.pathname, params: dest.params } : dest.pathname;
  if (dest.replace) router.replace(target as any);
  else router.push(target as any);
}

// Récupère l'état COURANT de la demande puis RÉSOUT la destination (sans naviguer).
// Sert au CTA pour afficher un libellé honnête, et à la navigation. Fallback sûr.
export async function resolveRequestById(
  requestId: number | string,
  opts?: { provider?: boolean },
): Promise<RequestDestination> {
  try {
    const res: any = await api.requests.get(String(requestId));
    const req: RequestLike = res?.data ?? res;
    return opts?.provider ? resolveProviderDestination(req) : resolveRequestDestination(req);
  } catch (e: any) {
    devWarn('[requestDestination] résolution échouée:', e?.message);
    return opts?.provider ? PROVIDER_MISSIONS : DASHBOARD;
  }
}

export async function navigateToRequestById(
  requestId: number | string,
  opts?: { provider?: boolean },
): Promise<void> {
  navigateToDestination(await resolveRequestById(requestId, opts));
}
