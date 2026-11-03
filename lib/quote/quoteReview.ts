// lib/quote/quoteReview.ts — Logique pure de la revue de devis côté client
// (app/request/[id]/quote-review.tsx) : montant héros, statut/badge, compte à
// rebours, paramètres du PaymentSheet et confirmation avec retry.
// Tous les montants sont en CENTIMES (contrat `Quote`).
import { formatEURCents as fmtEur } from "@/lib/format";

/** Statuts de demande pour lesquels l'écran de revue est accessible. */
export const QUOTE_REVIEW_STATUSES = ["QUOTE_SENT", "QUOTE_ACCEPTED", "QUOTE_REFUSED", "QUOTE_EXPIRED"] as const;

export function isQuoteReviewStatus(status: string): boolean {
  return (QUOTE_REVIEW_STATUSES as readonly string[]).includes(status);
}

/** Sépare "871,00 €" en { value, cur } pour composer le montant héros en deux tailles. */
export function splitAmount(cents: number): { value: string; cur: string } {
  const s = fmtEur(cents);
  const m = s.match(/^(.*?)\s*(€)$/);
  return m ? { value: m[1], cur: m[2] } : { value: s, cur: "" };
}

/** Moment 9 : la coche se trace (accepté) — statut devis en majuscules. */
export function isSealed(quoteStatusUpper: string, requestStatus: string): boolean {
  return quoteStatusUpper === "ACCEPTED" || requestStatus === "QUOTE_ACCEPTED" || requestStatus === "ONGOING";
}

/** Moment 9 : la carte se plie et se range (refusé). */
export function isFolded(quoteStatusUpper: string, requestStatus: string): boolean {
  return quoteStatusUpper === "REFUSED" || requestStatus === "QUOTE_REFUSED";
}

export type QuoteBadgeKey =
  | "quote.badge_accepted"
  | "quote.badge_refused"
  | "quote.expired"
  | "quote.awaiting_response";

export type QuoteReviewState = {
  /** Statut du devis, en majuscules. */
  qStatus: string;
  validUntilMs: number;
  expired: boolean;
  accepted: boolean;
  refused: boolean;
  badgeDanger: boolean;
  /** Clé i18n du badge. */
  badgeKey: QuoteBadgeKey;
  terminal: boolean;
  canAct: boolean;
  /** Temps restant avant la fin de validité, en ms (négatif si dépassé). */
  msLeft: number;
  /** Urgence sous 6 h (jamais sur un devis clos). */
  urgent: boolean;
};

/**
 * Badge dérivé du VRAI statut du devis / de la demande (plus de "en attente"
 * affiché sur un devis déjà accepté ou refusé).
 */
export function quoteReviewState(input: {
  quoteStatus?: string | null;
  requestStatus: string;
  validUntil: string;
  now: number;
}): QuoteReviewState {
  const { requestStatus, now } = input;
  const qStatus = (input.quoteStatus || "").toUpperCase();
  const validUntilMs = new Date(input.validUntil).getTime();
  const expired = qStatus === "EXPIRED" || requestStatus === "QUOTE_EXPIRED" || now > validUntilMs;
  const accepted = qStatus === "ACCEPTED" || requestStatus === "QUOTE_ACCEPTED" || requestStatus === "ONGOING";
  const refused = qStatus === "REFUSED" || requestStatus === "QUOTE_REFUSED";
  const badgeDanger = refused || expired;
  const badgeKey: QuoteBadgeKey = accepted ? "quote.badge_accepted" : refused ? "quote.badge_refused" : expired ? "quote.expired" : "quote.awaiting_response";
  const terminal = accepted || refused || expired;
  const canAct = !terminal && qStatus === "SENT";
  // Compte à rebours de validité — urgence sous 6 h.
  const msLeft = validUntilMs - now;
  const urgent = !terminal && msLeft < 6 * 3600_000;
  return { qStatus, validUntilMs, expired, accepted, refused, badgeDanger, badgeKey, terminal, canAct, msLeft, urgent };
}

/** Décompose le temps restant en jours / heures / minutes (planché à 0). */
export function timeLeftParts(msLeft: number): { d: number; h: number; m: number } {
  const totalMin = Math.max(0, Math.floor(msLeft / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  return { d, h, m };
}

type CountT = (key: string, opts: { n: number }) => string;

/** Libellé du compte à rebours : « 2 j 3 h », « 3 h 12 min » ou « 12 min ». */
export function timeLeftLabel(msLeft: number, t: CountT): string {
  const { d, h, m } = timeLeftParts(msLeft);
  if (d > 0) return `${t('notifications.time_day', { n: d })} ${t('notifications.time_hour', { n: h })}`;
  if (h > 0) return `${t('notifications.time_hour', { n: h })} ${t('notifications.time_min', { n: m })}`;
  return t('notifications.time_min', { n: m });
}

/** Paramètres du PaymentSheet Stripe pour le solde d'un devis. */
export function quotePaymentSheetParams(clientSecret: string) {
  return {
    merchantDisplayName: "Fixed",
    paymentIntentClientSecret: clientSecret,
    applePay: { merchantCountryCode: "BE" },
    googlePay: { merchantCountryCode: "BE", testEnv: false },
    paymentMethodOrder: ['card', 'klarna', 'revolut_pay', 'bancontact'],
  };
}

const defaultWait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Confirme le paiement côté backend avec retry x3 + backoff. Le client a DÉJÀ été
 * débité par Stripe : en cas d'échec réseau, on ne le laisse pas dans un état
 * incohérent — on réessaie, et si ça échoue quand même on ne bloque pas.
 * 401/403 : inutile d'insister.
 */
export async function confirmPaymentWithRetry(
  confirm: (quoteId: number, paymentIntentId: string) => Promise<unknown>,
  quoteId: number,
  paymentIntentId: string,
  wait: (ms: number) => Promise<void> = defaultWait,
): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await confirm(quoteId, paymentIntentId);
      return true;
    } catch (e) {
      const status = (e as { status?: number } | null | undefined)?.status;
      if (status === 401 || status === 403) return false;
      if (attempt < 3) await wait(attempt * 1000);
    }
  }
  return false;
}
