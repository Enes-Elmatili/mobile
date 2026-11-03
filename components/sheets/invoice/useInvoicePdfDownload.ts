// components/sheets/invoice/useInvoicePdfDownload.ts — Téléchargement du PDF
// de facture puis partage natif (verrou anti double-tap, filet 15 s, timeout 30 s).
import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { TFunction } from 'i18next';
import { api } from '@/lib/api';
import { tokenStorage } from '@/lib/storage';
import { devLog } from '@/lib/logger';
import i18n from '@/lib/i18n';
import { feedback } from '@/lib/feedback/feedback';
import { invoicePdfFileName, pdfDownloadHeaders, pdfLang } from '@/lib/invoice/invoiceSheet';

export function useInvoicePdfDownload(invoiceId: string | undefined, invoiceNo: string | undefined, t: TFunction) {
  const [downloading, setDownloading] = useState(false);
  const downloadingRef = useRef(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cancel the safety timer on unmount to avoid setDownloading running after
  // the sheet closes mid-download.
  useEffect(() => () => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    if (!invoiceId || downloadingRef.current) return;
    downloadingRef.current = true;
    setDownloading(true);

    // Filet de sécurité : reset automatique après 15s quoi qu'il arrive
    safetyTimerRef.current = setTimeout(() => {
      downloadingRef.current = false;
      setDownloading(false);
    }, 15000);

    try {
      const url = api.invoices.getPdfUrl(invoiceId);
      const token = await tokenStorage.getToken();
      const fileName = invoicePdfFileName(invoiceId, invoiceNo);
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      devLog('📄 Downloading PDF:', url);

      // Renforce le `?lang=` dans l'URL avec un header Accept-Language pour les
      // intermédiaires (proxy/CDN) qui pourraient stripper les query params.
      const lang = pdfLang(i18n.language);
      const downloadPromise = FileSystem.downloadAsync(url, fileUri, {
        headers: pdfDownloadHeaders(token, lang),
      });

      // Timeout de 30s sur le téléchargement réseau
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 30000)
      );

      const result = await Promise.race([downloadPromise, timeoutPromise]);

      if (result.status !== 200) {
        feedback.error('common.error');
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('ext.invoice_share_title'),
        }).catch(() => {
          // L'utilisateur a annulé le partage — pas une erreur
        });
      } else {
        feedback.success('profile.invoice_downloaded');
      }
    } catch (e: unknown) {
      devLog('📄 PDF download failed:', (e as { message?: string } | null | undefined)?.message);
      feedback.error('common.error');
    } finally {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      downloadingRef.current = false;
      setDownloading(false);
    }
  }, [invoiceId, invoiceNo, t]);

  return { downloading, handleDownloadPDF };
}
