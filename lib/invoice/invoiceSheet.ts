// lib/invoice/invoiceSheet.ts — Logique pure de la feuille facture
// (components/sheets/InvoiceSheet.tsx) : montants, TVA, commission, numéro
// affiché, nom du PDF, dates. Tous les montants sont en EUROS (contrat `Invoice`).
import type { Invoice, InvoiceItem } from '@/lib/types';

export type InvoiceAmounts = {
  items: InvoiceItem[];
  /** Sous-total HTVA, euros — null si le backend ne le fournit pas. */
  subtotal: number | null;
  /** Fraction (0.21) — null si absente. */
  taxRate: number | null;
  /** TVA, euros — null si absente. */
  taxAmount: number | null;
  /** Total TVAC, euros : breakdown.total, sinon invoice.amount, sinon 0. */
  total: number;
  paymentMethod: 'card' | 'cash';
  isPaid: boolean;
  /** Net prestataire, euros — EXCLUSIVEMENT depuis le backend. */
  netEarnings: number | null;
  /** Commission en % entier, déduite du net — null sans net ou total nul. */
  commissionPct: number | null;
};

/** Lignes de détail : uniquement si le backend en fournit. */
export function invoiceItems(breakdown: Invoice['breakdown']): InvoiceItem[] {
  return breakdown?.items?.length ? breakdown.items : [];
}

/**
 * Règle stricte : on n'affiche QUE ce que le backend fournit dans `breakdown`.
 * Aucun recalcul client (taux TVA variable 6%/21%, commission variable selon le
 * tier). Sans breakdown → uniquement le total, sans décomposition.
 */
export function invoiceAmounts(invoice: Invoice | null | undefined): Omit<InvoiceAmounts, 'items'> {
  const breakdown = invoice?.breakdown;
  const subtotal = breakdown?.subtotal ?? null;
  const taxRate = breakdown?.taxRate ?? null;
  const taxAmount = breakdown?.taxAmount ?? null;
  const total = breakdown?.total ?? invoice?.amount ?? 0;
  const paymentMethod = breakdown?.paymentMethod ?? 'card';
  const isPaid = invoice?.status === 'PAID';
  const netEarnings = breakdown?.providerEarnings ?? null;
  const commissionPct = netEarnings != null && total > 0
    ? Math.round((1 - netEarnings / total) * 100)
    : null;
  return { subtotal, taxRate, taxAmount, total, paymentMethod, isPaid, netEarnings, commissionPct };
}

/** Pourcentage de TVA affiché (0.21 → 21) ; taux absent → 0. */
export function vatPercent(taxRate: number | null): number {
  return Math.round((taxRate ?? 0) * 100);
}

/** « #FIXED-0042 » : numéro sans le préfixe d'année, sinon les 5 derniers caractères de l'id. */
export function displayInvoiceNumber(invoice: Pick<Invoice, 'id' | 'number'>): string {
  return invoice.number
    ? `#FIXED-${invoice.number.replace(/^\d{4}-/, '')}`
    : `#FIXED-${String(invoice.id).slice(-5).toUpperCase()}`;
}

/** Nom du PDF en cache : le numéro de facture, sinon « facture-<6 derniers de l'id> ». */
export function invoicePdfFileName(invoiceId: string, invoiceNo?: string | null): string {
  return invoiceNo ? `${invoiceNo}.pdf` : `facture-${invoiceId.slice(-6)}.pdf`;
}

/** Langue courte envoyée au backend pour le PDF (« nl-BE » → « nl », défaut « fr »). */
export function pdfLang(language: string | null | undefined): string {
  return (language || 'fr').split('-')[0].toLowerCase();
}

/** En-têtes du téléchargement PDF : Bearer si connecté + langue doublée en header. */
export function pdfDownloadHeaders(token: string | null | undefined, lang: string): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Accept-Language': lang,
    'X-Client-Lang': lang,
  };
}

/** Fond du badge de statut : vert payé / ambre en attente, plus dense en sombre. */
export function statusBadgeBg(isPaid: boolean, dark: boolean): string {
  return isPaid
    ? dark ? 'rgba(21,193,110,0.15)' : 'rgba(21,193,110,0.06)'
    : dark ? 'rgba(255,165,0,0.15)' : 'rgba(255,165,0,0.06)';
}

export const fmtInvoiceDate = (d: string, locale: string) =>
  new Date(d).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export const fmtInvoiceDateShort = (d: string, locale: string) =>
  new Date(d).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
  });

/** Date de virement estimée : 48 h après l'émission. */
export const payoutDateOf = (issuedAt: string, locale: string): string => {
  const d = new Date(issuedAt);
  d.setDate(d.getDate() + 2);
  return fmtInvoiceDateShort(d.toISOString(), locale);
};
