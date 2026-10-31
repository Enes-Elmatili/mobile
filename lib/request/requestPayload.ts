// lib/request/requestPayload.ts
// Corps envoyés au serveur par l'étape 4 (POST /pricing/lock, POST /requests),
// paramètres de la PaymentSheet Stripe et route de l'écran suivant. Pur :
// testé dans __tests__/stepperPayload.test.js — la forme des payloads est un
// contrat serveur, le test la fige.
import type { PaymentSheet } from '@stripe/stripe-react-native';
import type { PaymentSetupResponse, RequestId, StepperLocation } from './stepperTypes';
import type { ScheduleMode } from './schedule';

/** Champs communs aux trois flows (gratuit, devis, prix fixe). */
export type RequestPayloadBase = {
  /** Nom de la prestation (ou de la catégorie) tel que stocké en base. */
  serviceType: string | null | undefined;
  description: string;
  categoryId: number;
  subcategoryId: number | null;
  location: StepperLocation;
  scheduledFor: string | null;
  preferredProviderId?: string | null;
  accessSnapshot: Record<string, unknown>;
};

// ── Service gratuit → skip pricing lock + skip payment ──
export function buildFreeRequestPayload(b: RequestPayloadBase, now: Date = new Date()): Record<string, unknown> {
  const { serviceType, description, categoryId, subcategoryId, location, scheduledFor, preferredProviderId, accessSnapshot } = b;
  return {
    title:        serviceType,
    description:  description || `Service de ${serviceType}`,
    serviceType,
    categoryId,
    ...(subcategoryId && { subcategoryId }),
    price:        0,
    address:      location.address,
    lat:          location.lat,
    lng:          location.lng,
    urgent:       false,
    scheduledFor: scheduledFor || now.toISOString(),
    pricingMode:  'free',
    ...(preferredProviderId ? { preferredProviderId } : {}),
    ...accessSnapshot,
  };
}

// ── Flow devis : pas de prix à verrouiller — le callout fee vient de la subcategory ──
export function buildQuoteRequestPayload(
  b: RequestPayloadBase & { isUrgent: boolean; pricingMode: string },
  now: Date = new Date(),
): Record<string, unknown> {
  const { serviceType, description, categoryId, subcategoryId, location, scheduledFor, preferredProviderId, accessSnapshot, isUrgent, pricingMode } = b;
  return {
    title:        serviceType,
    description:  description || `Service de ${serviceType}`,
    serviceType,
    categoryId,
    ...(subcategoryId && { subcategoryId }),
    price:        0,
    address:      location.address,
    lat:          location.lat,
    lng:          location.lng,
    urgent:       isUrgent,
    scheduledFor: scheduledFor || now.toISOString(),
    status:       'PENDING_PAYMENT', // → QUOTE_PENDING après confirmation webhook Stripe
    pricingMode,
    ...(preferredProviderId ? { preferredProviderId } : {}),
    ...accessSnapshot,
  };
}

// ── Flow prix fixe : prix et jeton issus de POST /pricing/lock ──
export function buildFixedRequestPayload(
  b: RequestPayloadBase & { isUrgent: boolean; pricingMode: string; price: number; pricingToken: string },
  now: Date = new Date(),
): Record<string, unknown> {
  const { serviceType, description, categoryId, subcategoryId, location, scheduledFor, preferredProviderId, accessSnapshot, isUrgent, pricingMode, price, pricingToken } = b;
  return {
    title:        serviceType,
    description:  description || `Service de ${serviceType}`,
    serviceType,
    categoryId,
    ...(subcategoryId && { subcategoryId }),
    price,
    address:      location.address,
    lat:          location.lat,
    lng:          location.lng,
    urgent:       isUrgent,
    scheduledFor: scheduledFor || now.toISOString(),
    status:       'PENDING_PAYMENT',
    pricingMode,
    pricingToken,
    ...(preferredProviderId ? { preferredProviderId } : {}),
    ...accessSnapshot,
  };
}

/** Corps de POST /pricing/lock (flow prix fixe). Les champs TVA ne partent que si le service y est éligible. */
export function buildPricingLockPayload(
  input: {
    categoryId: number;
    subcategoryId: number | null;
    isUrgent: boolean;
    scheduledFor: string | null;
    pricingMode: string;
    vatEligible: boolean;
    buildingOver10y: boolean;
    privateUse: boolean;
  },
  now: Date = new Date(),
): Record<string, unknown> {
  const { categoryId, subcategoryId, isUrgent, scheduledFor, pricingMode, vatEligible, buildingOver10y, privateUse } = input;
  return {
    categoryId,
    ...(subcategoryId && { subcategoryId }),
    isUrgent,
    scheduledFor: scheduledFor || now.toISOString(),
    pricingMode,
    ...(vatEligible ? { buildingOver10y, privateUse } : {}),
  };
}

export const PAYMENT_METHOD_ORDER = ['card', 'klarna', 'revolut_pay', 'bancontact'];

/** PaymentSheet du callout (flow devis) : pas de client Stripe attaché. */
export function quoteSheetParams(clientSecret: string): PaymentSheet.SetupParams {
  return {
    merchantDisplayName:      'Fixed',
    paymentIntentClientSecret: clientSecret,
    applePay:  { merchantCountryCode: 'BE' },
    googlePay: { merchantCountryCode: 'BE', testEnv: false },
    paymentMethodOrder: [...PAYMENT_METHOD_ORDER],
  };
}

/** PaymentSheet du prix fixe (DIRECT_CHARGE) depuis la réponse de /payments/setup. */
export function fixedSheetParams(res: PaymentSetupResponse): PaymentSheet.SetupParams {
  const clientSecret = res.paymentIntentClientSecret || res.setupIntentClientSecret;
  return {
    merchantDisplayName:        'Fixed',
    paymentIntentClientSecret:  clientSecret,
    customerEphemeralKeySecret: res.ephemeralKey,
    customerId:                 res.customer,
    applePay:  { merchantCountryCode: 'BE' },
    googlePay: { merchantCountryCode: 'BE', testEnv: false },
    paymentMethodOrder: [...PAYMENT_METHOD_ORDER],
  };
}

/** Écran qui suit le paiement : confirmation (planifié) ou suivi de recherche (maintenant). */
export function buildMissionRoute(input: {
  requestId: RequestId | null;
  scheduleMode: ScheduleMode;
  serviceName: string | null;
  location: StepperLocation | null;
  price: string;
  calloutFee: string;
  isQuoteFlow: boolean;
  scheduledLabel: string | null;
  nowLabel: string;
}) {
  const { requestId, scheduleMode, serviceName, location, price, calloutFee, isQuoteFlow, scheduledLabel, nowLabel } = input;
  const params = {
    id:             String(requestId),
    serviceName:    serviceName    || '',
    address:        location?.address  || '',
    price,
    calloutFee,
    isQuote:        isQuoteFlow ? '1' : '',
    // Requête planifiée : jamais « Maintenant » par défaut (libellé du créneau ou vide).
    scheduledLabel: scheduleMode === 'later' ? (scheduledLabel || '') : (scheduledLabel || nowLabel),
    lat:            String(location?.lat  ?? ''),
    lng:            String(location?.lng  ?? ''),
  };
  // Requête planifiée → page de confirmation (pas de recherche de provider)
  return scheduleMode === 'later'
    ? { pathname: '/request/[id]/scheduled' as const, params }
    : { pathname: '/request/[id]/missionview' as const, params };
}
