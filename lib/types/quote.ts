// lib/types/quote.ts
// Le devis (missions en mode estimate / diagnostic) et le paiement du
// déplacement qui le précède. Tous les montants sont en CENTIMES : les écrans
// les affichent avec formatEURCents (quote-review, QuoteSheet, send-quote).
import type { ISODateString } from './common';

export type QuoteStatus = 'PENDING' | 'SENT' | 'ACCEPTED' | 'REFUSED' | 'EXPIRED' | (string & {});

export interface Quote {
  id: number;
  requestId?: number;
  /** Les écrans comparent en majuscules (`status.toUpperCase()`). */
  status?: QuoteStatus;
  /** Main-d'œuvre, en centimes. */
  laborAmount: number;
  /** Pièces et fournitures, en centimes (0 si aucune). */
  partsAmount: number;
  partsDetail?: string | null;
  /** Total du devis, en centimes. */
  totalAmount: number;
  /** Déplacement déjà payé par le client, déduit du total, en centimes. */
  calloutPaid: number;
  /** Reste à payer à l'acceptation, en centimes. */
  remainingAmount: number;
  notes?: string | null;
  photos?: string[];
  validUntil: ISODateString;
  createdAt?: ISODateString;
}

/** GET /quotes/request/:requestId — le plus récent en tête. */
export type QuotesForRequestResponse = { quotes?: Quote[] };

/** POST /quotes/:requestId — envoi du devis par le prestataire (montants en centimes). */
export type SendQuotePayload = { laborAmount: number; partsAmount?: number; partsDetail?: string; notes?: string; photos?: string[] };

/**
 * POST /quotes/:id/accept — `paymentIntent` présent quand il reste un montant
 * à régler : le PaymentSheet est piloté par son clientSecret.
 */
export type QuoteAcceptResponse = {
  paymentIntent?: { id: string; clientSecret: string; quoteId?: number } | null;
};

/**
 * POST /quotes/callout-payment — paiement du déplacement. Avec un code
 * CALLOUT_COVERED : `{ covered: true, clientSecret: null, amount: 0 }`.
 */
export type CalloutPaymentResponse = {
  clientSecret: string | null;
  /** Montant du déplacement, en centimes. */
  amount?: number;
  covered?: boolean;
  /** Mode démo (pas de Stripe) : aucun PaymentSheet à présenter. */
  demo?: boolean;
};
