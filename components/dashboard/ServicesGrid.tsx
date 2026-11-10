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
import { foldLineFor, useHinge, useSceneFrame, useSplitPane } from '@/lib/layout';

const hapticMedium = () => feedback.haptic('medium');

export function ServicesGrid({ theme }: {
  /** @deprecated La grille lit sa page (scène, pli) : la fenêtre n'est plus utilisée. */
  windowWidth?: number;
  theme: AppTheme;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  // Largeur réelle de la grille (une page du Duo déplié n'est pas la fenêtre).
  // Avant la première mesure, l'estimation est la page qui la porte : la scène
  // (la fenêtre faisait 951 pt au lieu de ~455 → cartes géantes une frame),
  // ou, déplié, la page gauche de l'accueil (SplitPane : au pli, sinon la moitié).
  const scene = useSceneFrame();
  const isSplit = useSplitPane();
  const hinge = useHinge();
  const fold = foldLineFor(hinge, scene);
  const estimate = !isSplit ? scene.width : fold ? fold.start : scene.width / 2;
  const [measured, setMeasured] = useState(0);
  const gridWidth = measured || estimate;
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
            // Arrondi vers le bas : deux cartes qui remplissent EXACTEMENT une page
            // fractionnaire (455,5 pt sur le Duo) passaient à la ligne pour un
            // reste d'arrondi — une colonne de cartes au lieu de deux.
            style={{ width: Math.floor((gridWidth - 42) / 2) }}
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
