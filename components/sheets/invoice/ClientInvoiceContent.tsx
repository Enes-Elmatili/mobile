// components/sheets/invoice/ClientInvoiceContent.tsx — Facture, vue client
// détaillée : service, lignes, sous-total / TVA (si fournis), total.
import React from 'react';
import { View, Text, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS, type AppTheme } from '@/hooks/use-app-theme';
import type { InvoiceItem } from '@/lib/types';
import { formatEUR as formatEuros } from '@/lib/format';
import { vatPercent, type invoiceAmounts } from '@/lib/invoice/invoiceSheet';
import { InvoiceActions, InvoiceDivider, InvoiceStatusBadges, LineItem } from './InvoiceParts';
import { s, type InvoicePalette } from './styles';

export function ClientInvoiceContent({
  theme, palette, amounts, items, invoiceNumber, displayServiceTitle, displayProviderName, displayDate, duration,
  downloading, onDownload, onClose,
}: {
  theme: AppTheme;
  palette: InvoicePalette;
  /** Montants en euros. */
  amounts: ReturnType<typeof invoiceAmounts>;
  items: InvoiceItem[];
  invoiceNumber: string;
  displayServiceTitle: string;
  displayProviderName: string;
  displayDate: string;
  duration?: string;
  downloading: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { textPrimary, textSecondary, textMuted, surfaceBg, borderColor } = palette;
  const { subtotal, taxRate, taxAmount, total, isPaid, paymentMethod } = amounts;
  return (
    <>
      {/* Header: Logo + Invoice Number */}
      <View style={s.headerRow}>
        <View style={s.logoWrap}>
          <Image
            source={require('@/assets/app-icons-ios/app-icon-120x120.png')}
            style={s.logo}
            resizeMode="contain"
          />
        </View>
        <View style={s.headerRight}>
          <Text style={[s.invoiceLabel, { color: textMuted, fontFamily: FONTS.sansMedium }]}>{t('ext.invoice_label_label')}</Text>
          <Text style={[s.invoiceNumber, { color: textPrimary, fontFamily: FONTS.bebas, includeFontPadding: false }]}>
            {invoiceNumber}
          </Text>
        </View>
      </View>

      <View style={s.body}>
        {/* Service Block */}
        <View style={[s.serviceBlock, { backgroundColor: surfaceBg }]}>
          <View style={[s.serviceIconWrap, { backgroundColor: theme.surface }]}>
            <Feather name="tool" size={20} color={textSecondary} />
          </View>
          <View style={s.serviceInfo}>
            <Text style={[s.serviceTitle, { color: textPrimary, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
              {displayServiceTitle}
            </Text>
            <Text style={[s.serviceProvider, { color: textSecondary, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
              {displayProviderName}
            </Text>
            <View style={s.serviceMeta}>
              {displayDate ? (
                <Text style={[s.serviceMetaText, { color: textMuted, fontFamily: FONTS.sans }]}>
                  {displayDate}
                </Text>
              ) : null}
              {duration ? (
                <>
                  <Text style={[s.serviceMetaDot, { color: textMuted }]}>·</Text>
                  <Text style={[s.serviceMetaText, { color: textMuted, fontFamily: FONTS.sans }]}>
                    {duration}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        </View>

        <InvoiceDivider color={borderColor} />

        {/* Line Items — uniquement si le backend fournit le détail */}
        {items.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Feather name="file-text" size={13} color={textMuted} />
              <Text style={[s.sectionLabel, { color: textMuted, fontFamily: FONTS.sansMedium }]}>{t('ext.invoice_detail_label')}</Text>
            </View>

            {items.map((item, i) => (
              <LineItem key={i} item={item} textColor={textPrimary} subColor={textSecondary} />
            ))}

            <InvoiceDivider color={borderColor} />
          </>
        )}

        {/* Totals — sous-total / TVA affichés SEULEMENT si fournis par le backend.
            Sans breakdown, on n'affiche que le total (aucune TVA inventée). */}
        <View style={s.totalsBlock}>
          {subtotal != null && (
            <View style={s.totalLine}>
              <Text style={[s.totalLineLabel, { color: textSecondary, fontFamily: FONTS.sans }]}>
                {t('ext.invoice_subtotal')}
              </Text>
              <Text style={[s.totalLineValue, { color: textSecondary, fontFamily: FONTS.mono }]}>
                {formatEuros(subtotal)}
              </Text>
            </View>
          )}
          {taxAmount != null && (
            <View style={s.totalLine}>
              <Text style={[s.totalLineLabel, { color: textSecondary, fontFamily: FONTS.sans }]}>
                {t('ext.invoice_vat', { pct: vatPercent(taxRate) })}
              </Text>
              <Text style={[s.totalLineValue, { color: textSecondary, fontFamily: FONTS.mono }]}>
                {formatEuros(taxAmount)}
              </Text>
            </View>
          )}

          {(subtotal != null || taxAmount != null) && (
            <View style={[s.totalDivider, { backgroundColor: borderColor }]} />
          )}

          <View style={s.totalLine}>
            <Text style={[s.grandTotalLabel, { color: textPrimary, fontFamily: FONTS.sansMedium }]}>
              {t('ext.invoice_total')}
            </Text>
            <Text style={[s.grandTotalValue, { color: textPrimary, fontFamily: FONTS.bebas, includeFontPadding: false }]}>
              {formatEuros(total)}
            </Text>
          </View>
        </View>

        {/* Badges */}
        <InvoiceStatusBadges isPaid={isPaid} dark={theme.isDark} paymentMethod={paymentMethod} palette={palette} />

        <InvoiceDivider color={borderColor} />

        {/* Actions */}
        <InvoiceActions variant="client" downloading={downloading} onDownload={onDownload} onClose={onClose} palette={palette} />
      </View>
    </>
  );
}
