// lib/cockpit/day.ts — la journée du prestataire, lisible en bas de l'accueil.
// Trois faits dérivés des listes déjà chargées (missions, connect) : les
// rappels, la prochaine mission planifiée, et son urgence. Pur, sans I/O.

export type MissionLite = {
  id: number | string;
  status?: string | null;
  serviceType?: string | null;
  address?: string | null;
  preferredTimeStart?: string | null;
  pricingMode?: string | null;
  client?: { name?: string | null } | null;
};

export type Reminder = { kind: 'payouts' | 'quote'; requestId?: number | string };

export type NextMission = {
  id: number | string;
  startAt: number;
  /** Minutes avant le créneau (négatif = déjà commencé). */
  inMin: number;
  /** À moins de 30 min : la carte passe ambre et compte. */
  soon: boolean;
  serviceType: string | null;
  address: string | null;
  clientName: string | null;
};

export const SOON_MIN = 30;

/**
 * Rappels : virements à configurer (Stripe non finalisé), devis à rédiger.
 * Un devis est « à rédiger » quand la mission est en mode devis (estimate /
 * diagnostic), démarrée (code vérifié : ONGOING) et sans devis envoyé (sinon
 * QUOTE_SENT). Le serveur ne donne jamais QUOTE_PENDING à une mission assignée.
 */
export function remindersOf(missions: MissionLite[], connect: { needsOnboarding?: boolean; payoutsEnabled?: boolean } | null | undefined): Reminder[] {
  const out: Reminder[] = [];
  if (connect && (connect.needsOnboarding || connect.payoutsEnabled === false)) out.push({ kind: 'payouts' });
  for (const m of missions) {
    const st = (m.status || '').toUpperCase();
    if (st === 'ONGOING' && (m.pricingMode === 'estimate' || m.pricingMode === 'diagnostic')) out.push({ kind: 'quote', requestId: m.id });
  }
  return out;
}

/** La prochaine mission planifiée (acceptée, créneau à venir), la plus proche d'abord. */
export function nextMissionOf(missions: MissionLite[], now: number = Date.now()): NextMission | null {
  const upcoming = missions
    .filter((m) => ['ACCEPTED', 'QUOTE_ACCEPTED'].includes((m.status || '').toUpperCase()) && m.preferredTimeStart)
    .map((m) => ({ m, startAt: new Date(m.preferredTimeStart as string).getTime() }))
    .filter(({ startAt }) => Number.isFinite(startAt) && startAt > now - 15 * 60 * 1000)
    .sort((a, b) => a.startAt - b.startAt);
  const first = upcoming[0];
  if (!first) return null;
  const inMin = Math.round((first.startAt - now) / 60000);
  return {
    id: first.m.id,
    startAt: first.startAt,
    inMin,
    soon: inMin <= SOON_MIN,
    serviceType: first.m.serviceType ?? null,
    address: first.m.address ?? null,
    clientName: first.m.client?.name ?? null,
  };
}

/** « DANS 2 H » / « DANS 12 MIN » / « MAINTENANT » — le kicker de la carte prochaine mission. */
export function inLabel(inMin: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (inMin <= 0) return t('cockpit.next_now');
  if (inMin < 60) return t('cockpit.next_in_min', { n: inMin });
  return t('cockpit.next_in_h', { n: Math.round(inMin / 60) });
}

function pad(n: number): string { return (n < 10 ? '0' : '') + n; }

/** Chrono « depuis » : « 0:12 », « 42:17 », « 1:02:05 » — comme un chronomètre, sans zéro inutile. */
export function clockOf(sinceMs: number, now: number): string {
  const total = Math.max(0, Math.floor((now - sinceMs) / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
