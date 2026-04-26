// components/sheets/QuoteSheet.tsx
// Devis bottom sheet — même présentation que InvoiceSheet

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { formatEURCents as fmtEur } from '@/lib/format';

interface QuoteSheetProps {
  requestId: string | null;
  requestStatus: string;
  serviceName: string;
  isVisible: boolean;
  onClose: () => void;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' });

export default function QuoteSheet({ requestId, requestStatus, serviceName, isVisible, onClose }: QuoteSheetProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 70 : 54;

  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isVisible || !requestId) return;
    setLoading(true);
    setQuote(null);
    api.get(`/quotes/request/${requestId}`)
      .then((res: any) => {
        const q = res?.quotes?.[0];
        if (q) setQuote(q);
      })
      .catch((e: any) => devError('QuoteSheet fetch error:', e))
      .finally(() => setLoading(false));
  }, [isVisible, requestId]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ), []
  );

  if (!isVisible) return null;

  const bg = theme.cardBg;
  const textPrimary = theme.text;
  const textSecondary = theme.textSub;
  const textMuted = theme.textMuted;
  const surfaceBg = theme.surfaceAlt;
  const borderColor = theme.border;
  const accentBg = theme.accent;
  const accentText = theme.accentText;

  const statusUp = requestStatus?.toUpperCase();
  const isSent = statusUp === 'QUOTE_SENT';
  const isAccepted = statusUp === 'QUOTE_ACCEPTED';
  const quoteRef = quote?.id ? `#DVS-${String(quote.id).slice(-5).toUpperCase()}` : '#DVS-???';

  return (
    <BottomSheet
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ width: 36, height: 4, backgroundColor: theme.textDisabled }}
      backgroundStyle={{ backgroundColor: bg }}
      maxDynamicContentSize={Dimensions.get('window').height * 0.88}
      animationConfigs={{ damping: 20, stiffness: 200, mass: 1 }}
    >
      <BottomSheetScrollView
        contentContainerStyle={[qs.scroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={qs.headerRow}>
          <View style={qs.logoWrap}>
            <Image
              source={require('@/assets/app-icons-ios/app-icon-120x120.png')}
              style={qs.logo}
              resizeMode="contain"
            />
          </View>
          <View style={qs.headerRight}>
            <Text style={[qs.quoteLabel, { color: textMuted, fontFamily: FONTS.sansMedium }]}>DEVIS</Text>
            <Text style={[qs.quoteRef, { color: textPrimary, fontFamily: FONTS.bebas }]}>{quoteRef}</Text>
          </View>
        </View>

        <View style={qs.body}>
          {/* Service block */}
          <View style={[qs.serviceBlock, { backgroundColor: surfaceBg }]}>
            <View style={[qs.serviceIconWrap, { backgroundColor: theme.surface }]}>
              <Feather name="file-text" size={20} color={textSecondary} />
            </View>
            <View style={qs.serviceInfo}>
              <Text style={[qs.serviceTitle, { color: textPrimary, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
                {serviceName}
              </Text>
              {quote?.validUntil && (
                <Text style={[qs.serviceMeta, { color: textMuted, fontFamily: FONTS.sans }]}>
                  Valable jusqu'au {fmtDate(quote.validUntil)}
                </Text>
              )}
            </View>
          </View>

          <View style={[qs.divider, { backgroundColor: borderColor }]} />

          {loading ? (
            <ActivityIndicator color={accentBg} style={{ marginVertical: 24 }} />
          ) : quote ? (
            <>
              {/* Breakdown */}
              <View style={qs.sectionHeader}>
                <Feather name="file-text" size={13} color={textMuted} />
                <Text style={[qs.sectionLabel, { color: textMuted, fontFamily: FONTS.sansMedium }]}>DÉTAIL</Text>
              </View>

              <View style={qs.lineRow}>
                <Text style={[qs.lineLabel, { color: textSecondary, fontFamily: FONTS.sans }]}>Main d'œuvre</Text>
                <Text style={[qs.lineVal, { color: textPrimary, fontFamily: FONTS.mono }]}>{fmtEur(quote.laborAmount)}</Text>
              </View>

              {quote.partsAmount > 0 && (
                <View style={{ gap: 2 }}>
                  <View style={qs.lineRow}>
                    <Text style={[qs.lineLabel, { color: textSecondary, fontFamily: FONTS.sans }]}>Pièces / Matériel</Text>
                    <Text style={[qs.lineVal, { color: textPrimary, fontFamily: FONTS.mono }]}>{fmtEur(quote.partsAmount)}</Text>
                  </View>
                  {quote.partsDetail && (
                    <Text style={[qs.lineDetail, { color: textMuted, fontFamily: FONTS.sans }]}>{quote.partsDetail}</Text>
                  )}
                </View>
              )}

              <View style={[qs.divider, { backgroundColor: borderColor, marginVertical: 10 }]} />

              <View style={qs.lineRow}>
                <Text style={[qs.totalLabel, { color: textPrimary, fontFamily: FONTS.sansMedium }]}>Total</Text>
                <Text style={[qs.totalVal, { color: textPrimary, fontFamily: FONTS.bebas }]}>{fmtEur(quote.totalAmount)}</Text>
              </View>

              {quote.calloutPaid > 0 && (
                <View style={qs.lineRow}>
                  <Text style={[qs.lineLabel, { color: COLORS.green, fontFamily: FONTS.sans }]}>Acompte déjà payé</Text>
                  <Text style={[qs.lineVal, { color: COLORS.green, fontFamily: FONTS.mono }]}>-{fmtEur(quote.calloutPaid)}</Text>
                </View>
              )}

              <View style={[qs.divider, { backgroundColor: borderColor, marginVertical: 10 }]} />

              <View style={qs.lineRow}>
                <Text style={[qs.totalLabel, { color: textPrimary, fontFamily: FONTS.sansMedium }]}>Reste à payer</Text>
                <Text style={[qs.remainVal, { color: textPrimary, fontFamily: FONTS.bebas }]}>{fmtEur(quote.remainingAmount)}</Text>
              </View>

              {/* Notes */}
              {quote.notes && (
                <>
                  <View style={[qs.divider, { backgroundColor: borderColor }]} />
                  <View style={qs.sectionHeader}>
                    <Feather name="message-circle" size={13} color={textMuted} />
                    <Text style={[qs.sectionLabel, { color: textMuted, fontFamily: FONTS.sansMedium }]}>NOTES DU PRESTATAIRE</Text>
                  </View>
                  <Text style={[qs.notes, { color: textSecondary, fontFamily: FONTS.sansLight }]}>{quote.notes}</Text>
                </>
              )}

              {/* Status badge */}
              <View style={qs.statusRow}>
                <View style={[qs.statusBadge, { backgroundColor: isAccepted ? 'rgba(61,139,61,0.12)' : isSent ? 'rgba(232,120,58,0.12)' : 'rgba(136,136,136,0.12)' }]}>
                  <Feather
                    name={isAccepted ? 'check-circle' : 'clock'}
                    size={14}
                    color={isAccepted ? COLORS.green : isSent ? COLORS.orangeBrand : textMuted}
                  />
                  <Text style={[qs.statusText, { color: isAccepted ? COLORS.green : isSent ? COLORS.orangeBrand : textMuted, fontFamily: FONTS.sansMedium }]}>
                    {isAccepted ? 'Accepté' : isSent ? 'En attente de réponse' : 'Traitement en cours'}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={[qs.noQuote, { color: textMuted, fontFamily: FONTS.sans }]}>Aucun devis disponible</Text>
          )}

          <View style={[qs.divider, { backgroundColor: borderColor }]} />

          {/* Actions */}
          <View style={qs.actions}>
            {isSent && quote && (
              <TouchableOpacity
                style={[qs.btnPrimary, { backgroundColor: accentBg }]}
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/request/[id]/quote-review', params: { id: String(requestId) } });
                }}
                activeOpacity={0.78}
              >
                <Feather name="check-circle" size={18} color={accentText} />
                <Text style={[qs.btnPrimaryText, { color: accentText, fontFamily: FONTS.sansMedium }]}>
                  Voir et répondre au devis
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[qs.btnOutline, { borderColor: borderColor }]}
              onPress={onClose}
              activeOpacity={0.78}
            >
              <Text style={[qs.btnOutlineText, { color: textSecondary, fontFamily: FONTS.sansMedium }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const qs = StyleSheet.create({
  scroll: { paddingBottom: 48 },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 16, paddingBottom: 20,
  },
  logoWrap: { width: 48, height: 48, borderRadius: 12, overflow: 'hidden' },
  logo: { width: 48, height: 48 },
  headerRight: { alignItems: 'flex-end' },
  quoteLabel: { fontSize: 10, letterSpacing: 1.4, marginBottom: 3 },
  quoteRef: { fontSize: 18, letterSpacing: -0.3 },
  body: { paddingHorizontal: 22 },
  serviceBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, padding: 14,
  },
  serviceIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  serviceInfo: { flex: 1 },
  serviceTitle: { fontSize: 16, marginBottom: 4 },
  serviceMeta: { fontSize: 12 },
  divider: { height: 0.5, marginVertical: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  sectionLabel: { fontSize: 10, letterSpacing: 0.8 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 5 },
  lineLabel: { fontSize: 14 },
  lineVal: { fontSize: 14, fontVariant: ['tabular-nums'] as any },
  lineDetail: { fontSize: 12, marginBottom: 4, marginLeft: 0 },
  totalLabel: { fontSize: 15 },
  totalVal: { fontSize: 22, fontVariant: ['tabular-nums'] as any },
  remainVal: { fontSize: 36, fontVariant: ['tabular-nums'] as any, letterSpacing: -1 },
  notes: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
  noQuote: { textAlign: 'center', fontSize: 14, paddingVertical: 24 },
  statusRow: { flexDirection: 'row', marginTop: 14, marginBottom: 4 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  statusText: { fontSize: 13 },
  actions: { gap: 10 },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 55, borderRadius: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
    }),
  },
  btnPrimaryText: { fontSize: 15 },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 55, borderRadius: 12, borderWidth: 1.5,
  },
  btnOutlineText: { fontSize: 15 },
});
