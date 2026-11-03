// components/quote/QuoteContext.tsx — Contexte éditorial de la revue de devis :
// statut · référence · service · adresse.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, COLORS, alpha, type AppTheme } from "@/hooks/use-app-theme";
import { PulseDot } from "@/components/ui/PulseDot";
import { MonoLabel } from "./primitives";

export function QuoteContext({
  theme, quoteId, badgeLabel, badgeColor, badgeDanger, accepted, terminal, serviceLabel, address,
}: {
  theme: AppTheme;
  quoteId: number;
  badgeLabel: string;
  badgeColor: string;
  badgeDanger: boolean;
  accepted: boolean;
  terminal: boolean;
  serviceLabel: string;
  address?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <>
      <View style={s.metaRow}>
        <View style={[
          s.badge,
          { backgroundColor: theme.surface },
          badgeDanger && { backgroundColor: alpha(COLORS.red, 0.12) },
          accepted && { backgroundColor: alpha(COLORS.greenBrand, 0.12) },
        ]}>
          {terminal
            ? <View style={[s.badgeDot, { backgroundColor: badgeColor }]} />
            : <PulseDot size={6} color={badgeColor} />}
          <Text style={[s.badgeText, { color: badgeColor }]} numberOfLines={1}>{badgeLabel}</Text>
        </View>
        <MonoLabel color={theme.textVeryMuted}>{t('quote.doc_label')} #{quoteId}</MonoLabel>
      </View>

      {serviceLabel ? (
        <Text style={[s.pageTitle, { color: theme.text }]} numberOfLines={2}>{serviceLabel}</Text>
      ) : null}
      {address ? (
        <View style={s.addressRow}>
          <Feather name="map-pin" size={12} color={theme.textMuted} />
          <Text style={[s.addressText, { color: theme.textMuted }]} numberOfLines={1}>{address}</Text>
        </View>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 100, flexShrink: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: {
    fontFamily: FONTS.mono, fontSize: 10.5,
    letterSpacing: 0.8, textTransform: "uppercase", flexShrink: 1,
  },
  pageTitle: {
    fontFamily: FONTS.bebas, includeFontPadding: false,
    fontSize: 32, letterSpacing: 0.8, lineHeight: 34, marginTop: 14,
  },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  addressText: { fontFamily: FONTS.sans, fontSize: 12.5, flexShrink: 1 },
});
