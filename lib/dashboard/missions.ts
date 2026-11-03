// lib/dashboard/missions.ts — le tri des demandes de l'accueil client : ce qui
// occupe l'îlot noir (active, recherche, devis), la section « À venir » et
// l'activité récente. Pur, sans I/O : `now` est injectable pour les tests.
import type { DashboardData, DashboardRequest } from './types';

// Volontairement très limité côté dashboard : 3 par défaut, 6 au max après "Voir plus".
// L'historique complet vit dans /missions ou /documents pour ne pas faire concurrence.
export const PREVIEW_COUNT = 3;
export const EXPANDED_COUNT = 6;

export const HIDDEN_STATUSES = ['CANCELLED', 'QUOTE_REFUSED', 'QUOTE_EXPIRED'];
export const DOCUMENT_STATUSES = ['QUOTE_PENDING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'];

// ─── Helper : une request est "planifiée future" si preferredTimeStart > now ────
export const isScheduledFuture = (r: { preferredTimeStart?: string | null }, now: number = Date.now()): boolean => {
  if (!r?.preferredTimeStart) return false;
  return new Date(r.preferredTimeStart).getTime() > now;
};

// Missions "actives maintenant" : ACCEPTED/ONGOING MAIS pas planifiées pour plus tard.
// Une mission ACCEPTED avec preferredTimeStart dans le futur = engagement d'un
// prestataire sur une date future → reste dans "À venir" jusqu'au jour J.
export function activeMissionOf(requests: DashboardRequest[] | undefined, now: number = Date.now()): DashboardRequest | null {
  return requests?.find(r =>
    ['ACCEPTED', 'ONGOING'].includes(r.status?.toUpperCase()) &&
    !isScheduledFuture(r, now)
  ) || null;
}

// PUBLISHED "maintenant" uniquement — exclut les demandes planifiées futures
// qui vont dans la section "À venir" séparée.
export function searchingMissionOf(
  requests: DashboardRequest[] | undefined,
  activeMission: DashboardRequest | null,
  now: number = Date.now(),
): DashboardRequest | null {
  return activeMission ? null : (requests?.find(r =>
    r.status?.toUpperCase() === 'PUBLISHED' && !isScheduledFuture(r, now)
  ) || null);
}

// Devis "maintenant" uniquement — exclut les devis planifiés futurs.
export function quoteMissionOf(
  requests: DashboardRequest[] | undefined,
  activeMission: DashboardRequest | null,
  searchingMission: DashboardRequest | null,
  now: number = Date.now(),
): DashboardRequest | null {
  return (activeMission || searchingMission) ? null : (requests?.find(r =>
    ['QUOTE_PENDING', 'QUOTE_SENT'].includes(r.status?.toUpperCase()) && !isScheduledFuture(r, now)
  ) || null);
}

// Activités récentes : exclut les HIDDEN, les devis (→ tab Documents), et les scheduled futurs (→ section À venir)
export function activityRequestsOf(requests: DashboardRequest[] | undefined, now: number = Date.now()): DashboardRequest[] {
  return (requests || []).filter(r =>
    !HIDDEN_STATUSES.includes(r.status?.toUpperCase()) &&
    !DOCUMENT_STATUSES.includes(r.status?.toUpperCase()) &&
    !isScheduledFuture(r, now)
  );
}

// Section "À venir" : demandes planifiées dans le futur, triées par date croissante
export function upcomingRequestsOf(requests: DashboardRequest[] | undefined, now: number = Date.now()): DashboardRequest[] {
  return (requests || [])
    .filter(r => isScheduledFuture(r, now))
    .filter(r => !['CANCELLED', 'QUOTE_REFUSED', 'QUOTE_EXPIRED', 'DONE'].includes(r.status?.toUpperCase()))
    .sort((a, b) =>
      new Date(a.preferredTimeStart!).getTime() - new Date(b.preferredTimeStart!).getTime()
    );
}

// Cap à EXPANDED_COUNT même quand "Voir plus" est cliqué — l'historique
// complet est accessible depuis l'onglet Missions / Documents.
export function visibleActivity<T>(activity: T[], showAll: boolean): T[] {
  const limit = showAll ? EXPANDED_COUNT : PREVIEW_COUNT;
  return activity.slice(0, limit);
}

/** Le statut d'une demande change (événement socket) : on patche la ligne en place. */
export function withRequestStatus(
  prev: DashboardData | null,
  requestId: string | number | undefined,
  newStatus: string,
): DashboardData | null {
  if (!prev) return prev;
  return {
    ...prev,
    requests: prev.requests.map(r =>
      String(r.id) === String(requestId) ? { ...r, status: newStatus } : r
    ),
  };
}
