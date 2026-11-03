// components/request/stepper/PreferredBanner.tsx
// Préférence prestataire (CTA "Demander X" depuis fiche) : bannière sous
// l'en-tête, avec un X pour retirer la préférence en cours de stepper.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS } from '@/hooks/use-app-theme';
import { PressScale } from '@/components/ui/PressScale';
import type { StepperTheme } from './useStepperTheme';

export function PreferredBanner({ theme, name, onRemove }: { theme: StepperTheme; name: string; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={[s.preferredBanner, { backgroundColor: theme.surface, borderColor: theme.sep }]}>
      <Feather name="user-check" size={14} color={theme.text as string} />
      <Text style={[s.preferredBannerText, { color: theme.text, fontFamily: FONTS.sans }]}>
        {t('stepper.request_priority_prefix')}<Text style={{ fontFamily: FONTS.sansMedium }}>{name}</Text>
      </Text>
      <PressScale
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t('stepper.remove_preference_a11y')}
      >
        <Feather name="x" size={16} color={theme.textMuted as string} />
      </PressScale>
    </View>
  );
}

const s = StyleSheet.create({
  preferredBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 4, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
  },
  preferredBannerText: { flex: 1, fontSize: 12 },
});
