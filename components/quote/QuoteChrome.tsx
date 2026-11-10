// components/quote/QuoteChrome.tsx — Header partagé (loading / empty / contenu)
// et état vide de la revue de devis.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { type useAnimatedStyle } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, type AppTheme } from "@/hooks/use-app-theme";
import { PressScale } from '@/components/ui/PressScale';

export function QuoteHeader({ theme, onBack, lineStyle, align = "center" }: {
  theme: AppTheme;
  onBack: () => void;
  /** Filet qui apparaît au défilement. */
  lineStyle: ReturnType<typeof useAnimatedStyle>;
  /** `start` : titre aligné à gauche, à côté du retour (page gauche du Duo
   *  déplié — centré, il tombait sur le pli). */
  align?: "center" | "start";
}) {
  const { t } = useTranslation();
  const start = align === "start";
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.bg }}>
      <View style={[s.header, start && s.headerStart]}>
        <PressScale
          style={[s.headerBack, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color={theme.text} />
        </PressScale>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('quote.short_label').toUpperCase()}</Text>
        {start ? null : <View style={{ width: 36 }} />}
      </View>
      <Animated.View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }, lineStyle]} />
    </SafeAreaView>
  );
}

export function QuoteEmpty({ theme, onBack }: { theme: AppTheme; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={[s.center, { flex: 1, paddingHorizontal: 32 }]}>
      <View style={[s.emptyIcon, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
        <Feather name="file-text" size={28} color={theme.textMuted} />
      </View>
      <Text style={[s.emptyText, { color: theme.textSub }]}>{t('quote.empty_no_quote_yet')}</Text>
      <PressScale style={s.emptyBack} onPress={onBack} accessibilityRole="button" hitSlop={8}>
        <Text style={[s.emptyBackText, { color: theme.text }]}>{t('common.back')}</Text>
      </PressScale>
    </View>
  );
}

const s = StyleSheet.create({
  center: { justifyContent: "center", alignItems: "center", gap: 16 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  headerStart: { justifyContent: "flex-start", gap: 14 },
  headerBack: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontFamily: FONTS.bebas, includeFontPadding: false,
    fontSize: 22,
    letterSpacing: 2.5,
  },

  // ── Empty ──
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  emptyText: { fontFamily: FONTS.sans, fontSize: 14, textAlign: "center" },
  emptyBack: { paddingHorizontal: 16, paddingVertical: 8 },
  emptyBackText: { fontFamily: FONTS.sansMedium, fontSize: 13, textDecorationLine: "underline" },
});
