// components/dashboard/ServicesGrid.tsx — les services disponibles (grille
// 2 colonnes) : un tap ouvre la commande, catégorie déjà choisie.
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { feedback } from '@/lib/feedback/feedback';
import { FONTS } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/hooks/use-app-theme';
import FixedCard from '@/components/ui/Card';
import FixedSectionHeader from '@/components/ui/SectionHeader';
import { PressScale } from '@/components/ui/PressScale';
import { LAUNCH_CARDS } from '@/lib/dashboard/services';

const hapticMedium = () => feedback.haptic('medium');

export function ServicesGrid({ windowWidth, theme }: { windowWidth: number; theme: AppTheme }) {
  const { t } = useTranslation();
  const router = useRouter();
  // Largeur réelle de la grille (une page du Duo déplié n'est pas la fenêtre) ;
  // la fenêtre sert d'estimation jusqu'à la première mesure.
  const [measured, setMeasured] = useState(0);
  const gridWidth = measured || windowWidth;
  return (
    <>
      <View style={{ marginTop: 26 }}>
        <FixedSectionHeader label={t('dashboard.services_available').toUpperCase()} />
      </View>
      <View onLayout={(e) => setMeasured(e.nativeEvent.layout.width)} style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {LAUNCH_CARDS.map((card) => (
          <PressScale accessibilityRole="button"
            key={card.key}
            onPress={() => {
              hapticMedium();
              router.push(`/request/NewRequestStepper?selectedCategory=${card.category}`);
            }}
            style={{ width: (gridWidth - 42) / 2 }}
          >
            <FixedCard pad={14}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Feather name={card.icon} size={18} color={theme.text} />
              </View>
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: theme.text }}>{t(`category.${card.key}`, { defaultValue: card.key })}</Text>
            </FixedCard>
          </PressScale>
        ))}
      </View>
    </>
  );
}
