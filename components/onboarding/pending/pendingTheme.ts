// components/onboarding/pending/pendingTheme.ts — palette forcée sombre + styles partagés
// de l'écran d'attente (app/onboarding/provider/pending.tsx).
import { StyleSheet } from "react-native";
import { FONTS, COLORS, darkTokens } from "@/hooks/use-app-theme";
import { alpha } from "@/components/auth";

// Forced-dark local palette — sourced from theme tokens so charter updates propagate
export const C = {
  bg:          darkTokens.bg,
  white:       darkTokens.text,
  grey:        darkTokens.textMuted,
  faint:       alpha(darkTokens.text, 0.3),
  border:      alpha(darkTokens.text, 0.08),
  cardBg:      darkTokens.cardBg,
  green:       COLORS.greenBrand,
  amber:       COLORS.amber,
  red:         COLORS.red,
  outlineText: alpha(darkTokens.text, 0.3),
};

export const ps = StyleSheet.create({
  titleOutline: { color: C.outlineText },

  // Cartes dossier (incomplet / docs refusés)
  docsCard: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: alpha(COLORS.red, 0.3),
    borderRadius: 16, padding: 18, gap: 10, marginBottom: 18,
  },
  docsTitle: {
    fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.8,
    color: C.grey, textTransform: "uppercase", marginBottom: 2,
  },
  docRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  docReason: { fontFamily: FONTS.sans, fontSize: 12, color: C.red, marginTop: 2 },
  docsFixBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    height: 44, borderRadius: 12, marginTop: 4,
    backgroundColor: alpha(darkTokens.text, 0.07),
    borderWidth: 1, borderColor: alpha(darkTokens.text, 0.2),
  },
  docsFixText: { fontFamily: FONTS.sansMedium, fontSize: 12.5, color: C.white },

  // CTA
  stripeCta: {
    width: "100%", height: 60, backgroundColor: C.white, borderRadius: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    marginTop: 8,
  },
  stripeCtaText: {
    fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 20, letterSpacing: 3, color: C.bg,
  },
  arrowPill: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: C.bg,
    alignItems: "center", justifyContent: "center",
  },

  footer: {
    paddingHorizontal: 28, gap: 12, zIndex: 2,
    paddingTop: 8,
  },
});
