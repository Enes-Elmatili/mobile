// components/nav/GlassSurface.tsx — la matière de la barre flottante et du disque.
//
// iOS 26 : le vrai Liquid Glass (expo-glass-effect), qui réfracte ce qui
// passe dessous. iOS antérieur : un verre dépoli (BlurView). Android : un
// fond quasi opaque teinté (expo-blur n'y floute pas vraiment).
// Le composant porte la matière et son ombre courte (le Liquid Glass a son
// propre relief : pas d'ombre ajoutée) ; la forme (rayon) vient du style.
import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useAppTheme, alpha } from '@/hooks/use-app-theme';

const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable();

export function GlassSurface({ style, interactive = false }: { style?: StyleProp<ViewStyle>; interactive?: boolean }) {
  const theme = useAppTheme();
  if (LIQUID) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive={interactive}
        colorScheme={theme.isDark ? 'dark' : 'light'}
        style={[StyleSheet.absoluteFill, style]}
        pointerEvents="none"
      />
    );
  }
  if (Platform.OS === 'ios') {
    // L'ombre exige un fond sur la vue qui la porte ; le flou est découpé dans une vue enfant.
    return (
      <View style={[StyleSheet.absoluteFill, s.shadow, style, { backgroundColor: alpha(theme.bg, 0.35) }]} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, s.clip, style, { borderColor: alpha(theme.text, 0.14) }]}>
          <BlurView intensity={60} tint={theme.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        </View>
      </View>
    );
  }
  return <View style={[StyleSheet.absoluteFill, s.clip, s.shadow, style, { backgroundColor: alpha(theme.surface, 0.97), borderColor: alpha(theme.text, 0.12) }]} pointerEvents="none" />;
}

const s = StyleSheet.create({
  clip: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  shadow: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
});
