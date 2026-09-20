// lib/agenda/model.ts — l'onglet Missions lu comme un agenda : le temps, pas
// le statut. Fonctions pures, testées (__tests__/agenda.test.js).
//
//   - la semaine : sept jours, un point par mission (ambre si un devis attend)
//   - « maintenant » : la mission active (elle vit sur l'accueil)
//   - le fil du jour : missions à l'heure, trajets entre deux, creux écrits
//   - « passées » : par mois, compte et net
import type { MissionBrief } from '@/lib/mission/brief';
import { isQuoteMode, netFor } from '@/lib/mission/brief';

export type AgendaStatus = 'PUBLISHED' | 'ACCEPTED' | 'ONGOING' | 'DONE' | 'CANCELLED' | 'PENDING_PAYMENT' | 'EXPIRED' | 'QUOTE_PENDING' | 'QUOTE_SENT' | 'QUOTE_ACCEPTED' | string;

export type AgendaItem = {
  id: string;
  status: AgendaStatus;
  /** Début prévu (ms) ; sans créneau, la date de création. */
  at: number;
  /** Durée annoncée (min), 60 par défaut. */
  durationMin: number;
  lat: number | null;
  lng: number | null;
  brief: MissionBrief;
};

export const ACTIVE_STATUSES = ['ACCEPTED', 'ONGOING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'];
export const PLANNED_STATUSES = ['PUBLISHED', 'ACCEPTED', 'ONGOING', 'PENDING_PAYMENT', 'QUOTE_PENDING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'];
export const PAST_STATUSES = ['DONE', 'CANCELLED', 'EXPIRED', 'QUOTE_REFUSED', 'QUOTE_EXPIRED', 'REFUNDED'];

/**
 * Le devis, côté prestataire. Le serveur ne donne jamais QUOTE_PENDING à une
 * mission assignée (accepter la passe en ACCEPTED) : « devis à rédiger » =
 * mode devis (estimate / diagnostic) et mission acceptée ou démarrée, sans
 * devis envoyé ; QUOTE_SENT = envoyé, le client décide ; QUOTE_ACCEPTED = accepté.
 */
export type QuoteState = 'none' | 'todo' | 'sent' | 'accepted';
export function quoteStateOf(item: { status: string; brief: MissionBrief }): QuoteState {
  const st = item.status;
  if (st === 'QUOTE_SENT') return 'sent';
  if (st === 'QUOTE_ACCEPTED') return 'accepted';
  const mode = item.brief.money.pricingMode ?? item.brief.service.pricingMode;
  if (isQuoteMode(mode) && (st === 'ACCEPTED' || st === 'ONGOING')) return 'todo';
  return 'none';
}
/** Une mission acceptée qui commence dans plus de 30 min n'est pas « maintenant ». */
export const NOW_WINDOW_MIN = 30;
/** En dessous, pas de « creux » écrit entre deux missions. */
export const GAP_MIN = 20;

const DAY_MS = 86_400_000;

export function dayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Lundi 00:00 de la semaine du jour donné (semaine européenne). */
export function startOfWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // lundi = 0
  return d.getTime() - dow * DAY_MS;
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export type WeekDay = { key: string; at: number; dow: number; dayOfMonth: number; count: number; quote: boolean; isToday: boolean };
export type Week = { start: number; days: WeekDay[] };

/** Les semaines autour d'aujourd'hui (4 avant, 8 après), avec les points. */
export function weeksAround(now: number, items: AgendaItem[], before = 4, after = 8): Week[] {
  const perDay = new Map<string, { count: number; quote: boolean }>();
  for (const it of items) {
    if (!PLANNED_STATUSES.includes(it.status)) continue;
    const k = dayKey(it.at);
    const cur = perDay.get(k) ?? { count: 0, quote: false };
    cur.count += 1;
    if (quoteStateOf(it) === 'todo') cur.quote = true;
    perDay.set(k, cur);
  }
  const todayKey = dayKey(now);
  const first = startOfWeek(now) - before * 7 * DAY_MS;
  const weeks: Week[] = [];
  for (let w = 0; w < before + after + 1; w++) {
    const start = first + w * 7 * DAY_MS;
    const days: WeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const at = start + i * DAY_MS;
      const key = dayKey(at);
      const d = perDay.get(key);
      days.push({ key, at, dow: i, dayOfMonth: new Date(at).getDate(), count: d?.count ?? 0, quote: d?.quote ?? false, isToday: key === todayKey });
    }
    weeks.push({ start, days });
  }
  return weeks;
}

