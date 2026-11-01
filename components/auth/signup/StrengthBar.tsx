// components/auth/signup/StrengthBar.tsx — force du mot de passe
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { FONTS, COLORS, useAppTheme, alpha } from "@/hooks/use-app-theme";
import { passwordScore } from "@/lib/auth/signupForm";

// Couleurs sémantiques conservées (rouge/ambre/vert) ; rails neutres dérivés du thème.
export function StrengthBar({ password }: { password: string }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const score = passwordScore(password);
  const barColors = [COLORS.red, COLORS.amber, COLORS.amber, COLORS.greenBrand];
  const labels = [t('auth.su_strength_1'), t('auth.su_strength_2'), t('auth.su_strength_3'), t('auth.su_strength_4')];
  return (
    <View style={str.wrap}>
      <View style={str.barRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              str.segment,
              { backgroundColor: i < score ? barColors[score - 1] : alpha(theme.text, 0.11) },
            ]}
          />
        ))}
      </View>
      <Text
        style={[
          str.label,
          { color: score > 0 ? barColors[score - 1] : alpha(theme.text, theme.isDark ? 0.3 : 0.45) },
        ]}
        maxFontSizeMultiplier={1.2}
      >
        {score > 0 ? labels[score - 1] : ""}
      </Text>
    </View>
  );
}
const str = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: -2, marginBottom: 4 },
  barRow: { flex: 1, flexDirection: "row", gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  label: { fontFamily: FONTS.sansMedium, fontSize: 11, minWidth: 40, flexShrink: 1 },
});
