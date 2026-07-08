/**
 * Shared tokens for the FIXED auth flow — gradient palette + alpha helper.
 *
 * The auth flow uses an INVERTED gradient (dark top → light bottom) that pulls
 * canonical colors from the theme tokens. Welcome screen uses the same palette
 * but with the gradient flipped (light → dark).
 *
 * Headline & top decorations sit on the dark zone (use textOnDark).
 * Form inputs & CTA sit on the light zone (use textOnLight).
 */
import { darkTokens, lightTokens, alpha, type AppTheme } from "@/hooks/use-app-theme";

// ── alpha helper — ré-exporté depuis use-app-theme (source unique) ──────────
export { alpha };

// ── Champs themed (flat v2) — dérivations partagées des inputs ──────────────
// Source unique des ~6 couleurs dérivées du thème utilisées par AuthInput,
// AuthPhoneInput et AuthAddressAutocomplete en mode `themed`. Pure extraction :
// le rendu themed de chaque input reste strictement identique.
export function themedFieldColors(theme: AppTheme, focused = false) {
  return {
    /** Label mono uppercase au-dessus du champ. */
    label: alpha(theme.text, 0.55),
    /** Fond + bordure du champ au repos. */
    field: { backgroundColor: theme.cardBg, borderColor: theme.borderLight },
    /** Bordure au focus. */
    focusBorder: alpha(theme.text, 0.4),
    /** Placeholder. */
    placeholder: alpha(theme.text, 0.35),
    /** Curseur / sélection de texte. */
    selection: theme.text,
    /** Icône leading (mail, lock, map-pin…) — s'accentue au focus. */
    icon: alpha(theme.text, focused ? 0.85 : 0.55),
  };
}

// ── Auth gradient palette — inverted by default (dark → light) ─────────────
// Welcome uses these stops in REVERSE order (light → dark) to give the page its
// distinctive "from your everyday → into action" feel.
export const authT = {
  // Pulled from theme — single source of truth for both modes
  dark:        darkTokens.bg,        // #0A0A0A
  darkMid:     darkTokens.border,    // #2A2A2A
  lightMid:    lightTokens.surface,  // #E8E8E8
  light:       lightTokens.bg,       // #F4F4F2

  // Symmetric text colors — bg of opposite mode used as text
  textOnDark:  lightTokens.bg,       // #F4F4F2 (light text on dark zone)
  textOnLight: darkTokens.bg,        // #0A0A0A (dark text on light zone)
} as const;

// ── Gradient configurations ────────────────────────────────────────────────
// Inverted (dark top → light bottom): for form pages where headline sits on
// dark and inputs/CTA sit on light.
export const invertedGradient = {
  colors: [authT.dark, authT.darkMid, authT.lightMid, authT.light] as [string, string, string, string],
  locations: [0, 0.32, 0.72, 1] as [number, number, number, number],
};

// Standard (light top → dark bottom): welcome only.
export const standardGradient = {
  colors: [authT.light, authT.lightMid, authT.darkMid, authT.dark] as [string, string, string, string],
  locations: [0, 0.32, 0.72, 1] as [number, number, number, number],
};
