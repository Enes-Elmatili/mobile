// components/request/stepper/AmountBlock.tsx
// Montant de l'étape 4 (carte noire premium · Direction B) : service gratuit,
// callout du devis ou total prix fixe (remise promo comprise). Rendu à
// l'étape 4 sur compact, dans le volet droit une fois déplié.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS, COLORS } from '@/hooks/use-app-theme';
import { formatEURCents } from '@/lib/format';
import { calloutEuros, htEuros, stripEuro } from '@/lib/request/pricing';
import type { AppliedPromo, PriceDetails, StepperSubcategory } from '@/lib/request/stepperTypes';
import { PressScale } from '@/components/ui/PressScale';
import { AmountCardB } from './AmountCardB';
import type { StepperTheme } from './useStepperTheme';

export type AmountBlockProps = {
  theme: StepperTheme;
  isFreeService: boolean;
  isQuoteFlow: boolean;
  paymentInitLoading: boolean;
  confirmedCalloutCents: number | null;
  calloutFee: number;
  subcategory: StepperSubcategory | null;
  onOpenDevis: () => void;
  appliedPromo: AppliedPromo | null;
  displayPrice: PriceDetails;
  discountedCentsFixed: number;
  nominalCentsFixed: number;
};

export function AmountBlock({
  theme, isFreeService, isQuoteFlow, paymentInitLoading, confirmedCalloutCents, calloutFee,
  subcategory, onOpenDevis, appliedPromo, displayPrice, discountedCentsFixed, nominalCentsFixed,
}: AmountBlockProps) {
  const { t } = useTranslation();
  return (
    isFreeService ? (
      <View style={[s.v4QuoteInfo, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
        <Feather name="gift" size={18} color={theme.text as string} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[s.v4QuoteInfoTitle, { color: theme.text }]}>{t('stepper.free_service')}</Text>
          <Text style={[s.v4QuoteInfoDesc, { color: theme.textSub }]}>{t('stepper.no_payment_required')}</Text>
        </View>
      </View>
    ) : isQuoteFlow ? (
      <View style={{ gap: 12 }}>
        <AmountCardB
          theme={theme}
          loading={paymentInitLoading}
          label={t('stepper.pay_now')}
          euros={calloutEuros(confirmedCalloutCents, calloutFee)}
          footerLeft={(
            <>
              <Feather name="check" size={13} color={COLORS.green} />
              <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: theme.heroSub as string }} numberOfLines={1}>
                {t('stepper.deducted_if_accepted')}
              </Text>
            </>
          )}
          footerRight={subcategory?.priceMin && subcategory?.priceMax ? (
            <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: theme.heroSubFaint as string }}>
              {subcategory.priceMin}–{subcategory.priceMax} €
            </Text>
          ) : null}
        />
        <PressScale accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.surfaceBorder as string, backgroundColor: theme.v4CardBg as string }}
          onPress={onOpenDevis}
        >
          <Feather name="file-text" size={14} color={COLORS.amber} />
          <Text style={{ fontSize: 13, fontFamily: FONTS.sansMedium, color: theme.text as string }}>{t('stepper.how_quote_works')}</Text>
          <Feather name="chevron-right" size={13} color={theme.textMuted as string} />
        </PressScale>
      </View>
    ) : (
      <AmountCardB
        theme={theme}
        loading={paymentInitLoading}
        label={t('stepper.total_to_pay')}
        euros={appliedPromo ? stripEuro(formatEURCents(discountedCentsFixed)) : displayPrice.totalTVAC}
        original={appliedPromo ? stripEuro(formatEURCents(nominalCentsFixed)) : undefined}
        savings={appliedPromo ? `−${stripEuro(formatEURCents(appliedPromo.discountCents))} €` : undefined}
        footerLeft={(
          <>
            <Feather name="shield" size={13} color={theme.heroSubFaint as string} />
            <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: theme.heroSub as string }} numberOfLines={1}>
              {displayPrice.vatRate
                ? t('stepper.incl_vat', { pct: Math.round(Number(displayPrice.vatRate) * 100), amount: displayPrice.vat })
                : t('stepper.total_ttc')}
            </Text>
          </>
        )}
        footerRight={displayPrice.vatRate ? (
          <Text style={{ fontFamily: FONTS.mono, fontSize: 12.5, color: theme.heroSubFaint as string }}>
            {t('stepper.excl_vat_label')} {htEuros(displayPrice)}
          </Text>
        ) : null}
      />
    )
  );
}

const s = StyleSheet.create({
  v4QuoteInfo:  { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  v4QuoteInfoTitle: { fontSize: 14, fontFamily: FONTS.sansMedium },
  v4QuoteInfoDesc:  { fontSize: 13, fontFamily: FONTS.sans, lineHeight: 19 },
});
