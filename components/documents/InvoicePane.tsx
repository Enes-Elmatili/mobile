// components/documents/InvoicePane.tsx
// La facture dans la page droite du Duo déplié (Documents, Mes factures) : le
// même contenu que la feuille (ClientInvoiceContent / ProviderInvoiceContent),
// posé comme un reçu sur la page d'en face au lieu d'un bottom sheet qui
// recouvrirait la liste. « Fermer » vide la page.
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { Invoice } from '@/hooks/useInvoice';
import { localeFor } from '@/lib/format';
import { cleanName } from '@/lib/displayName';
import {
  displayInvoiceNumber, fmtInvoiceDate, invoiceAmounts, invoiceItems, payoutDateOf,
} from '@/lib/invoice/invoiceSheet';
import { invoicePalette } from '@/components/sheets/invoice/styles';
import { useInvoicePdfDownload } from '@/components/sheets/invoice/useInvoicePdfDownload';
import { ClientInvoiceContent } from '@/components/sheets/invoice/ClientInvoiceContent';
import { ProviderInvoiceContent } from '@/components/sheets/invoice/ProviderInvoiceContent';

export function InvoicePane({ invoice, userRole = 'client', onClose, bottomPad = 24 }: {
  invoice: Invoice;
  userRole?: 'client' | 'provider';
  onClose: () => void;
  /** Dégagement bas (barre d'onglets, home indicator). */
  bottomPad?: number;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const palette = invoicePalette(theme);
  const locale = localeFor(i18n.language);
  // Mêmes règles que la feuille : rien que ce que le backend fournit (breakdown).
  const breakdown = invoice.breakdown;
  const items = useMemo(() => invoiceItems(breakdown), [breakdown]);
  const amounts = invoiceAmounts(invoice);
  const { downloading, handleDownloadPDF } = useInvoicePdfDownload(invoice.id, invoice.number, t);

  const common = {
    theme, palette, amounts,
    invoiceNumber: displayInvoiceNumber(invoice),
    displayServiceTitle: invoice.request?.serviceType || t('ext.invoice_service_fallback'),
    displayProviderName: cleanName(invoice.request?.provider?.name, { fallback: t('ext.invoice_provider_fallback') }),
    downloading, onDownload: handleDownloadPDF, onClose,
  };

  return (
    <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
      <View style={[s.card, { backgroundColor: palette.bg, borderColor: theme.borderLight }]}>
        {userRole === 'provider' ? (
          <ProviderInvoiceContent
            {...common}
            displayDateShort={invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : ''}
            payoutDate={invoice.issuedAt ? payoutDateOf(invoice.issuedAt, locale) : null}
          />
        ) : (
          <ClientInvoiceContent
            {...common}
            items={items}
            displayDate={invoice.issuedAt ? fmtInvoiceDate(invoice.issuedAt, locale) : ''}
          />
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  // Page : 20 pt de chaque côté, le haut aligné sur l'en-tête de la page gauche.
  scroll: { paddingHorizontal: 20, paddingTop: 12 },
  card: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', paddingBottom: 8 },
});
