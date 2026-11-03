// components/sheets/invoice/InvoiceParts.tsx — Sous-composants de la feuille
// facture : filet, ligne de détail, badges de statut, actions PDF / fermer.
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS, COLORS } from '@/hooks/use-app-theme';
import type { InvoiceItem } from '@/lib/types';
import { formatEUR as formatEuros } from '@/lib/format';
import { statusBadgeBg } from '@/lib/invoice/invoiceSheet';
import { PressScale } from '@/components/ui/PressScale';
import { s, li, type InvoicePalette } from './styles';

export function InvoiceDivider({ color }: { color: string }) {
  return (
    <View
      style={{
        height: 0.5,
        backgroundColor: color,
        marginVertical: 10,
      }}
    />
  );
}

/** Ligne de détail — montants en euros. */
export function LineItem({
  item,
  textColor,
  subColor,
}: {
  item: InvoiceItem;
  textColor: string;
  subColor: string;
}) {

  return (
    <View style={li.row}>
      <View style={li.left}>
        <Text style={[li.label, { color: textColor, fontFamily: FONTS.sansMedium }]}>{item.label}</Text>
        <Text style={[li.detail, { color: subColor, fontFamily: FONTS.sans }]}>
          {item.quantity} × {formatEuros(item.unitPrice)}
        </Text>
      </View>
      <Text style={[li.total, { color: textColor, fontFamily: FONTS.monoMedium }]}>
        {formatEuros(item.total)}
      </Text>
    </View>
  );
}

// ── Status badges (shared between both views) ──
export function InvoiceStatusBadges({ isPaid, dark, paymentMethod, palette }: {
  isPaid: boolean;
  dark: boolean;
  paymentMethod: 'card' | 'cash';
  palette: InvoicePalette;
}) {
  const { t } = useTranslation();
  const { surfaceBg, textMuted, textSecondary } = palette;
  return (
    <View style={s.statusRow}>
      <View
        style={[
          s.statusBadge,
          {
            backgroundColor: statusBadgeBg(isPaid, dark),
          },
        ]}
      >
        <Feather
          name={isPaid ? 'check-circle' : 'clock'}
          size={14}
          color={isPaid ? COLORS.green : COLORS.amber}
        />
        <Text style={[s.statusText, { color: isPaid ? COLORS.green : COLORS.amber, fontFamily: FONTS.sansMedium }]}>
          {isPaid ? t('ext.invoice_status_paid') : t('ext.invoice_status_pending')}
        </Text>
      </View>
      <View style={[s.paymentMethodPill, { backgroundColor: surfaceBg }]}>
        <Feather
          name={paymentMethod === 'cash' ? 'dollar-sign' : 'credit-card'}
          size={12}
          color={textMuted}
        />
        <Text style={[s.paymentMethodText, { color: textSecondary, fontFamily: FONTS.sansMedium }]}>
          {paymentMethod === 'cash' ? t('ext.invoice_payment_cash') : t('ext.invoice_payment_card')}
        </Text>
      </View>
    </View>
  );
}

/**
 * Actions : Download (primaire, plein) + Close. Prestataire : fermer sans cadre
 * ni fond (texte seul) et libellé PDF sur une ligne ; client : fermer encadré.
 */
export function InvoiceActions({ variant, downloading, onDownload, onClose, palette }: {
  variant: 'provider' | 'client';
  downloading: boolean;
  onDownload: () => void;
  onClose: () => void;
  palette: InvoicePalette;
}) {
  const { t } = useTranslation();
  const { accentBg, accentText, textMuted, textSecondary, borderColor } = palette;
  const isProvider = variant === 'provider';
  return (
    <View style={s.actions}>
      <PressScale accessibilityRole="button"
        style={[s.btnPrimary, { backgroundColor: accentBg }]}
        onPress={onDownload}
        disabled={downloading}
      >
        {downloading ? (
          <ActivityIndicator size="small" color={accentText} />
        ) : (
          <Feather name="download" size={18} color={accentText} />
        )}
        <Text
          style={[s.btnPrimaryText, { color: accentText, fontFamily: FONTS.sansMedium }]}
          numberOfLines={isProvider ? 1 : undefined}
        >
          {downloading ? t('ext.invoice_downloading') : t('ext.invoice_download_pdf')}
        </Text>
      </PressScale>

      {isProvider ? (
        <PressScale accessibilityRole="button"
          style={s.btnGhost}
          onPress={onClose}
        >
          <Text style={[s.btnGhostText, { color: textMuted, fontFamily: FONTS.sansMedium }]}>
            {t('ext.invoice_close_btn')}
          </Text>
        </PressScale>
      ) : (
        <PressScale accessibilityRole="button"
          style={[s.btnOutline, { borderColor: borderColor }]}
          onPress={onClose}
        >
          <Text style={[s.btnOutlineText, { color: textSecondary, fontFamily: FONTS.sansMedium }]}>
            {t('ext.invoice_close_btn')}
          </Text>
        </PressScale>
      )}
    </View>
  );
}
