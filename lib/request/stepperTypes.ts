// lib/request/stepperTypes.ts
// Formes des données du stepper de commande (catalogue, adresse, prix serveur,
// promo, réponses de paiement). Types seuls : aucun code à l'exécution.
import type { PricedCategory, PricedSubcategory } from '@/lib/services/serviceSelection';

/** Sous-catégorie telle que renvoyée par GET /categories (champs lus par le stepper). */
export type StepperSubcategory = PricedSubcategory & {
  id: number;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  nameI18n?: Record<string, string | null> | null;
  /** false → hors travaux immobiliers : TVA 21% quel que soit le logement. */
  isImmovableWork?: boolean | null;
  priceMin?: number | null;
  priceMax?: number | null;
};

export type StepperCategory = Omit<PricedCategory, 'subcategories'> & {
  id: number;
  name?: string | null;
  slug?: string | null;
  icon?: string | null;
  subcategories?: StepperSubcategory[] | null;
};

/** Adresse retenue à l'étape 1. */
export type StepperLocation = { address: string; lat: number; lng: number };

/** Adresse enregistrée du client (GET /addresses). */
export type SavedAddress = { id: number; label?: string | null; address: string; lat: number; lng: number };

/** Remise validée 100% serveur (jamais le montant saisi côté app). */
export type AppliedPromo = { code: string; discountCents: number; nominalCents: number };

/** Id de demande : le serveur le renvoie numérique, les params d'URL le passent en texte. */
export type RequestId = string | number;

/** Détail de prix — estimation locale (computePrice) ou prix verrouillé serveur. */
export type PriceDetails = {
  cents?: { totalTVAC: number; vat: number } | null;
  /** Montants en euros, formatés « 182.70 ». */
  totalTVAC: string;
  vat: string;
  vatRate?: number | null;
};

/** Réponse de POST /requests. */
export type CreatedRequestResponse = { id?: RequestId; data?: { id?: RequestId } };

/** Réponse de POST /pricing/lock. */
export type PricingLockResponse = { price: PriceDetails; pricingToken: string };

/** Réponse de POST /quotes/callout-payment. `demo` : compte store-review, aucune charge. */
export type CalloutPaymentResponse = { amount?: number; clientSecret: string; demo?: boolean };

/** Réponse de POST /payments/setup : le type unique du contrat (lib/types/wallet). */
export type { PaymentSetupResponse } from '@/lib/types/wallet';
