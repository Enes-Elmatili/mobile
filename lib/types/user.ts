// lib/types/user.ts
// Utilisateur authentifié et réponses du parcours d'authentification.

export type Role = 'ADMIN' | 'PROVIDER' | 'CLIENT';

/** Statut de validation du prestataire (onboarding, écran d'attente). */
export type ProviderValidationStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'BANNED' | (string & {});

/** Profil renvoyé par GET /auth/me (sous `user`). */
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  bio?: string;
  avatarUrl?: string | null;
  language?: string | null;
  /** "email" | "apple" | "google" */
  authProvider?: string;
  emailVerified?: boolean;
  roles: Role[];
  providerStatus?: ProviderValidationStatus;
  createdAt?: string;
}

/** GET /auth/me — certains appelants lisent aussi le profil à la racine ou sous `data`. */
export type MeResponse = Partial<AuthUser> & { user?: AuthUser; data?: Partial<AuthUser> };

/**
 * Réponse de login / signup / apple / google / assign-role. Le token est
 * stocké par api.auth avant de rendre la main.
 */
export interface AuthResponse {
  token?: string;
  user?: AuthUser;
  roles?: Role[];
  /** Champs du profil encore à remplir (écran complete-profile). */
  missingFields?: string[];
  profileIncomplete?: boolean;
  providerStatus?: ProviderValidationStatus;
}

/** GET /auth/reset-password/:token/validate */
export type ResetTokenValidation = { valid?: boolean };
