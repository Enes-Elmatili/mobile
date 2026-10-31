// lib/types/wallet.ts
// Argent : portefeuille (projection des virements Stripe), Stripe Connect,
// paiements client (PaymentSheet) et abonnement prestataire.
// Convention serveur : les montants du portefeuille et de Stripe sont en
// CENTIMES (affichés avec formatEURCents).
import type { WalletTx, Payout } from '@/lib/gains/model';

export type { WalletTx, Payout };

/** GET /wallet — solde et cumul du mois du prestataire. */
export interface WalletBalance {
  /** Solde, en centimes. */
  balance?: number;
  month?: {
    /** Net gagné ce mois-ci, en centimes. */
    net?: number | null;
    /** Missions terminées ce mois-ci. */
    missions?: number | null;
  } | null;
}

/** GET /wallet/txs — tableau nu, ou `{ transactions }` / `{ data }` selon la version. */
export type WalletTxsResponse =
  | (WalletTx[] & { transactions?: undefined; data?: undefined })
  | { transactions?: WalletTx[]; data?: WalletTx[] };

/** GET /connect/status — état du compte Stripe Express. */
export interface ConnectStatus {
  /** Compte Stripe complet (charges et virements activés). */
  isStripeReady?: boolean;
  /** Une ligne prestataire existe pour cet utilisateur. */
  isProvider?: boolean;
}

/** GET /connect/balance — solde Stripe et calendrier de virement. */
export interface ConnectBalance {
  needsOnboarding?: boolean;
  payoutsEnabled?: boolean;
  /** Disponible, en centimes. */
  available?: number;
  /** En attente, en centimes. */
  pending?: number;
  lastPayout?: Payout | null;
  payouts?: Payout[];
  /** Virement quotidien à J+delayDays. */
  payoutSchedule?: { interval: string; delayDays: number } | null;
  bank?: { last4: string; bankName?: string | null } | null;
}

/** POST /connect/onboarding et /connect/dashboard — lien Stripe à ouvrir. */
export type ConnectLinkResponse = { url?: string; needsOnboarding?: boolean };

/**
 * POST /payments/setup (DIRECT_CHARGE) — de quoi piloter le PaymentSheet.
 * `setupIntentClientSecret` est un alias déprécié de `paymentIntentClientSecret`.
 */
export interface PaymentSetupResponse {
  paymentIntentClientSecret?: string;
  /** @deprecated alias pendant la migration, lire paymentIntentClientSecret. */
  setupIntentClientSecret?: string;
  ephemeralKey?: string;
  customer?: string;
  /** Montant débité, en centimes (Stripe). */
  amount?: number;
  currency?: string;
  flow?: string;
  /** Remise validée serveur ; montants en centimes. */
  promo?: { code: string; discountCents: number; nominalCents: number } | null;
}

/** POST /subscription/create-subscription — abonnement natif (PaymentSheet). */
export interface CreateSubscriptionResponse {
  subscriptionId?: string;
  paymentIntentClientSecret?: string;
  ephemeralKey?: string;
  customerId?: string;
}
