// components/request/stepper/StepValidation.tsx
// Étape 4 — Validation : bannières d'erreur (init paiement, confirmation),
// montant et récapitulatif (sauf déplié : ils vivent dans le volet droit),
// réassurance, CTA de paiement.
import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS, COLORS } from '@/hooks/use-app-theme';
import { feedback } from '@/lib/feedback/feedback';
import { ctaAmount } from '@/lib/request/pricing';
import { PressScale } from '@/components/ui/PressScale';
import { StepCTA } from '@/components/request/StepCTA';
import { AmountBlock, type AmountBlockProps } from './AmountBlock';
import { RecapBlock, type RecapBlockProps } from './RecapBlock';
import type { StepperTheme } from './useStepperTheme';

type Props = {
  theme: StepperTheme;
  /** Déplié : montant et récapitulatif sont rendus dans le volet droit. */
  isSplit: boolean;
  amount: AmountBlockProps;
  recap: RecapBlockProps;
  pricingError: string | null;
  paymentInitLoading: boolean;
  /** « Réessayer » de la bannière d'erreur → relance l'init paiement. */
  onRetryInit: () => void;
  confirmRetryNeeded: boolean;
  loading: boolean;
  onRetryConfirm: () => void;
  isFreeService: boolean;
  isQuoteFlow: boolean;
  confirmedCalloutCents: number | null;
  calloutFee: number;
  discountedCentsFixed: number;
  paymentReady: boolean;
  onPay: () => void;
};

export function StepValidation({
  theme, isSplit, amount, recap, pricingError, paymentInitLoading, onRetryInit, confirmRetryNeeded,
  loading, onRetryConfirm, isFreeService, isQuoteFlow, confirmedCalloutCents, calloutFee,
  discountedCentsFixed, paymentReady, onPay,
}: Props) {
  const { t } = useTranslation();
  return (
    <View style={s.flex}>
      {/* Fond premium */}
      <LinearGradient
        colors={theme.isDark
          ? [theme.bg, theme.card, theme.surface]
          : [theme.bg, theme.surface, theme.surfaceBorder]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />
      {/* Formes décoratives */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)' }} />
        <View style={{ position: 'absolute', bottom: 40, left: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.012)' }} />
        <View style={{ position: 'absolute', top: '45%', right: 20, width: 50, height: 50, borderRadius: 8, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.018)', transform: [{ rotate: '45deg' }] }} />
      </View>

      <ScrollView
        style={s.flex}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Erreur pricing / init paiement → bannière + Réessayer ── */}
        {pricingError && !paymentInitLoading && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            padding: 14, borderRadius: 14, borderWidth: 1,
            backgroundColor: 'rgba(232,120,58,0.12)', borderColor: 'rgba(232,120,58,0.35)',
          }}>
            <Feather name="alert-triangle" size={16} color={COLORS.orangeBrand} />
            <Text style={{ flex: 1, fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18, color: COLORS.orangeBrand }}>
              {t('stepper.payment_prepare_error')}
            </Text>
            <PressScale
              onPress={() => { feedback.haptic('light'); onRetryInit(); }}
              style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.accent as string }}
              accessibilityRole="button"
            >
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12.5, color: theme.accentText as string }}>{t('common.retry')}</Text>
            </PressScale>
          </View>
        )}

        {/* ── Paiement débité mais confirmation en échec → relance manuelle ── */}
        {confirmRetryNeeded && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            padding: 14, borderRadius: 14, borderWidth: 1,
            backgroundColor: 'rgba(232,120,58,0.12)', borderColor: 'rgba(232,120,58,0.35)',
          }}>
            <Feather name="alert-triangle" size={16} color={COLORS.orangeBrand} />
            <Text style={{ flex: 1, fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18, color: COLORS.orangeBrand }}>
              {t('stepper.payment_confirm_failed_banner')}
            </Text>
            <PressScale
              onPress={onRetryConfirm}
              disabled={loading}
              style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.accent as string, opacity: loading ? 0.6 : 1 }}
              accessibilityRole="button"
            >
              {loading
                ? <ActivityIndicator size="small" color={theme.accentText as string} />
                : <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12.5, color: theme.accentText as string }}>{t('common.retry')}</Text>}
            </PressScale>
          </View>
        )}

        {/* ── MONTANT (carte noire premium · Direction B) ── */}
        {isSplit ? null : <AmountBlock {...amount} />}

        {/* ── RÉCAPITULATIF (tuiles-icônes · Direction B) ── */}
        {isSplit ? null : <RecapBlock {...recap} />}

        {/* ── Réassurance ── */}
        {!isFreeService && (
          <View style={s.v4SecureRow}>
            <Feather name="lock" size={13} color={theme.textMuted as string} />
            <Text style={[s.v4Secure, { color: theme.textMuted }]}>{t('stepper.charge_after_validation')}</Text>
          </View>
        )}

      </ScrollView>

      {/* Footer CTA — libellé à gauche, montant à droite (planche 4A) */}
      <StepCTA
        testID="stepper-pay"
        emphasis
        label={isFreeService ? t('stepper.confirm_free') : isQuoteFlow ? t('stepper.reserve') : t('stepper.confirm_mission')}
        amount={ctaAmount({ isFreeService, isQuoteFlow, confirmedCalloutCents, calloutFee, discountedCents: discountedCentsFixed })}
        onPress={onPay}
        disabled={loading || !paymentReady || !!pricingError || confirmRetryNeeded}
        loading={loading}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  v4SecureRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingBottom: 8 },
  v4Secure:     { textAlign: 'center', fontSize: 12, fontFamily: FONTS.sans },
});
