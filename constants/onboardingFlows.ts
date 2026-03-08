// constants/onboardingFlows.ts — Step counters unifiés pour les deux flows d'onboarding v2

export const CLIENT_FLOW = {
  totalSteps: 3,
  steps: {
    REGISTER:     1,
    VERIFY_EMAIL: 2,
    IDENTITY:     3,
  },
} as const;

export const PROVIDER_FLOW = {
  totalSteps: 7,
  steps: {
    SIGNUP_ID:    1,
    ZONE:         2,
    VERIFY_EMAIL: 3,
    SKILLS:       4,
    DOCUMENTS:    5,
    QUIZ:         6,
    STRIPE:       7,
  },
} as const;
