// lib/displayName.ts
// Affichage propre des noms/emails masqués par « Sign in with Apple » (private relay).
// - email relay `xxx@privaterelay.appleid.com` → jamais affiché brut
// - « nom » qui est en fait le préfixe opaque du relay (ex: "ryzq5w6gvm") → fallback
import i18n from '@/lib/i18n';

const RELAY_DOMAIN = '@privaterelay.appleid.com';

/** Vrai si l'email est une adresse relais Apple (Hide My Email). */
export function isPrivateRelayEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(RELAY_DOMAIN);
}

/** Vrai si le « nom » stocké est en réalité un token opaque (préfixe relay), pas un vrai nom. */
export function isOpaqueName(name?: string | null, email?: string | null): boolean {
  const n = (name ?? '').trim();
  if (!n) return true;
  // Un vrai nom ne contient pas de chiffres ; un token opaque en a souvent (ex: "ryzq5w6gvm").
  if (/\d/.test(n) && !/\s/.test(n)) return true;
  // Égal au préfixe (local part) d'un email relay.
  if (isPrivateRelayEmail(email) && email && n.toLowerCase() === email.split('@')[0].toLowerCase()) {
    return true;
  }
  return false;
}

/** Le vrai nom si exploitable, sinon un fallback propre (jamais le token opaque). */
export function cleanName(
  name?: string | null,
  opts?: { email?: string | null; fallback?: string },
): string {
  if (name && !isOpaqueName(name, opts?.email)) return name.trim();
  return opts?.fallback ?? i18n.t('ext.display_name_fallback');
}

/** Le vrai email si exploitable, sinon un libellé clair « Email Apple privé » (jamais le relay brut). */
export function cleanEmail(email?: string | null): string {
  if (!email) return '';
  if (isPrivateRelayEmail(email)) return i18n.t('ext.display_email_private');
  return email;
}
