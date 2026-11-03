// components/sheets/InvoiceSheet.tsx
// ─── Facture Premium — Bottom Sheet Receipt — Client & Provider views ───────
// Design : monochrome strict (blanc client / sombre provider)
// TVA 21% belge, montants tabular-nums alignés à droite
// Vues dans components/sheets/invoice/, logique pure dans lib/invoice/invoiceSheet.ts.

import { useHideBar } from '@/stores/nav';
import React, { useCallback, useMemo } from 'react';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAndroidBackClose } from '@/hooks/use-android-back-close';
import type { Invoice, InvoiceItem } from '@/hooks/useInvoice';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { localeFor } from '@/lib/format';
import { cleanName } from '@/lib/displayName';
import { useSheetMotion } from '@/lib/motion/sheet';
import { useLayoutClass } from '@/lib/layout';
import {
  displayInvoiceNumber, fmtInvoiceDate, invoiceAmounts, invoiceItems, payoutDateOf,
} from '@/lib/invoice/invoiceSheet';
import { invoicePalette, s } from '@/components/sheets/invoice/styles';
import { useInvoicePdfDownload } from '@/components/sheets/invoice/useInvoicePdfDownload';
import { ProviderInvoiceContent } from '@/components/sheets/invoice/ProviderInvoiceContent';
import { ClientInvoiceContent } from '@/components/sheets/invoice/ClientInvoiceContent';

// Locale BCP-47 dérivée de la langue i18n active. Évite les hardcodes
// `fr-BE` qui forcent un format date FR même sur device NL/EN.
const getLocale = () => localeFor(i18n.language);

// ─── Types ──────────────────────────────────────────────────────────────────

interface InvoiceSheetProps {
  invoice: Invoice | null;
  isVisible: boolean;
  onClose: () => void;
  /** 'client' = white theme, 'provider' = dark theme */
  userRole?: 'client' | 'provider';
  /** Provider name to display on the invoice */
  providerName?: string;
  /** Service type / title */
  serviceTitle?: string | null;
  /** Mission date */
  missionDate?: string;
  /** Mission duration (e.g. "2h30") */
  duration?: string;
  /** @deprecated No longer used — kept for backward compat */
  onNavigateToWallet?: () => void;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function InvoiceSheet({
  invoice,
  isVisible,
  onClose,
  userRole = 'client',
  providerName,
  serviceTitle,
  missionDate,
  duration,
}: InvoiceSheetProps) {
  useHideBar(isVisible); // la barre flottante s'efface tant que la feuille est ouverte
  const theme = useAppTheme();
  const { height: windowHeight } = useLayoutClass();
  const sheetMotion = useSheetMotion();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  useAndroidBackClose(isVisible, onClose);
  const isProvider = userRole === 'provider';

  // ── Colors — driven by system theme ──
  const palette = invoicePalette(theme);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  );

  // ── Computed values ──
  // Règle stricte : on n'affiche QUE ce que le backend fournit dans `breakdown`.
  // Aucun recalcul client (taux TVA variable 6%/21%, commission variable selon le
  // tier). Sans breakdown → on montre uniquement le total, sans décomposition.
  const breakdown = invoice?.breakdown;
  const items: InvoiceItem[] = useMemo(
    () => invoiceItems(breakdown),
    [breakdown],
  );
  // Provider-specific — net EXCLUSIVEMENT depuis le backend. Absent → pas de bloc net.
  const amounts = invoiceAmounts(invoice);
  const payoutDate = invoice?.issuedAt ? payoutDateOf(invoice.issuedAt, getLocale()) : null;

  // ── PDF download ──
  // Lus hors callback : le téléchargement dépend de l'id et du numéro, pas de toute la facture.
  const { downloading, handleDownloadPDF } = useInvoicePdfDownload(invoice?.id, invoice?.number, t);

  if (!isVisible || !invoice) return null;

  const invoiceNumber = displayInvoiceNumber(invoice);

  const displayProviderName =
    cleanName(providerName || invoice.request?.provider?.name, { fallback: t('ext.invoice_provider_fallback') });
  const displayServiceTitle =
    serviceTitle || invoice.request?.serviceType || t('ext.invoice_service_fallback');
  const displayDate = missionDate || (invoice.issuedAt ? fmtInvoiceDate(invoice.issuedAt, getLocale()) : '');
  const displayDateShort = invoice.issuedAt
    ? new Date(invoice.issuedAt).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' })
    : '';

  const common = {
    theme, palette, amounts, invoiceNumber, displayServiceTitle, displayProviderName,
    downloading, onDownload: handleDownloadPDF, onClose,
  };

  return (
    <BottomSheet
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={[
        s.indicator,
        { backgroundColor: theme.textDisabled },
      ]}
      backgroundStyle={{ backgroundColor: palette.bg }}
      maxDynamicContentSize={windowHeight * 0.88}
      {...sheetMotion}
    >
      <BottomSheetScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {isProvider
          ? <ProviderInvoiceContent {...common} displayDateShort={displayDateShort} payoutDate={payoutDate} />
          : <ClientInvoiceContent {...common} items={items} displayDate={displayDate} duration={duration} />}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
