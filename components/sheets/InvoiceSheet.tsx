// components/sheets/InvoiceSheet.tsx
// ─── Facture Premium — Bottom Sheet Receipt — Client & Provider views ───────
// Design : monochrome strict (blanc client / sombre provider)
// TVA 21% belge, montants tabular-nums alignés à droite

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import type { Invoice, InvoiceItem } from '@/hooks/useInvoice';
import { api } from '@/lib/api';
import { tokenStorage } from '@/lib/storage';
import { devLog } from '@/lib/logger';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { feedback } from '@/lib/feedback/feedback';
import { formatEUR as formatEuros } from '@/lib/format';

// Locale BCP-47 dérivée de la langue i18n active. Évite les hardcodes
// `fr-BE` qui forcent un format date FR même sur device NL/EN.
const getLocale = () => {
  const map: Record<string, string> = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-GB' };
  return map[i18n.language] || 'fr-BE';
};

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
  serviceTitle?: string;
  /** Mission date */
  missionDate?: string;
  /** Mission duration (e.g. "2h30") */
  duration?: string;
  /** @deprecated No longer used — kept for backward compat */
  onNavigateToWallet?: () => void;
}

// ─── Utils ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString(getLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleDateString(getLocale(), {
    day: '2-digit',
    month: '2-digit',
  });

