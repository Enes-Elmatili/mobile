// components/sheets/InvoiceSheet.tsx
// ─── Facture Premium — Bottom Sheet Receipt — Client & Provider views ───────
// Design : monochrome strict (blanc client / sombre provider)
// TVA 21% belge, montants tabular-nums alignés à droite

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import type { Invoice, InvoiceItem } from '@/hooks/useInvoice';
import { api } from '@/lib/api';
import { tokenStorage } from '@/lib/storage';
import { devLog } from '@/lib/logger';

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

// ─── Constants ──────────────────────────────────────────────────────────────

const TAX_RATE = 0.21;
const PLATFORM_FEE_RATE = 0.15;

// ─── Utils ──────────────────────────────────────────────────────────────────

const formatEuros = (n: number) =>
  n.toLocaleString('fr-BE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const fmtDateShort = (d: string) =>
  new Date(d).toLocaleDateString('fr-BE', {
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
        marginVertical: 14,
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
  const breakdown = invoice?.breakdown;
  const items: InvoiceItem[] = useMemo(() => {
    if (breakdown?.items?.length) return breakdown.items;
    // Fallback: create a single item from the invoice amount
    if (invoice?.amount) {
      const subtotal = invoice.amount / (1 + TAX_RATE);
      return [
        {
          label: serviceTitle || invoice.request?.serviceType || 'Service',
          quantity: 1,
          unitPrice: subtotal,
          total: subtotal,
        },
      ];
    }
    return [];
  }, [invoice, breakdown, serviceTitle]);

  const subtotal = breakdown?.subtotal ?? items.reduce((s, i) => s + i.total, 0);
  const taxRate = breakdown?.taxRate ?? TAX_RATE;
  const taxAmount = breakdown?.taxAmount ?? subtotal * taxRate;
  const total = breakdown?.total ?? subtotal + taxAmount;
  const paymentMethod = breakdown?.paymentMethod ?? 'card';
  const isPaid = invoice?.status === 'PAID';

  // Provider-specific
  const platformFee = total * PLATFORM_FEE_RATE;
  const netEarnings = breakdown?.providerEarnings ?? total - platformFee;
  const payoutDate = invoice?.issuedAt ? getPayoutDate(invoice.issuedAt) : null;

  // ── PDF download ──
  const [downloading, setDownloading] = useState(false);
  const downloadingRef = useRef(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      const downloadPromise = FileSystem.downloadAsync(url, fileUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      // Timeout de 30s sur le téléchargement réseau
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 30000)
      );

      const result = await Promise.race([downloadPromise, timeoutPromise]);

      if (result.status !== 200) {
        Alert.alert('Erreur', 'Impossible de télécharger la facture.');
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Facture FIXED',
        }).catch(() => {
          // L'utilisateur a annulé le partage — pas une erreur
        });
      } else {
        Alert.alert('Succès', 'Facture téléchargée.');
      }
    } catch (e: any) {
      devLog('📄 PDF download failed:', e?.message);
      Alert.alert('Erreur', 'Impossible de télécharger la facture.');
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
    providerName || invoice.request?.provider?.name || 'Prestataire';
  const displayServiceTitle =
    serviceTitle || invoice.request?.serviceType || 'Service';
  const displayDate = missionDate || (invoice.issuedAt ? fmtDate(invoice.issuedAt) : '');
  const displayDateShort = invoice.issuedAt
    ? new Date(invoice.issuedAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
    : '';

  // ── Status badges (shared between both views) ──
  const statusBadges = (
    <View style={s.statusRow}>
      <View
        style={[
          s.statusBadge,
          {
            backgroundColor: isPaid
              ? dark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.06)'
              : dark ? 'rgba(255,165,0,0.15)' : 'rgba(255,165,0,0.06)',
          },
        ]}
      >
        <Ionicons
          name={isPaid ? 'checkmark-circle' : 'time-outline'}
          size={14}
          color={isPaid ? COLORS.green : COLORS.amber}
        />
        <Text style={[s.statusText, { color: isPaid ? COLORS.green : COLORS.amber, fontFamily: FONTS.sansMedium }]}>
          {isPaid ? 'Payé' : 'En attente'}
        </Text>
      </View>
      <View style={[s.paymentMethodPill, { backgroundColor: surfaceBg }]}>
        <Ionicons
          name={paymentMethod === 'card' ? 'card-outline' : 'cash-outline'}
          size={12}
          color={textMuted}
        />
        <Text style={[s.paymentMethodText, { color: textSecondary, fontFamily: FONTS.sansMedium }]}>
          {paymentMethod === 'card' ? 'Carte' : 'Espèces'}
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
              Total facturé
            </Text>
            <Text style={[s.grandTotalValue, { color: textPrimary, fontFamily: FONTS.bebas }]}>
              {formatEuros(total)}
            </Text>
          </View>
        </View>

        {/* Net Earnings block */}
        <View style={[s.netBlock, { backgroundColor: surfaceBg }]}>
          <View style={s.netHeader}>
            <Ionicons name="wallet-outline" size={15} color={textMuted} />
            <Text style={[s.netLabel, { color: textMuted, fontFamily: FONTS.sansMedium }]}>
              MONTANT NET REÇU
            </Text>
          </View>
          <View style={s.netRow}>
            <View>
              <Text style={[s.netValue, { color: textPrimary, fontFamily: FONTS.bebas }]}>
                {formatEuros(netEarnings)}
              </Text>
              <Text style={[s.netSub, { color: textMuted, fontFamily: FONTS.sans }]}>
                Après commission FIXED ({Math.round(PLATFORM_FEE_RATE * 100)}%)
              </Text>
            </View>
          </View>
          {payoutDate && (
            <View style={[s.payoutBadge, { backgroundColor: theme.surface }]}>
              <Ionicons name="time-outline" size={12} color={textMuted} />
              <Text style={[s.payoutText, { color: textSecondary, fontFamily: FONTS.sansMedium }]}>
                Virement prévu le {payoutDate}
              </Text>
            </View>
          )}
        </View>

        {/* Badges */}
        {statusBadges}

        <InvoiceDivider color={borderColor} />

        {/* Actions: 2 buttons only */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.btnOutline, { borderColor: borderColor }]}
            onPress={handleDownloadPDF}
            activeOpacity={0.78}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={textSecondary} />
            ) : (
              <Ionicons name="download-outline" size={18} color={textSecondary} />
            )}
            <Text style={[s.btnOutlineText, { color: textSecondary, fontFamily: FONTS.sansMedium }]}>
              {downloading ? 'Téléchargement...' : 'Télécharger PDF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btnPrimary, { backgroundColor: accentBg }]}
            onPress={onClose}
            activeOpacity={0.78}
          >
            <Text style={[s.btnPrimaryText, { color: accentText, fontFamily: FONTS.sansMedium }]}>
              Fermer
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
          <Text style={[s.invoiceLabel, { color: textMuted, fontFamily: FONTS.sansMedium }]}>FACTURE</Text>
          <Text style={[s.invoiceNumber, { color: textPrimary, fontFamily: FONTS.bebas }]}>
            {invoiceNumber}
          </Text>
        </View>
      </View>

      <View style={s.body}>
        {/* Service Block */}
        <View style={[s.serviceBlock, { backgroundColor: surfaceBg }]}>
          <View style={[s.serviceIconWrap, { backgroundColor: theme.surface }]}>
            <Ionicons name="construct-outline" size={20} color={textSecondary} />
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

        {/* Line Items */}
        <View style={s.sectionHeader}>
          <Ionicons name="receipt-outline" size={13} color={textMuted} />
          <Text style={[s.sectionLabel, { color: textMuted, fontFamily: FONTS.sansMedium }]}>DÉTAIL</Text>
        </View>

        {items.map((item, i) => (
          <LineItem key={i} item={item} textColor={textPrimary} subColor={textSecondary} />
        ))}

        <InvoiceDivider color={borderColor} />

        {/* Totals */}
        <View style={s.totalsBlock}>
          <View style={s.totalLine}>
            <Text style={[s.totalLineLabel, { color: textSecondary, fontFamily: FONTS.sans }]}>
              Sous-total
            </Text>
            <Text style={[s.totalLineValue, { color: textSecondary, fontFamily: FONTS.mono }]}>
              {formatEuros(subtotal)}
            </Text>
          </View>
          <View style={s.totalLine}>
            <Text style={[s.totalLineLabel, { color: textSecondary, fontFamily: FONTS.sans }]}>
              TVA ({Math.round(taxRate * 100)}%)
            </Text>
            <Text style={[s.totalLineValue, { color: textSecondary, fontFamily: FONTS.mono }]}>
              {formatEuros(taxAmount)}
            </Text>
          </View>

          <View style={[s.totalDivider, { backgroundColor: borderColor }]} />

          <View style={s.totalLine}>
            <Text style={[s.grandTotalLabel, { color: textPrimary, fontFamily: FONTS.sansMedium }]}>
              Total
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
              <Ionicons name="download-outline" size={18} color={accentText} />
            )}
            <Text style={[s.btnPrimaryText, { color: accentText, fontFamily: FONTS.sansMedium }]}>
              {downloading ? 'Téléchargement...' : 'Télécharger PDF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btnOutline, { borderColor: borderColor }]}
            onPress={onClose}
            activeOpacity={0.78}
          >
            <Text style={[s.btnOutlineText, { color: textSecondary, fontFamily: FONTS.sansMedium }]}>
              Fermer
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
        contentContainerStyle={[s.scroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}
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
  scroll: { paddingBottom: 48 },

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
    fontSize: 40,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
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
    marginTop: 16,
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
    gap: 10,
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 55,
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
    height: 55,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  btnPrimaryText: {
    fontSize: 15,
  },
});
