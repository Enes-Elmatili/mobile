// lib/gains/model.ts
// Le relevé des gains, en pur : une transaction du portefeuille (projection
// d'un virement Stripe) devient une ligne de mission avec son état d'argent,
// les lignes se groupent par mois, et l'arrivée en banque est estimée depuis
// le calendrier de virement Stripe (quotidien, J+delayDays).

export type WalletTx = {
  id: string;
  type: 'CREDIT' | 'DEBIT' | 'HOLD' | 'RELEASE' | string;
  amount: number;            // centimes, toujours positif
  reference?: string | null;
  createdAt: string;
  requestId?: number | null;
  mission?: {
    id: number;
    serviceName: string | null;
    serviceNameI18n?: Record<string, string> | null;
    serviceSlug?: string | null;
    categorySlug?: string | null;
    address?: string | null;
    completedAt?: string | null;
    gross: number | null;      // centimes
    commissionRate: number | null;
    net: number | null;        // centimes
  } | null;
};

export type Payout = { id: string; amount: number; status: string; arrivalDate: number | null; createdAt: number | null };

export type MoneyState = 'arriving' | 'paid' | 'refunded';

export type GainLine = {
  key: string;
  tx: WalletTx;
  /** Net signé en centimes (négatif pour un débit). */
  net: number;
  state: MoneyState;
  /** Arrivée estimée sur le compte (ms), null pour un débit. */
  arrivesAt: number | null;
  missionId: number | null;
  title: string | null;
  city: string | null;
  date: string;
};

export type MonthGroup = { key: string; year: number; month: number; net: number; missions: number; lines: GainLine[] };

export const DEFAULT_PAYOUT_DELAY_DAYS = 7;

/** « Avenue Louise 1, 1050 Ixelles » → « Ixelles ». */
const COUNTRY = /^(belgique|belgi[eë]|belgium|france|nederland|netherlands|luxembourg)$/i;
export function cityOf(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean).filter((p) => !COUNTRY.test(p));
  const withZip = parts.find((p) => /^\d{4}\s+\S/.test(p));
  const last = withZip ?? parts[parts.length - 1] ?? '';
  const m = last.match(/^\d{4}\s+(.+)$/);
  return (m ? m[1] : last) || null;
}

/** Arrivée estimée : date du virement + délai Stripe (jours calendaires). */
export function estimateArrival(createdAt: string | number, delayDays: number = DEFAULT_PAYOUT_DELAY_DAYS): number {
  const t = typeof createdAt === 'number' ? createdAt : new Date(createdAt).getTime();
  return t + delayDays * 24 * 3600 * 1000;
}

/**
 * L'état d'une ligne : « virée » si un virement Stripe arrivé (paid) est
 * postérieur à la date du crédit, sinon selon l'estimation ; un débit est un
 * remboursement.
 */
export function lineState(tx: WalletTx, payouts: Payout[], now: number, delayDays: number): { state: MoneyState; arrivesAt: number | null } {
  if (tx.type === 'DEBIT') return { state: 'refunded', arrivesAt: null };
  const created = new Date(tx.createdAt).getTime();
  const est = estimateArrival(created, delayDays);
  const paidAfter = payouts.some((p) => p.status === 'paid' && (p.arrivalDate ?? 0) >= created && (p.createdAt ?? 0) >= created);
  if (paidAfter || now >= est) return { state: 'paid', arrivesAt: est };
  return { state: 'arriving', arrivesAt: est };
}

export function toLine(tx: WalletTx, payouts: Payout[], now: number, delayDays: number, lang: string): GainLine {
  const sign = tx.type === 'DEBIT' ? -1 : 1;
  const { state, arrivesAt } = lineState(tx, payouts, now, delayDays);
  const m = tx.mission ?? null;
  const title = m ? (m.serviceNameI18n?.[lang] ?? m.serviceName ?? null) : null;
  return {
    key: tx.id,
    tx,
    net: sign * tx.amount,
    state,
    arrivesAt,
    missionId: m?.id ?? tx.requestId ?? null,
    title,
    city: cityOf(m?.address),
    date: m?.completedAt ?? tx.createdAt,
  };
}

/** Groupe par mois civil (décroissant), somme des nets, missions distinctes. */
export function groupByMonth(lines: GainLine[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const l of lines) {
    const d = new Date(l.date);
    const year = d.getFullYear(), month = d.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    let g = map.get(key);
    if (!g) { g = { key, year, month, net: 0, missions: 0, lines: [] }; map.set(key, g); }
    g.lines.push(l);
    g.net += l.net;
  }
  for (const g of map.values()) {
    g.lines.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    g.missions = new Set(g.lines.filter((l) => l.net > 0 && l.missionId != null).map((l) => l.missionId)).size;
  }
  return Array.from(map.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
}

/** Ce qui est en route : les crédits non encore arrivés, avec la première date d'arrivée. */
export function inTransit(lines: GainLine[]): { amount: number; missions: number; arrivesAt: number | null } {
  const arriving = lines.filter((l) => l.state === 'arriving');
  const arrivesAt = arriving.length ? Math.min(...arriving.map((l) => l.arrivesAt ?? Infinity)) : null;
  return { amount: arriving.reduce((s, l) => s + l.net, 0), missions: new Set(arriving.map((l) => l.missionId)).size, arrivesAt: Number.isFinite(arrivesAt as number) ? arrivesAt : null };
}

/** Les trois lignes de la fiche argent, depuis la mission enrichie ou la transaction seule. */
export function ledgerOf(line: GainLine): { gross: number | null; commission: number | null; rate: number | null; net: number } {
  const m = line.tx.mission;
  const gross = m?.gross ?? null;
  const rate = m?.commissionRate ?? null;
  const net = Math.abs(line.net);
  const commission = gross != null ? gross - net : null;
  return { gross, commission, rate: rate ?? (gross ? Math.round((1 - net / gross) * 100) / 100 : null), net };
}
