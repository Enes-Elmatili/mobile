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
import { darkTokens, lightTokens } from "@/hooks/use-app-theme";

// ── alpha helper — derive rgba overlays from canonical hex tokens ──────────
export const alpha = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

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
