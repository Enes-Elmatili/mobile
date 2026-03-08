/**
 * mobile/lib/services/index.ts — Point d'entrée unique
 *
 * Usage dans les écrans :
 *   import { userService, missionService, walletService, onboardingService } from '@/lib/services';
 *   import type { User, Request, WalletAccount } from '@/lib/services';
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export * from './types';

// ── HTTP client ───────────────────────────────────────────────────────────────
export { default as apiClient } from './apiClient';

// ── Services ──────────────────────────────────────────────────────────────────
export { userService } from './userService';
export { missionService } from './missionService';
export { walletService } from './walletService';
export { onboardingService } from './onboardingService';

// ── Named payload/state types (not in types.ts) ───────────────────────────────
export type { CreateRequestPayload } from './missionService';
export type { OnboardingState } from './onboardingService';
