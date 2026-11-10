// components/settings/legal.tsx — ce que partagent les textes légaux (CGU,
// confidentialité) : l'en-tête en bandeau et, sur le Duo déplié, le sommaire
// de la page gauche qui fait défiler le texte de la page droite.
import React, { useCallback, useRef } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { useSplitPane } from '@/lib/layout';
import { useReduceMotion } from '@/lib/motion/sheet';
import { goBack } from '@/lib/nav/back';
import { PressScale } from '@/components/ui/PressScale';

/** Bandeau retour + titre. Téléphone : titre centré, inchangé. Duo déplié : titre contre le retour (centré, il tombait sur la charnière). */
export function LegalHeader({ title }: { title: string }) {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const isSplit = useSplitPane();
  return (
    <View style={[s.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }, isSplit && s.headerSplit]}>
      <PressScale style={[s.backBtn, { backgroundColor: theme.surface }]} onPress={() => { goBack(router, '/(tabs)/dashboard'); }} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
        <Feather name="arrow-left" size={20} color={theme.textAlt} />
      </PressScale>
      <Text style={[s.headerTitle, isSplit && s.headerTitleSplit, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]} numberOfLines={isSplit ? 1 : undefined}>{title}</Text>
      {isSplit ? null : <View style={{ width: 38 }} />}
    </View>
  );
}

/**
 * Ancres d'une page de lecture : chaque bloc note sa position dans le
 * ScrollView (enfant direct du contenu), le sommaire y fait défiler. Le ref
 * du ScrollView reste chez l'écran (passé tel quel en prop `ref`).
 */
export function useAnchors(scroll: React.RefObject<ScrollViewInstance | null>) {
  const ys = useRef<Record<string, number>>({});
  const reduced = useReduceMotion();
  const register = useCallback((key: string) => (e: LayoutChangeEvent) => { ys.current[key] = e.nativeEvent.layout.y; }, []);
  const scrollTo = useCallback((key: string) => {
    const y = ys.current[key];
    if (y == null) return;
    // Sous « Réduire les animations » : on saute, sans glisser.
    scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: !reduced });
  }, [scroll, reduced]);
  return { register, scrollTo };
}

export type LegalIndexItem = { key: string; kicker?: string; title: string };

/** Sommaire (page gauche) : une ligne par article, un appui amène l'article en haut de la page droite. */
export function LegalIndex({ items, onSelect }: { items: LegalIndexItem[]; onSelect: (key: string) => void }) {
  const theme = useAppTheme();
  return (
    <View style={[s.index, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
      {items.map((it, i) => (
        <PressScale
          key={it.key}
          onPress={() => onSelect(it.key)}
          style={[s.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.borderLight }]}
          accessibilityRole="button"
          accessibilityLabel={it.kicker ? `${it.kicker} ${it.title}` : it.title}
        >
          {it.kicker ? <Text style={[s.kicker, { color: theme.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{it.kicker.toUpperCase()}</Text> : null}
          <Text style={[s.title, { color: theme.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{it.title}</Text>
          <Feather name="chevron-right" size={14} color={theme.textMuted} />
        </PressScale>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  // Page gauche : marges de page (20), titre contre le retour.
  headerSplit: { justifyContent: 'flex-start', gap: 12, paddingHorizontal: 20 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17 },
  headerTitleSplit: { flexShrink: 1 },

  index: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  kicker: { width: 52, fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.5 },
  title: { flex: 1, fontFamily: FONTS.sansMedium, fontSize: 13.5, lineHeight: 18 },
});
