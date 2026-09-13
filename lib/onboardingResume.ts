// lib/onboardingResume.ts
// Où reprendre l'onboarding prestataire, d'après l'état SERVEUR : métiers,
// entreprise (BCE enregistré + IBAN), pièces déposées, Stripe. Utilisé par
// les écrans d'étape quand ils se terminent : on saute directement à ce qui
// manque au lieu de rejouer les étapes déjà faites (un prestataire renvoyé
// sur « Entreprise » depuis l'écran d'attente refaisait pièces et Stripe).
import { api } from './api';
import { fetchProviderTrades } from './providerOnboarding';
import { firstIncompleteStep, STEP_ROUTES, type OnboardingStep } from './onboardingSteps';

export async function loadOnboardingState() {
  const [trades, meRes, docsRes, stripeRes]: any[] = await Promise.all([
    fetchProviderTrades().catch(() => ({ names: [], city: null, known: false })),
    api.providers.me().catch(() => null),
    api.providerDocs.list().catch(() => null),
    api.connect.status().catch(() => null),
  ]);
  const p = meRes?.provider;
  return {
    trades,
    company: {
      vatPresent: !!p?.vatNumber,
      vatVerified: !!p?.vatVerifiedAt,
      ibanPresent: !!p?.bankIban,
    },
    docs: (docsRes?.documents ?? []) as { docKey: string; status?: string | null }[],
    stripeReady: !!stripeRes?.isStripeReady,
  };
}

/** Prochaine étape incomplète, ou l'écran d'attente si tout est fourni. */
export async function resumeStep(): Promise<OnboardingStep> {
  return firstIncompleteStep(await loadOnboardingState());
}

export async function resumeRoute(): Promise<string> {
  return STEP_ROUTES[await resumeStep()];
}