// Estimated payout: 48h after issuedAt
const getPayoutDate = (issuedAt: string): string => {
  const d = new Date(issuedAt);
  d.setDate(d.getDate() + 2);
  return fmtDateShort(d.toISOString());
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function InvoiceDivider({ color }: { color: string }) {
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

function LineItem({
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

const li = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  left: { flex: 1, paddingRight: 12 },
  label: { fontSize: 14, marginBottom: 2 },
  detail: { fontSize: 12 },
  total: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
});

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
  onNavigateToWallet,
}: InvoiceSheetProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 70 : 54;
  const isProvider = userRole === 'provider';
  const dark = theme.isDark;

  // ── Colors — driven by system theme ──
  const bg = theme.cardBg;
  const textPrimary = theme.text;
  const textSecondary = theme.textSub;
  const textMuted = theme.textMuted;
  const surfaceBg = theme.surfaceAlt;
  const borderColor = theme.border;
  const accentBg = theme.accent;
  const accentText = theme.accentText;

  const renderBackdrop = useCallback(
    (props: any) => (
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
    () => (breakdown?.items?.length ? breakdown.items : []),
    [breakdown],
  );

  const subtotal = breakdown?.subtotal ?? null;
  const taxRate = breakdown?.taxRate ?? null;
  const taxAmount = breakdown?.taxAmount ?? null;
  const total = breakdown?.total ?? invoice?.amount ?? 0;
  const paymentMethod = breakdown?.paymentMethod ?? 'card';
  const isPaid = invoice?.status === 'PAID';

  // Provider-specific — net EXCLUSIVEMENT depuis le backend. Absent → pas de bloc net.
  const netEarnings = breakdown?.providerEarnings ?? null;
  const commissionPct = netEarnings != null && total > 0
    ? Math.round((1 - netEarnings / total) * 100)
    : null;
  const payoutDate = invoice?.issuedAt ? getPayoutDate(invoice.issuedAt) : null;

  // ── PDF download ──
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
    if (!invoice?.id || downloadingRef.current) return;
    downloadingRef.current = true;
    setDownloading(true);

    // Filet de sécurité : reset automatique après 15s quoi qu'il arrive
    safetyTimerRef.current = setTimeout(() => {
      downloadingRef.current = false;
      setDownloading(false);
    }, 15000);

    try {
      const url = api.invoices.getPdfUrl(invoice.id);
      const token = await tokenStorage.getToken();
      const fileName = invoice.number ? `${invoice.number}.pdf` : `facture-${invoice.id.slice(-6)}.pdf`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      devLog('📄 Downloading PDF:', url);

      // Renforce le `?lang=` dans l'URL avec un header Accept-Language pour les
      // intermédiaires (proxy/CDN) qui pourraient stripper les query params.
      const lang = (i18n.language || 'fr').split('-')[0].toLowerCase();
      const downloadPromise = FileSystem.downloadAsync(url, fileUri, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Accept-Language': lang,
          'X-Client-Lang': lang,
        },
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
    } catch (e: any) {
      devLog('📄 PDF download failed:', e?.message);
      feedback.error('common.error');
    } finally {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      downloadingRef.current = false;
      setDownloading(false);
    }
  }, [invoice?.id, invoice?.number]);

  if (!isVisible || !invoice) return null;

  const invoiceNumber = invoice.number
    ? `#FIXED-${invoice.number.replace(/^\d{4}-/, '')}`
    : `#FIXED-${String(invoice.id).slice(-5).toUpperCase()}`;

  const displayProviderName =
    providerName || invoice.request?.provider?.name || t('ext.invoice_provider_fallback');
  const displayServiceTitle =
    serviceTitle || invoice.request?.serviceType || t('ext.invoice_service_fallback');
  const displayDate = missionDate || (invoice.issuedAt ? fmtDate(invoice.issuedAt) : '');
  const displayDateShort = invoice.issuedAt
    ? new Date(invoice.issuedAt).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' })
    : '';

  // ── Status badges (shared between both views) ──
  const statusBadges = (
    <View style={s.statusRow}>
      <View
        style={[
          s.statusBadge,
          {
            backgroundColor: isPaid
              ? dark ? 'rgba(21,193,110,0.15)' : 'rgba(21,193,110,0.06)'
              : dark ? 'rgba(255,165,0,0.15)' : 'rgba(255,165,0,0.06)',
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

  // ── Provider: compact view ──
  const providerContent = (
    <>
      {/* Compact header: invoice number left, date right */}
      <View style={s.compactHeader}>
        <Text style={[s.invoiceNumber, { color: textPrimary, fontFamily: FONTS.bebas }]}>
          {invoiceNumber}
        </Text>
        <Text style={[s.compactDate, { color: textMuted, fontFamily: FONTS.sansMedium }]}>
          {displayDateShort}
        </Text>
      </View>

      <View style={s.body}>
        {/* Service — simple inline text, no card */}
        <Text style={[s.compactService, { color: textSecondary, fontFamily: FONTS.sansMedium }]}>
          {displayServiceTitle} · {displayProviderName}
        </Text>

        <InvoiceDivider color={borderColor} />

        {/* Total facturé — hero */}
        <View style={s.totalsBlock}>
          <View style={s.totalLine}>
            <Text style={[s.grandTotalLabel, { color: textPrimary, fontFamily: FONTS.sansMedium }]}>
              {t('ext.invoice_total_billed')}
            </Text>
            <Text style={[s.grandTotalValue, { color: textPrimary, fontFamily: FONTS.bebas }]}>
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
                <Text style={[s.netValue, { color: textPrimary, fontFamily: FONTS.bebas }]}>
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
        {statusBadges}

        <InvoiceDivider color={borderColor} />

        {/* Actions : Download (primaire, plein) + Close (secondaire, sans cadre) */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.btnPrimary, { backgroundColor: accentBg }]}
            onPress={handleDownloadPDF}
            activeOpacity={0.78}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={accentText} />
            ) : (
              <Feather name="download" size={18} color={accentText} />
            )}
            <Text style={[s.btnPrimaryText, { color: accentText, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
              {downloading ? t('ext.invoice_downloading') : t('ext.invoice_download_pdf')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.btnGhost}
            onPress={onClose}
            activeOpacity={0.6}
          >
            <Text style={[s.btnGhostText, { color: textMuted, fontFamily: FONTS.sansMedium }]}>
              {t('ext.invoice_close_btn')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  // ── Client: full detailed view ──
  const clientContent = (
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
          <Text style={[s.invoiceNumber, { color: textPrimary, fontFamily: FONTS.bebas }]}>
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
            <Text style={[s.serviceTitle, { color: textPrimary, fontFamily: FONTS.sansMedium }]}>
              {displayServiceTitle}
            </Text>
            <Text style={[s.serviceProvider, { color: textSecondary, fontFamily: FONTS.sansMedium }]}>
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
                {t('ext.invoice_vat', { pct: Math.round((taxRate ?? 0) * 100) })}
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
            <Text style={[s.grandTotalValue, { color: textPrimary, fontFamily: FONTS.bebas }]}>
              {formatEuros(total)}
            </Text>
          </View>
        </View>

        {/* Badges */}
        {statusBadges}

        <InvoiceDivider color={borderColor} />

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.btnPrimary, { backgroundColor: accentBg }]}
            onPress={handleDownloadPDF}
            activeOpacity={0.78}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={accentText} />
            ) : (
              <Feather name="download" size={18} color={accentText} />
            )}
            <Text style={[s.btnPrimaryText, { color: accentText, fontFamily: FONTS.sansMedium }]}>
              {downloading ? t('ext.invoice_downloading') : t('ext.invoice_download_pdf')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btnOutline, { borderColor: borderColor }]}
            onPress={onClose}
            activeOpacity={0.78}
          >
            <Text style={[s.btnOutlineText, { color: textSecondary, fontFamily: FONTS.sansMedium }]}>
              {t('ext.invoice_close_btn')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

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
      backgroundStyle={{ backgroundColor: bg }}
      maxDynamicContentSize={Dimensions.get('window').height * 0.88}
      animationConfigs={{
        damping: 20,
        stiffness: 200,
        mass: 1,
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {isProvider ? providerContent : clientContent}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  indicator: { width: 36, height: 4 },
  scroll: { paddingBottom: 24 },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 20,
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logo: {
    width: 48,
    height: 48,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  invoiceLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  invoiceNumber: {
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },

  // ── Compact Header (provider) ──
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 12,
  },
  compactDate: {
    fontSize: 13,
  },
  compactService: {
    fontSize: 13,
    marginBottom: 2,
  },

  // ── Body ──
  body: { paddingHorizontal: 22 },

  // ── Service Block ──
  serviceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    padding: 14,
  },
  serviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceInfo: { flex: 1 },
  serviceTitle: {
    fontSize: 16,
    marginBottom: 2,
  },
  serviceProvider: {
    fontSize: 13,
    marginBottom: 4,
  },
  serviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceMetaText: {
    fontSize: 12,
  },
  serviceMetaDot: {
    fontSize: 12,
  },

  // ── Sections ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
  },

  // ── Totals ──
  totalsBlock: {
    gap: 6,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLineLabel: {
    fontSize: 14,
  },
  totalLineValue: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  totalDivider: {
    height: 0.5,
    marginVertical: 8,
  },
  grandTotalLabel: {
    fontSize: 16,
  },
  grandTotalValue: {
    fontSize: 26,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    textAlign: 'right',
  },

  // ── Provider Net Block ──
  netBlock: {
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    gap: 10,
  },
  netHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  netLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  netValue: {
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  netSub: {
    fontSize: 12,
    marginTop: 2,
  },
  payoutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  payoutText: {
    fontSize: 12,
  },

  // ── Status ──
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
  },
  paymentMethodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  paymentMethodText: {
    fontSize: 12,
  },

  // ── Buttons ──
  actions: {
    gap: 6,
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  btnOutlineText: {
    fontSize: 15,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    // Raised tactile : top highlight + bottom chamfer + drop shadow renforcée.
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.45)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.32,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
    }),
  },
  btnPrimaryText: {
    fontSize: 15,
  },
  // Close : bouton secondaire sans cadre ni fond (texte seul), sous le CTA principal
  btnGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  btnGhostText: {
    fontSize: 15,
  },
});
