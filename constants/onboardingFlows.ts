// constants/onboardingFlows.ts — Stepper unifié 01→0N pour les deux flows d'onboarding.
// Redesign 2026 : une seule logique de progression du signup jusqu'à Stripe.
// Provider : Identité → Coordonnées → Activité → Code OTP → Documents → Paiements (6 étapes).
// Client   : Identité → Coordonnées → Code OTP (3 étapes).

export const CLIENT_FLOW = {
  totalSteps: 3,
  steps: {
    IDENTITY:     1,
    COORDS:       2,
    VERIFY_EMAIL: 3,
  },
} as const;

export const PROVIDER_FLOW = {
  totalSteps: 6,
  steps: {
    IDENTITY:     1,
    COORDS:       2,
    ACTIVITY:     3,
    VERIFY_EMAIL: 4,
    DOCUMENTS:    5,
    STRIPE:       6,
  },
} as const;

/** Libellés de phase affichés à côté du compteur (ex. « Identité · 01 / 06 »). */
export const STEP_LABELS: Record<number, { client?: string; provider: string }> = {
  1: { client: "Identité", provider: "Identité" },
  2: { client: "Coordonnées", provider: "Coordonnées" },
  3: { client: "Vérification", provider: "Activité" },
  4: { provider: "Vérification" },
  5: { provider: "Documents" },
  6: { provider: "Paiements" },
};
