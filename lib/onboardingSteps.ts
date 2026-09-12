// lib/onboardingSteps.ts
// Où reprendre l'onboarding prestataire — logique pure, testée, partagée par
// l'écran d'attente et les écrans d'étape. L'ordre est celui du garde
// d'activation serveur (services/providerGate.js) : métiers → entreprise
// (BCE vérifié VIES + IBAN) → pièces → Stripe → validation humaine.
import { getRequiredDocuments } from '../constants/kycRequirements';

export interface TradesState {
  names: string[];
  city: string | null;
  known: boolean;
}

export interface CompanyState {
  /** BCE confirmé par VIES (vatVerifiedAt côté serveur). */
  vatVerified: boolean;
  ibanPresent: boolean;
}

export interface DocState {
  docKey: string;
  status?: string | null;
}

export type OnboardingStep = 'activity' | 'company' | 'documents' | 'stripe' | 'review';

function isSubmitted(status?: string | null): boolean {
  return status === 'PENDING' || status === 'APPROVED';
}

/** Pièces obligatoires pour ces métiers — même source que l'écran documents. */
function requiredDocKeys(categoryNames: string[]): string[] {
  return getRequiredDocuments(categoryNames).filter((d) => d.required).map((d) => d.type);
}

export function firstIncompleteStep(input: {
  trades: TradesState;
  company: CompanyState;
  docs: DocState[];
  stripeReady: boolean;
}): OnboardingStep {
  const { trades, company, docs, stripeReady } = input;
  if (trades.known && trades.names.length === 0) return 'activity';
  if (!company.vatVerified || !company.ibanPresent) return 'company';
  const submitted = new Set(docs.filter((d) => isSubmitted(d.status)).map((d) => d.docKey));
  if (requiredDocKeys(trades.names).some((k) => !submitted.has(k))) return 'documents';
  if (!stripeReady) return 'stripe';
  return 'review';
}

export const STEP_ROUTES: Record<OnboardingStep, string> = {
  activity: '/onboarding/activity',
  company: '/onboarding/company',
  documents: '/onboarding/documents',
  stripe: '/onboarding/stripe',
  review: '/onboarding/provider/pending',
};