/** La mission active — celle qui vit sur l'accueil. */
export function currentOf(items: AgendaItem[], now: number): AgendaItem | null {
  return items.find((it) => ACTIVE_STATUSES.includes(it.status) && it.at <= now + NOW_WINDOW_MIN * 60_000) ?? null;
}

export type TimelineRow =
  | { kind: 'mission'; item: AgendaItem; done: boolean; quote: QuoteState; net: number | null; isCurrent: boolean }
  | { kind: 'trip'; minutes: number }
  | { kind: 'gap'; untilMs: number }
  | { kind: 'free' };

/** Minutes de route entre deux missions consécutives, par clé `${fromId}>${toId}`. */
export type Trips = Record<string, number | undefined>;

export function tripKey(a: AgendaItem, b: AgendaItem): string { return `${a.id}>${b.id}`; }

/** Le fil d'une journée : missions à l'heure, trajets ou creux entre deux, « libre » à la fin. */
export function dayTimeline(items: AgendaItem[], day: string, trips: Trips = {}, current: AgendaItem | null = null): { rows: TimelineRow[]; net: number; count: number } {
  const ofDay = items
    .filter((it) => dayKey(it.at) === day && (PLANNED_STATUSES.includes(it.status) || PAST_STATUSES.includes(it.status)))
    .filter((it) => it.status === 'DONE' || PLANNED_STATUSES.includes(it.status))
    .sort((a, b) => a.at - b.at);
  const rows: TimelineRow[] = [];
  let net = 0;
  ofDay.forEach((it, i) => {
    const n = netFor(it.brief);
    const done = it.status === 'DONE';
    if (n != null) net += n;
    rows.push({ kind: 'mission', item: it, done, quote: quoteStateOf(it), net: n, isCurrent: current?.id === it.id });
    const next = ofDay[i + 1];
    if (!next) return;
    const trip = trips[tripKey(it, next)];
    const endMs = it.at + it.durationMin * 60_000 + (trip ?? 0) * 60_000;
    if (trip != null) rows.push({ kind: 'trip', minutes: trip });
    if (next.at - endMs >= GAP_MIN * 60_000) rows.push({ kind: 'gap', untilMs: next.at });
  });
  // Après la dernière mission : « libre le reste de la journée » (sauf si elle est en cours).
  const last = ofDay[ofDay.length - 1];
  if (last && current?.id !== last.id) rows.push({ kind: 'free' });
  return { rows, net, count: ofDay.length };
}

/** Les paires consécutives d'une journée pour lesquelles un trajet peut être calculé. */
export function tripPairs(items: AgendaItem[], day: string): { key: string; from: AgendaItem; to: AgendaItem }[] {
  const ofDay = items.filter((it) => dayKey(it.at) === day && PLANNED_STATUSES.concat('DONE').includes(it.status)).sort((a, b) => a.at - b.at);
  const out: { key: string; from: AgendaItem; to: AgendaItem }[] = [];
  for (let i = 0; i + 1 < ofDay.length; i++) {
    const a = ofDay[i], b = ofDay[i + 1];
    if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) out.push({ key: tripKey(a, b), from: a, to: b });
  }
  return out;
}

export type MonthGroup = { key: string; at: number; count: number; net: number; items: AgendaItem[] };

/** Les missions passées, par mois (du plus récent), avec le net des missions faites. */
export function monthGroups(items: AgendaItem[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const it of items) {
    if (!PAST_STATUSES.includes(it.status)) continue;
    const k = monthKey(it.at);
    const g = map.get(k) ?? { key: k, at: it.at, count: 0, net: 0, items: [] };
    g.count += 1;
    if (it.status === 'DONE') g.net += netFor(it.brief) ?? 0;
    g.items.push(it);
    g.at = Math.max(g.at, it.at);
    map.set(k, g);
  }
  return Array.from(map.values())
    .map((g) => ({ ...g, items: g.items.sort((a, b) => b.at - a.at) }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

/** Le badge de l'onglet : ce qui attend une action — à prendre, devis à rédiger. */
export function badgeCount(items: AgendaItem[], toTake: number): number {
  return toTake + items.filter((it) => quoteStateOf(it) === 'todo').length;
}
