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
// Les demandes « à prendre » vivent dans l'agenda (onglet Missions).
export const PROVIDER_OPPORTUNITIES: RequestDestination =
  { pathname: '/(tabs)/missions', replace: true, ctaKey: 'cta_view_opportunities', icon: 'compass' };
// Une demande qui vient d'arriver se présente sur l'accueil (la fiche « elle est pour vous »).
export const PROVIDER_HOME: RequestDestination =
  { pathname: '/(tabs)/dashboard', replace: true, ctaKey: 'cta_view_opportunities', icon: 'compass' };
// La mission du prestataire vit sur l'accueil : on la met devant (?mission=).
function providerMission(id: string, ctaKey: string, icon: string): RequestDestination {
  return { pathname: '/(tabs)/dashboard', params: { mission: id }, replace: true, ctaKey, icon };
}

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
      // Le devis en préparation est un stade du suivi (spec 2026-09-14), plus une page à part.
      return { pathname: '/request/[id]/missionview', params: { id }, ctaKey: 'cta_track_quote', icon: 'clock' };
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
    case 'QUOTE_SENT':                    // devis envoyé, le client décide — la feuille le dit, sur l'accueil
      return providerMission(id, 'cta_view_mission', 'briefcase');

    case 'QUOTE_ACCEPTED':
    case 'ACCEPTED':                      // mission du prestataire (devis à rédiger compris) : elle vit sur l'accueil
    case 'ONGOING':
      return providerMission(id, 'cta_view_mission', 'briefcase');

    case 'DONE':                          // mission terminée → ses gains
      return { pathname: '/request/[id]/earnings', params: { id }, ctaKey: 'cta_view_earnings', icon: 'dollar-sign' };

    case 'QUOTE_PENDING':                 // payée, pas encore prise : « à prendre »
    case 'QUOTE_REFUSED':
    case 'QUOTE_EXPIRED':
    case 'PUBLISHED':
    case 'PENDING_PAYMENT':               // opportunité perdue / pas encore à lui → « à prendre »
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
// mission_assigned : assignation manuelle depuis le panel admin — même
// résolution que les devis : l'état courant de SA mission, côté prestataire.
const PROVIDER_QUOTE_TYPES = new Set(['quote_accepted', 'quote_refused', 'mission_assigned']);
const CLIENT_REQUEST_CATEGORIES = new Set(['mission', 'mission_update', 'rating', 'dispute']);
const CLIENT_REQUEST_SCREENS = new Set(['MissionView', 'QuoteReview', 'Rating']);

export type NotifIntent =
  | { kind: 'support' }
  | { kind: 'kyc' }
  | { kind: 'opportunity'; home?: boolean; requestId?: string }
  | { kind: 'route'; dest: RequestDestination }
  | { kind: 'refund'; requestId?: string }
  | { kind: 'client-request'; requestId: string }
  | { kind: 'provider-request'; requestId: string }
  | { kind: 'screen' }
  | { kind: 'space' };

// ─── Événements du catalogue dont la destination ne se déduit pas de l'écran ──
// Chaque ligne corrige un cas où la notification menait ailleurs que ce
// qu'elle annonce (audit 2026-09-25). Renvoie null → règle générale.
function documentsFor(rid: string | undefined, ctaKey: string, icon: string): RequestDestination {
  return { pathname: '/(tabs)/documents', params: rid ? { openRequestId: rid } : undefined, ctaKey, icon };
}
const INVOICES: RequestDestination = { pathname: '/invoices', ctaKey: 'cta_view_invoice', icon: 'file-text' };

