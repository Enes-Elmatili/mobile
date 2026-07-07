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

/**
 * Clés i18n des libellés de phase affichés à côté du compteur
 * (ex. « Identité · 01 / 06 »). Traduire au rendu via t(...).
 */
export const STEP_LABELS: Record<number, { client?: string; provider: string }> = {
  1: { client: "onboarding.phase_identity", provider: "onboarding.phase_identity" },
  2: { client: "onboarding.phase_coords", provider: "onboarding.phase_coords" },
  3: { client: "onboarding.phase_verify", provider: "onboarding.phase_activity" },
  4: { provider: "onboarding.phase_verify" },
  5: { provider: "onboarding.phase_documents" },
  6: { provider: "onboarding.phase_payments" },
};
