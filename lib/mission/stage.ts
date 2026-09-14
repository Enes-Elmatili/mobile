// lib/mission/stage.ts
// Le stade du suivi côté client : une fonction pure du statut serveur et de
// deux faits locaux (arrivée reçue, code vérifié). C'est elle qui décide ce
// que la carte et la feuille racontent (spec 2026-09-14-after-search-flow).
import type { MissionBrief } from './brief';

export type Stage =
  | 'loading'
  | 'searching'
  | 'accepted'
  | 'en_route'
  | 'at_door'
  | 'ongoing'
  | 'quote_pending'
  | 'quote_sent'
  | 'scheduled'
  | 'done'
  | 'pending_payment'
  | 'terminal';

export type StageFacts = {
  /** Le prestataire est à la porte (photo avant reçue, ou position à < 60 m). */
  arrived?: boolean;
  /** Le code d'arrivée a été vérifié (mission démarrée). */
  pinVerified?: boolean;
  /** Bascule « accepté » encore affichée (2,4 s après l'acceptation). */
  justAccepted?: boolean;
  now?: number;
};

/** Créneau à plus de 30 min : la mission est planifiée, pas de suivi en direct. */
export function isFutureScheduled(preferredTimeStart: string | null | undefined, now: number = Date.now()): boolean {
  if (!preferredTimeStart) return false;
  const ts = new Date(preferredTimeStart).getTime();
  return Number.isFinite(ts) && ts > now + 30 * 60 * 1000;
}

export function stageOf(request: { status?: string | null; preferredTimeStart?: string | null } | null | undefined, facts: StageFacts = {}): Stage {
  if (!request) return 'loading';
  const status = (request.status || '').toUpperCase();
  const now = facts.now ?? Date.now();
  switch (status) {
    case 'PUBLISHED': return 'searching';
    case 'PENDING_PAYMENT': return 'pending_payment';
    case 'QUOTE_PENDING': return 'quote_pending';
    case 'QUOTE_SENT': return 'quote_sent';
    case 'ACCEPTED':
    case 'QUOTE_ACCEPTED': {
      if (status === 'ACCEPTED' && isFutureScheduled(request.preferredTimeStart, now)) return 'scheduled';
      if (facts.pinVerified) return 'ongoing';
      if (facts.arrived) return 'at_door';
      return facts.justAccepted ? 'accepted' : 'en_route';
    }
    case 'ONGOING': return 'ongoing';
    case 'DONE':
    case 'COMPLETED': return 'done';
    default: return 'terminal';
  }
}

/** Les stades qui se rendent sur la carte de suivi (par opposition aux redirections). */
export const TRACKING_STAGES: Stage[] = ['accepted', 'en_route', 'at_door', 'ongoing', 'quote_pending'];

/** Fin prévue : démarrage + durée habituelle de la prestation, sinon null. */
export function plannedEnd(brief: Pick<MissionBrief, 'timeline' | 'service'>): Date | null {
  const started = brief.timeline.startedAt ? new Date(brief.timeline.startedAt).getTime() : NaN;
  const minutes = brief.service.durationMinutes;
  if (!Number.isFinite(started) || !minutes) return null;
  return new Date(started + minutes * 60 * 1000);
}

/** Minutes écoulées depuis un horodatage, jamais négatives. */
export function minutesSince(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((now - t) / 60000));
}

/** Distance en mètres entre deux points (haversine). */
export function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rayon d'arrivée : à moins de 60 m de l'adresse, le prestataire est « à la porte ». */
export const ARRIVAL_RADIUS_M = 60;
