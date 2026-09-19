// lib/notifications/model.ts — la cloche, côté modèle : familles, sections par
// jour, étiquette de temps, puce de destination. Pur, testable. Lit les
// notifications du catalogue serveur (data.event / data.family) et tolère les
// anciennes (category / type / screen).

export type Family = 'mission' | 'money' | 'account' | 'message' | 'news';

export type NotifData = {
  event?: string;
  family?: Family | string;
  screen?: string;
  category?: string;
  type?: string;
  requestId?: number | string;
  threadId?: string;
  toast?: boolean;
  senderId?: string;
  [k: string]: unknown;
};

export type Notif = {
  id: string;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  data?: NotifData | null;
};

export type Section = 'today' | 'yesterday' | 'week' | 'earlier';

/** Famille d'une notification : celle du catalogue, sinon déduite des anciens champs. */
export function familyOf(n: Pick<Notif, 'data' | 'type'>): Family {
  const d = n.data || {};
  const f = d.family as string | undefined;
  if (f === 'mission' || f === 'money' || f === 'account' || f === 'message' || f === 'news') return f;
  const cat = String(d.category || ''), t = String(d.type || ''), screen = String(d.screen || '');
  if (cat === 'refund' || t === 'refund' || screen === 'Documents' || screen === 'Wallet') return 'money';
  if (screen === 'Messages') return 'message';
  if (t === 'kyc_status' || t === 'kyc_document' || cat === 'support' || t === 'promo') return 'account';
  if (d.requestId != null || cat === 'mission' || cat === 'mission_update' || cat === 'rating' || cat === 'dispute') return 'mission';
  return 'account';
}

/** Section de la liste selon la date de création (jours civils, heure locale). */
export function sectionOf(createdAt: string | number | Date, now: Date = new Date()): Section {
  const d = new Date(createdAt);
  if (!Number.isFinite(d.getTime())) return 'earlier';
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((day(now) - day(d)) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'week';
  return 'earlier';
}

export const SECTION_ORDER: Section[] = ['today', 'yesterday', 'week', 'earlier'];

/** Regroupe par section, dans l'ordre chronologique inverse, sans section vide. */
export function groupBySection<T extends Pick<Notif, 'createdAt'>>(items: T[], now: Date = new Date()): { section: Section; data: T[] }[] {
  const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const buckets = new Map<Section, T[]>();
  for (const it of sorted) {
    const s = sectionOf(it.createdAt, now);
    if (!buckets.has(s)) buckets.set(s, []);
    buckets.get(s)!.push(it);
  }
  return SECTION_ORDER.filter((s) => buckets.has(s)).map((s) => ({ section: s, data: buckets.get(s)! }));
}

/**
 * Étiquette de temps : relative aujourd'hui (« il y a 4 min »), l'heure hier,
 * le jour + l'heure cette semaine, la date au-delà. Le rendu des mots passe par `t`.
 */
export function timeLabel(createdAt: string, t: (k: string, o?: Record<string, unknown>) => string, now: Date = new Date(), lang = 'fr'): string {
  const d = new Date(createdAt);
  if (!Number.isFinite(d.getTime())) return '';
  const sec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  const hm = d.toLocaleTimeString(lang === 'en' ? 'en-GB' : lang === 'nl' ? 'nl-BE' : 'fr-BE', { hour: '2-digit', minute: '2-digit' });
  switch (sectionOf(createdAt, now)) {
    case 'today':
      if (sec < 60) return t('notifications.time_now');
      if (sec < 3600) return t('notifications.time_ago_min', { n: Math.floor(sec / 60) });
      return t('notifications.time_ago_hour', { n: Math.floor(sec / 3600) });
    case 'yesterday':
      return `${t('notifications.yesterday')} · ${hm}`;
    case 'week':
      return `${d.toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'nl' ? 'nl-BE' : 'fr-BE', { weekday: 'short' })} · ${hm}`;
    default:
      return d.toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'nl' ? 'nl-BE' : 'fr-BE', { day: 'numeric', month: 'short' });
  }
}

/** Puce de destination : ce que le tap ouvre — « SUIVRE · MISSION #47 », « REÇU · MISSION #47 », « MISSION #47 ». */
export function refChip(n: Pick<Notif, 'data'>, t: (k: string) => string): { label: string; primary: boolean } | null {
  const d = n.data || {};
  const rid = d.requestId != null ? String(d.requestId) : null;
  if (!rid) return null;
  const screen = String(d.screen || '');
  const ev = String(d.event || '');
  const verb =
    screen === 'MissionView' && (ev.startsWith('mission.') || ev === '') ? t('notifications.chip_track')
    : screen === 'Rating' ? t('notifications.chip_rate')
    : screen === 'QuoteReview' ? t('notifications.chip_quote')
    : screen === 'Documents' ? t('notifications.chip_receipt')
    : screen === 'Earnings' || screen === 'Wallet' ? t('notifications.chip_earnings')
    : screen === 'Ongoing' ? t('notifications.chip_mission')
    : '';
  const label = `${verb ? verb + ' · ' : ''}${t('notifications.chip_mission_n').replace('{{id}}', rid)}`.toUpperCase();
  const primary = !!verb && (screen === 'MissionView' || screen === 'Rating' || screen === 'QuoteReview' || screen === 'Ongoing');
  return { label, primary };
}

/** Faut-il un toast au premier plan ? Pas pour les événements que l'écran montre déjà. */
export function wantsToast(n: Pick<Notif, 'data'>): boolean {
  return n.data?.toast !== false;
}
