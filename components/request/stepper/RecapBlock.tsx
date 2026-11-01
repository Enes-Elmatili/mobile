// components/request/stepper/RecapBlock.tsx
// Récapitulatif de l'étape 4 (tuiles-icônes · Direction B) : adresse,
// prestation, créneau, code promo (mode fixe). Rendu à l'étape 4 sur compact,
// dans le volet droit pendant tout le tunnel une fois déplié.
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS } from '@/hooks/use-app-theme';
import { feedback } from '@/lib/feedback/feedback';
import { formatEURCents } from '@/lib/format';
import { toIoniconName } from '@/lib/iconMapper';
import { toFeatherName } from '@/lib/request/catalog';
import { stripEuro } from '@/lib/request/pricing';
import type { AppliedPromo, StepperLocation } from '@/lib/request/stepperTypes';
import { PressScale } from '@/components/ui/PressScale';
import { RecapTile } from './RecapTile';
import type { StepperTheme } from './useStepperTheme';

// Le pont Ionicons→Feather (toFeatherName) renvoie un nom libre : cast vers le glyphe Feather.
type FeatherName = React.ComponentProps<typeof Feather>['name'];

export type RecapBlockProps = {
  theme: StepperTheme;
  location: StepperLocation | null;
  categoryIcon: string | null | undefined;
  serviceName: string | null;
  scheduledLabel: string | null;
  isUrgent: boolean;
  isFreeService: boolean;
  isQuoteFlow: boolean;
  appliedPromo: AppliedPromo | null;
  promoApplying: boolean;
  onRemovePromo: () => void;
  onOpenPromo: () => void;
};

export function RecapBlock({
  theme, location, categoryIcon, serviceName, scheduledLabel, isUrgent, isFreeService,
  isQuoteFlow, appliedPromo, promoApplying, onRemovePromo, onOpenPromo,
}: RecapBlockProps) {
  const { t } = useTranslation();
  return (
    <View>
      <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 22, letterSpacing: 2, color: theme.text as string, marginBottom: 10 }}>{t('stepper.recap_title')}</Text>
      <View style={[s.v4Card, { backgroundColor: theme.v4CardBg, marginHorizontal: 0 }]}>
        <RecapTile
          theme={theme}
          icon="map-pin"
          title={location?.address?.split(',')[0] || '—'}
          sub={location?.address?.split(',').slice(1).join(',').trim()}
        />
        <View style={[s.v4Sep, { backgroundColor: theme.v4Sep }]} />
        <RecapTile
          theme={theme}
          icon={toFeatherName(toIoniconName(categoryIcon, 'construct-outline'), 'tool') as FeatherName}
          title={serviceName || '—'}
        />
        <View style={[s.v4Sep, { backgroundColor: theme.v4Sep }]} />
        <RecapTile
          theme={theme}
          icon="clock"
          title={scheduledLabel || t('stepper.now')}
          right={isUrgent ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: theme.accent }}>
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5, color: theme.accentText as string }}>{t('provider.urgent')}</Text>
            </View>
          ) : undefined}
        />
        {/* ── Code promo (mode fixe) ── */}
        {!isFreeService && !isQuoteFlow && (
          <>
            <View style={[s.v4Sep, { backgroundColor: theme.v4Sep }]} />
            {appliedPromo ? (
              <RecapTile
                theme={theme}
                icon="tag"
                title={appliedPromo.code}
                sub={`${t('stepper.promo_applied') || 'Offre appliquée'} · −${stripEuro(formatEURCents(appliedPromo.discountCents))} €`}
                right={(
                  <PressScale
                    onPress={onRemovePromo}
                    disabled={promoApplying}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('stepper.remove_promo_a11y')}
                  >
                    {promoApplying
                      ? <ActivityIndicator size="small" color={theme.textMuted as string} />
                      : <Feather name="x" size={18} color={theme.textMuted as string} />}
                  </PressScale>
                )}
              />
            ) : (
              <RecapTile
                theme={theme}
                icon="tag"
                title={t('stepper.promo_add') || 'Ajouter un code promo'}
                onPress={() => { feedback.haptic('light'); onOpenPromo(); }}
                right={<Feather name="chevron-right" size={16} color={theme.textMuted as string} />}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  v4Card:       { borderRadius: 18, overflow: 'hidden', marginBottom: 12, marginHorizontal: 16 },
  v4Sep:        { height: 1, marginHorizontal: 16 },
});
