// components/sheets/invoice/ProviderInvoiceContent.tsx — Facture, vue
// prestataire compacte : total facturé, net reçu, virement prévu.
import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS, type AppTheme } from '@/hooks/use-app-theme';
import { formatEUR as formatEuros } from '@/lib/format';
import type { invoiceAmounts } from '@/lib/invoice/invoiceSheet';
import { InvoiceActions, InvoiceDivider, InvoiceStatusBadges } from './InvoiceParts';
import { s, type InvoicePalette } from './styles';

export function ProviderInvoiceContent({
  theme, palette, amounts, invoiceNumber, displayDateShort, displayServiceTitle, displayProviderName,
  payoutDate, downloading, onDownload, onClose,
}: {
  theme: AppTheme;
  palette: InvoicePalette;
  /** Montants en euros. */
  amounts: ReturnType<typeof invoiceAmounts>;
  invoiceNumber: string;
  displayDateShort: string;
  displayServiceTitle: string;
  displayProviderName: string;
  payoutDate: string | null;
  downloading: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { textPrimary, textSecondary, textMuted, surfaceBg, borderColor } = palette;
  const { total, netEarnings, commissionPct, isPaid, paymentMethod } = amounts;
  return (
    <>
      {/* Compact header: invoice number left, date right */}
      <View style={s.compactHeader}>
        <Text style={[s.invoiceNumber, { color: textPrimary, fontFamily: FONTS.bebas, includeFontPadding: false }]}>
          {invoiceNumber}
        </Text>
        <Text style={[s.compactDate, { color: textMuted, fontFamily: FONTS.sansMedium }]}>
          {displayDateShort}
        </Text>
      </View>

      <View style={s.body}>
        {/* Service — simple inline text, no card */}
        <Text style={[s.compactService, { color: textSecondary, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
          {displayServiceTitle} · {displayProviderName}
        </Text>

        <InvoiceDivider color={borderColor} />

        {/* Total facturé — hero */}
        <View style={s.totalsBlock}>
          <View style={s.totalLine}>
            <Text style={[s.grandTotalLabel, { color: textPrimary, fontFamily: FONTS.sansMedium }]}>
              {t('ext.invoice_total_billed')}
            </Text>
            <Text style={[s.grandTotalValue, { color: textPrimary, fontFamily: FONTS.bebas, includeFontPadding: false }]}>
              {formatEuros(total)}
            </Text>
          </View>
        </View>

        {/* Net Earnings block — affiché uniquement si le backend fournit le net */}
        {netEarnings != null && (
          <View style={[s.netBlock, { backgroundColor: surfaceBg }]}>
            <View style={s.netHeader}>
              <Feather name="credit-card" size={15} color={textMuted} />
              <Text style={[s.netLabel, { color: textMuted, fontFamily: FONTS.sansMedium }]}>
                {t('ext.invoice_net_received')}
              </Text>
            </View>
            <View style={s.netRow}>
              <View>
                <Text style={[s.netValue, { color: textPrimary, fontFamily: FONTS.bebas, includeFontPadding: false }]}>
                  {formatEuros(netEarnings)}
                </Text>
                {commissionPct != null && (
                  <Text style={[s.netSub, { color: textMuted, fontFamily: FONTS.sans }]}>
                    {t('ext.invoice_after_commission', { pct: commissionPct })}
                  </Text>
                )}
              </View>
            </View>
            {payoutDate && (
              <View style={[s.payoutBadge, { backgroundColor: theme.surface }]}>
                <Feather name="clock" size={12} color={textMuted} />
                <Text style={[s.payoutText, { color: textSecondary, fontFamily: FONTS.sansMedium }]}>
                  {t('ext.invoice_payout_scheduled', { date: payoutDate })}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Badges */}
        <InvoiceStatusBadges isPaid={isPaid} dark={theme.isDark} paymentMethod={paymentMethod} palette={palette} />

        <InvoiceDivider color={borderColor} />

        {/* Actions : Download (primaire, plein) + Close (secondaire, sans cadre) */}
        <InvoiceActions variant="provider" downloading={downloading} onDownload={onDownload} onClose={onClose} palette={palette} />
      </View>
    </>
  );
}
