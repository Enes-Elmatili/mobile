// constants/onboardingFlows.ts — Step counters unifiés pour les deux flows d'onboarding

export const CLIENT_FLOW = {
  totalSteps: 2,
  steps: {
    REGISTER:     1,
    VERIFY_EMAIL: 2,
  },
} as const;

export const PROVIDER_FLOW = {
  totalSteps: 5,
  steps: {
    SIGNUP_ID:    1,
    ZONE:         2,
    VERIFY_EMAIL: 3,
    DOCUMENTS:    4,
    STRIPE:       5,
  },
} as const;
