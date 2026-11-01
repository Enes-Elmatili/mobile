// components/quote/QuoteNotes.tsx — Notes du prestataire et réassurance paiement.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, type AppTheme } from "@/hooks/use-app-theme";
import { MonoLabel } from "./primitives";
import { cardStyles, type QuoteCardStyle } from "./card";

export function QuoteNotes({ theme, cardStyle, notes }: { theme: AppTheme; cardStyle: QuoteCardStyle; notes: string }) {
  const { t } = useTranslation();
  return (
    <View style={[cardStyles.card, cardStyle]}>
      <MonoLabel color={theme.textMuted}>{t('quote.notes_from_provider')}</MonoLabel>
      <View style={s.notesRow}>
        <View style={[s.notesRule, { backgroundColor: theme.border }]} />
        <Text style={[s.notesText, { color: theme.textSub }]}>{notes}</Text>
      </View>
    </View>
  );
}

export function QuoteSecureNote({ theme }: { theme: AppTheme }) {
  const { t } = useTranslation();
  return (
    <View style={s.secureRow}>
      <Feather name="shield" size={12} color={theme.textMuted} />
      <Text style={[s.secureText, { color: theme.textMuted }]}>{t('quote.secure_note')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  notesRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  notesRule: { width: 2, borderRadius: 2, alignSelf: "stretch" },
  notesText: { fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 20, flex: 1 },

  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 4, paddingHorizontal: 8 },
  secureText: { fontFamily: FONTS.sans, fontSize: 11.5, textAlign: "center", flexShrink: 1 },
});
