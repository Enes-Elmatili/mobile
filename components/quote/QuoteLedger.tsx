// components/quote/QuoteLedger.tsx — Ledger blanc : main d'œuvre / pièces / acompte.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, type AppTheme } from "@/hooks/use-app-theme";
import type { Quote } from '@/lib/types';
import { formatEURCents as fmtEur } from "@/lib/format";
import { MonoLabel } from "./primitives";
import { cardStyles, type QuoteCardStyle } from "./card";

export function QuoteLedger({ theme, cardStyle, quote, hasDeposit, accepted }: {
  theme: AppTheme;
  cardStyle: QuoteCardStyle;
  /** Montants en centimes. */
  quote: Quote;
  hasDeposit: boolean;
  accepted: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={[cardStyles.card, cardStyle]}>
      <MonoLabel color={theme.textMuted}>{t('quote.details')}</MonoLabel>

      <View style={{ marginTop: 12 }}>
        <View style={s.lineRow}>
          <View style={[s.tile, { backgroundColor: theme.surface }]}>
            <Feather name="tool" size={15} color={theme.text} />
          </View>
          <Text style={[s.lineLabel, { color: theme.text }]} numberOfLines={1}>{t('quote.labor')}</Text>
          <Text style={[s.lineValue, { color: theme.text }]}>{fmtEur(quote.laborAmount)}</Text>
        </View>

        {quote.partsAmount > 0 && (
          <View style={s.lineRow}>
            <View style={[s.tile, { backgroundColor: theme.surface }]}>
              <Feather name="package" size={15} color={theme.text} />
            </View>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={[s.lineLabel, { color: theme.text }]} numberOfLines={1}>{t('quote.parts_materials')}</Text>
              {quote.partsDetail ? (
                <Text style={[s.lineDetail, { color: theme.textMuted }]} numberOfLines={2}>{quote.partsDetail}</Text>
              ) : null}
            </View>
            <Text style={[s.lineValue, { color: theme.text }]}>{fmtEur(quote.partsAmount)}</Text>
          </View>
        )}
      </View>

      <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

      <View style={s.totalRow}>
        <Text style={[s.totalLabel, { color: theme.text }]}>{t('ext.invoice_total')}</Text>
        <Text style={[s.totalValue, { color: theme.text }]}>{fmtEur(quote.totalAmount)}</Text>
      </View>

      {hasDeposit && (
        <>
          <View style={s.depositRow}>
            <Text style={[s.depositLabel, { color: theme.greenText }]} numberOfLines={1}>{t('quote.deposit_paid')}</Text>
            <Text style={[s.depositValue, { color: theme.greenText }]}>− {fmtEur(quote.calloutPaid)}</Text>
          </View>
          <View style={[s.divider, { backgroundColor: theme.border }]} />
          <View style={s.totalRow}>
            {/* Devis accepté = solde déjà réglé via la PaymentSheet : afficher
                « reste à payer » ferait croire au client qu'il doit encore. */}
            <Text style={[s.finalLabel, { color: theme.text }]}>
              {accepted ? t('ext.invoice_paid') : t('quote.remaining_to_pay')}
            </Text>
            <Text style={[s.finalValue, { color: accepted ? theme.greenText : theme.text }]}>
              {fmtEur(quote.remainingAmount)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  lineRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 12 },
  tile: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  lineLabel: { fontFamily: FONTS.sans, fontSize: 14, flex: 1, paddingRight: 10 },
  lineDetail: { fontFamily: FONTS.sans, fontSize: 12, marginTop: 2, lineHeight: 16 },
  lineValue: { fontFamily: FONTS.monoMedium, fontSize: 14, letterSpacing: 0.2, flexShrink: 0 },

  divider: { height: 1, marginVertical: 10 },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  totalLabel: { fontFamily: FONTS.sansMedium, fontSize: 14 },
  totalValue: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 22, letterSpacing: 0.8 },
  depositRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginTop: 8 },
  depositLabel: { fontFamily: FONTS.sans, fontSize: 13.5, flexShrink: 1 },
  depositValue: { fontFamily: FONTS.monoMedium, fontSize: 13.5, flexShrink: 0 },
  finalLabel: { fontFamily: FONTS.sansMedium, fontSize: 15 },
  finalValue: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 26, letterSpacing: 0.8 },
});
