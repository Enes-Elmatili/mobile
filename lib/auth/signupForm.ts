// lib/auth/signupForm.ts
// Logique pure du signup (app/(auth)/signup.tsx) : validation par phase,
// libellés dérivés de la phase, et corps envoyés au serveur. Aucun effet de
// bord ici — les tests (__tests__/signupForm.test.js) figent ces contrats.
import { getRequiredDocuments } from '@/constants/kycRequirements';
import type { Category as CatalogCategory } from '@/lib/types';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const POSTAL_RE = /^\d{4}$/;

export const CITY_OPTIONS = [{ value: 'Bruxelles', label: 'Bruxelles' }];

export type SignupCategory = Pick<CatalogCategory, 'id' | 'name' | 'icon'>;

export type SignupPhase = 'identity' | 'billing' | 'zone' | 'creating';

// ── Mot de passe ────────────────────────────────────────────────────────────
/** Score 0–4 : longueur ≥ 8, majuscule, chiffre, caractère spécial. */
export function passwordScore(password: string): number {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  return checks.filter(Boolean).length;
}

// ── Validation ──────────────────────────────────────────────────────────────
export interface IdentityFields {
  name: string;
  email: string;
  password: string;
}

export function isEmailValid(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function canSubmitIdentity({ name, email, password }: IdentityFields): boolean {
  return name.trim().length > 0 && isEmailValid(email) && password.length >= 8;
}

/** Clé i18n du premier champ d'identité invalide (ordre : nom, email, mot de passe). */
export function identityErrorKey({ name, email }: IdentityFields): string {
  if (!name.trim()) return 'auth.su_err_name';
  if (!isEmailValid(email)) return 'auth.su_err_email';
  return 'auth.su_err_pwd';
}

export interface BillingFields {
  phone: string;
  address: string;
  postalCode: string;
  billingCity: string;
}

export interface BillingValidity {
  phone: boolean;
  address: boolean;
  postalCode: boolean;
  billingCity: boolean;
  all: boolean;
}

export function billingValidity({ phone, address, postalCode, billingCity }: BillingFields): BillingValidity {
  // Téléphone E.164 (posé par AuthPhoneInput via onChangeFormattedText) : + et assez de chiffres
  const v = {
    phone: /^\+\d{7,}$/.test(phone.trim()),
    address: address.trim().length >= 3,
    postalCode: POSTAL_RE.test(postalCode.trim()),
    billingCity: billingCity.trim().length >= 2,
  };
  return { ...v, all: v.phone && v.address && v.postalCode && v.billingCity };
}

export function canSubmitZone(city: string, selectedCats: number[]): boolean {
  return city.trim().length >= 2 && selectedCats.length > 0;
}

/** Clé i18n de l'erreur de zone (ville d'abord, puis métiers). */
export function zoneErrorKey(city: string): string {
  return city.trim().length < 2 ? 'auth.su_err_zone_city' : 'auth.su_err_zone_cats';
}

// ── Libellés par phase ──────────────────────────────────────────────────────
export function phaseLabelKey(phase: SignupPhase): string {
  return phase === 'identity'
    ? 'auth.su_phase_identity'
    : phase === 'billing'
      ? 'auth.su_phase_coords'
      : 'auth.su_phase_activity';
}

export function headlineKeys(phase: SignupPhase, isProvider: boolean): { title: string; subtitle: string } {
  return phase === 'billing'
    ? { title: 'auth.su_coords_title', subtitle: 'auth.su_coords_sub' }
    : isProvider && phase === 'zone'
      ? { title: 'auth.su_activity_title', subtitle: 'auth.su_activity_sub' }
      : { title: 'auth.su_identity_title', subtitle: 'auth.su_identity_sub' };
}

/** « Continuer » tant qu'une phase suit, « Créer » sur la dernière. */
export function ctaLabelKey(phase: SignupPhase, isProvider: boolean): string {
  return phase === 'identity' || (phase === 'billing' && isProvider) ? 'auth.su_continue' : 'auth.su_create';
}

export interface PhaseValidity {
  canIdentity: boolean;
  canBilling: boolean;
  canZone: boolean;
}

export function isCtaDisabled(phase: SignupPhase, v: PhaseValidity): boolean {
  return (
    (phase === 'identity' && !v.canIdentity) ||
    (phase === 'billing' && !v.canBilling) ||
    (phase === 'zone' && !v.canZone)
  );
}

/** Raison de désactivation du CTA — null si le CTA est actif. */
export function ctaHintKey(phase: SignupPhase, v: PhaseValidity): string | null {
  return phase === 'identity' && !v.canIdentity
    ? 'auth.su_err_identity'
    : phase === 'billing' && !v.canBilling
      ? 'auth.su_err_coords'
      : phase === 'zone' && !v.canZone
        ? 'auth.su_err_activity'
        : null;
}

export function radiusLabelKey(radius: number): string {
  return radius <= 3 ? 'auth.su_radius_near' : radius <= 8 ? 'auth.su_radius_mid' : 'auth.su_radius_far';
}

// ── Métiers ─────────────────────────────────────────────────────────────────
export function toggleId(prev: number[], id: number): number[] {
  return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
}

/** Copie triée par nom (locale fr) — ne mute pas la liste d'origine. */
export function sortCategoriesByName<T extends { name: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Nombre de pièces obligatoires pour les métiers sélectionnés. */
export function requiredDocsCount(categories: SignupCategory[], selectedCats: number[]): number {
  return getRequiredDocuments(
    categories.filter((c) => selectedCats.includes(c.id)).map((c) => c.name)
  ).filter((d) => d.required).length;
}

// ── Corps serveur ───────────────────────────────────────────────────────────
export interface SignupDraft extends IdentityFields, BillingFields {
  isProvider: boolean;
  city: string;
  radius: number;
  selectedCats: number[];
}

/** Arguments de api.auth.signup(email, password, name, extras). */
export function buildSignupArgs(d: SignupDraft) {
  return {
    email: d.email.trim().toLowerCase(),
    password: d.password,
    name: d.name.trim() || undefined,
    extras: {
      role: d.isProvider ? ('PROVIDER' as const) : ('CLIENT' as const),
      phone: d.phone.trim(),
      address: d.address.trim(),
      postalCode: d.postalCode.trim(),
      city: d.billingCity.trim(),
    },
  };
}

/** Corps de api.providers.register. */
export function buildProviderRegisterPayload(d: SignupDraft) {
  return {
    name: d.name.trim(),
    city: d.city.trim(),
    radius: d.radius,
    categoryIds: d.selectedCats,
  };
}

/** Valeur stockée sous « onboarding_data » pour la suite de l'onboarding. */
export function buildOnboardingData(d: SignupDraft, categories: SignupCategory[]) {
  const selectedCatObjects = categories.filter((c) => d.selectedCats.includes(c.id));
  return {
    name: d.name.trim(),
    city: d.city.trim(),
    radius: d.radius,
    categoryIds: d.selectedCats,
    categories: selectedCatObjects.map((c) => ({ id: c.id, name: c.name })),
  };
}

// ── Erreurs sociales ────────────────────────────────────────────────────────
interface SocialErrorShape {
  status?: number;
  code?: string;
  message?: string;
  data?: { error?: string };
}

function asSocialError(e: unknown): SocialErrorShape | undefined {
  return e && typeof e === 'object' ? (e as SocialErrorShape) : undefined;
}

/** Annulation Apple (ERR_CANCELED, ou 1001 natif) — silencieuse. */
export function isSocialCancel(e: unknown): boolean {
  const err = asSocialError(e);
  return err?.code === 'ERR_CANCELED' || err?.code === '1001';
}

/** 409 (compte existant avec un autre fournisseur) : message du serveur à afficher, sinon null. */
export function socialConflictMessage(e: unknown): { message: string | undefined } | null {
  const err = asSocialError(e);
  if (err?.status !== 409) return null;
  return { message: err.data?.error || err.message };
}