function catalogueIntent(event: string, data: any, rid: string | undefined, audience: 'provider' | 'client'): NotifIntent | null {
  switch (event) {
    // Une demande qui arrive : l'accueil (immédiate) ou l'agenda (planifiée /
    // devis), la demande désignée — jamais un écran vide.
    case 'request.new':
    case 'request.new_urgent':
    case 'request.preferred':
    case 'request.scheduled':
    case 'request.quote_wanted':
      return { kind: 'opportunity', home: data.screen === 'Dashboard' && data.type !== 'preferred_opportunity', requestId: rid };

    // La mission n'est plus au prestataire : pas de re-résolution (403, ou
    // pire, la demande re-proposée « à prendre » à celui qui vient de l'abandonner).
    case 'mission.cancelled_by_client':
    case 'mission.reassigned':
    case 'mission.abandoned':
      return { kind: 'route', dest: PROVIDER_MISSIONS };
    case 'mission.reassigned_in_progress':
      return { kind: 'route', dest: DASHBOARD };

    // Devis expiré sans remboursement : pas de preuve de remboursement à montrer.
    case 'quote.expired':
      return { kind: 'route', dest: DASHBOARD };

    // Le reçu annoncé, pas la liste.
    case 'payment.receipt':
      return { kind: 'route', dest: documentsFor(rid, 'cta_view_invoice', 'file-text') };
    case 'invoice.ready':
      return { kind: 'route', dest: audience === 'provider' ? INVOICES : documentsFor(rid, 'cta_view_invoice', 'file-text') };
    case 'payment.commission_invoice':
      return { kind: 'route', dest: INVOICES };

    // Litige côté client : la facture de la mission, jamais la page de notation.
    case 'dispute.registered':
    case 'dispute.resolved':
    case 'dispute.resolved_client_wins':
    case 'dispute.resolved_provider_wins':
    case 'dispute.resolved_split':
      if (audience === 'client') return { kind: 'route', dest: documentsFor(rid, 'cta_view_invoice', 'file-text') };
      return rid ? { kind: 'provider-request', requestId: rid } : null;

    // Le signalement qu'on vient d'ouvrir, pas un formulaire vierge.
    case 'support.report_received':
    case 'support.report_received_urgent':
      return data.ticketId
        ? { kind: 'route', dest: { pathname: '/tickets/[id]', params: { id: String(data.ticketId) }, ctaKey: 'cta_view_ticket', icon: 'life-buoy' } }
        : { kind: 'support' };
    // Un client signale la mission du prestataire : sa mission, pas le formulaire client.
    case 'support.client_report':
      return rid ? { kind: 'provider-request', requestId: rid } : { kind: 'route', dest: PROVIDER_MISSIONS };

    // Compte validé / réactivé : l'accueil, sans rejouer l'animation « dossier validé ».
    case 'account.approved':
    case 'account.reactivated':
      return { kind: 'route', dest: DASHBOARD };

    // L'avis porte sur une mission : son bilan.
    case 'review.received':
      return rid ? { kind: 'route', dest: { pathname: '/request/[id]/earnings', params: { id: rid }, ctaKey: 'cta_view_earnings', icon: 'star' } } : null;

    case 'message.received':
      return data.senderId
        ? { kind: 'route', dest: { pathname: '/messages/[userId]', params: { userId: String(data.senderId), ...(rid ? { requestId: rid } : {}) }, ctaKey: 'cta_view_message', icon: 'message-circle' } }
        : null;
  }
  return null;
}

// Écrans du catalogue serveur (lib/notify.js) qui portent une mission : on
// re-résout contre l'état courant, avec le rôle que l'événement déclare.
const CATALOGUE_REQUEST_SCREENS = new Set(['MissionView', 'QuoteReview', 'Rating', 'Ongoing', 'Earnings']);

/**
 * `isProvider` : le rôle de l'utilisateur qui tape. Quand l'événement ne
 * déclare pas d'audience (litiges, support), c'est lui qui décide du résolveur —
 * sinon un prestataire atterrissait sur le suivi CLIENT de sa mission.
 */
export function classifyNotification(data: any, opts: { isProvider?: boolean } = {}): NotifIntent {
  if (!data) return { kind: 'space' };
  const { category, type, screen, requestId, event } = data;
  const rid = requestId != null ? String(requestId) : undefined;
  const audience: 'provider' | 'client' = data.audience === 'provider' || data.audience === 'client' ? data.audience : (opts.isProvider ? 'provider' : 'client');

  // ── Catalogue (data.event) : l'événement prime sur les anciens champs
  // `type` / `category` qu'il transporte encore (support_escalation, kyc_status).
  if (typeof event === 'string') {
    const specific = catalogueIntent(event, data, rid, audience);
    if (specific) return specific;
    if (type === 'kyc_status') return { kind: 'kyc' };
    if (category === 'support' || screen === 'Support') return { kind: 'support' };
    if (event === 'refund.issued' || event === 'quote.expired_refunded') return { kind: 'refund', requestId: rid };
    if (rid && CATALOGUE_REQUEST_SCREENS.has(screen)) {
      return audience === 'provider' ? { kind: 'provider-request', requestId: rid } : { kind: 'client-request', requestId: rid };
    }
    if (rid && audience === 'provider' && (screen === 'Dashboard' || screen === 'Missions')) return { kind: 'provider-request', requestId: rid };
    return screen ? { kind: 'screen' } : { kind: 'space' };
  }
  if (category === 'support' || type === 'support_escalation' || screen === 'Support') {
    return data.ticketId
      ? { kind: 'route', dest: { pathname: '/tickets/[id]', params: { id: String(data.ticketId) }, ctaKey: 'cta_view_ticket', icon: 'life-buoy' } }
      : { kind: 'support' };
  }
  if (type === 'kyc_status') return { kind: 'kyc' };
  if (PROVIDER_OPPORTUNITY_TYPES.has(type)) return { kind: 'opportunity', home: type === 'new_request' || type === 'preferred_request', requestId: rid };
  if (PROVIDER_QUOTE_TYPES.has(type) && rid) return { kind: 'provider-request', requestId: rid };
  if (category === 'refund' || type === 'refund') return { kind: 'refund', requestId: rid };
  if (rid && (CLIENT_REQUEST_CATEGORIES.has(category) || CLIENT_REQUEST_SCREENS.has(screen) || type === 'quote_received')) {
    return audience === 'provider' ? { kind: 'provider-request', requestId: rid } : { kind: 'client-request', requestId: rid };
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
