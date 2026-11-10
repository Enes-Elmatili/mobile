// components/settings/SettingsHeader.tsx — l'en-tête des écrans de réglages :
// un retour rond et un titre Bebas.
//
// Téléphone : titre centré entre le retour et une cale de même largeur, comme
// avant. Duo déplié : l'en-tête vit en haut de la page gauche — titre calé
// contre le retour ; centré sur toute la scène, il tombait sur la charnière.
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { useSplitPane } from '@/lib/layout';
import { goBack } from '@/lib/nav/back';
import { PressScale } from '@/components/ui/PressScale';

export function SettingsHeader({ title, fit = false, fallback = '/(tabs)/profile', style }: {
  title: string;
  /** Titre long : une ligne, tronqué plutôt que de pousser le retour (entreprise). */
  fit?: boolean;
  /** Où retomber quand il n'y a rien derrière (lien profond). */
  fallback?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const isSplit = useSplitPane();
  const oneLine = fit || isSplit;
  return (
    <View style={[s.head, fit && s.headFit, style, isSplit && s.headSplit]}>
      <PressScale onPress={() => goBack(router, fallback)} style={[s.back, { backgroundColor: theme.cardBg, borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
        <Feather name="arrow-left" size={18} color={theme.text as string} />
      </PressScale>
      <Text style={[s.title, oneLine && s.titleFit, { color: theme.text }]} numberOfLines={oneLine ? 1 : undefined} maxFontSizeMultiplier={1.2} accessibilityRole="header">{title.toUpperCase()}</Text>
      {isSplit ? null : <View style={s.spacer} />}
    </View>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headFit: { gap: 12 },
  // Page gauche : marge haute de page (12), titre contre le retour.
  headSplit: { justifyContent: 'flex-start', gap: 12, paddingTop: 12 },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 0.5, includeFontPadding: false },
  titleFit: { flexShrink: 1 },
  spacer: { width: 40 },
});
