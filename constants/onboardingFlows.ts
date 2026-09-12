// constants/onboardingFlows.ts — Stepper de l'onboarding provider (post-auth).
// La numérotation est SCOPÉE à l'onboarding : le signup auth (Identité →
// Coordonnées/Activité → Code OTP) a son propre AuthStepper 3/3 et ne compte
// pas ici. Écrans à indicateur : Entreprise (BCE + IBAN) → Documents →
// Paiements (Stripe).

export const PROVIDER_FLOW = {
  totalSteps: 3,
  steps: {
    COMPANY:   1,
    DOCUMENTS: 2,
    STRIPE:    3,
  },
} as const;
