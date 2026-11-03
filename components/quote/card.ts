// components/quote/card.ts — Carte blanche partagée (ledger, prestataire, notes).
import { StyleSheet } from "react-native";
import type { AppTheme } from "@/hooks/use-app-theme";

export function quoteCardStyle(theme: AppTheme) {
  return {
    backgroundColor: theme.cardBg,
    borderColor: theme.borderLight,
    shadowColor: "#000",
    shadowOpacity: theme.shadowOpacity,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: theme.isDark ? 0 : 2,
  };
}

export type QuoteCardStyle = ReturnType<typeof quoteCardStyle>;

export const cardStyles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16 },
});
