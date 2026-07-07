// components/auth/AuthMasthead.tsx
// Masthead éditorial du flux onboarding : wordmark FIXED. (point vert charte)
// à gauche, méta mono optionnelle à droite (ex. "BE · IXELLES", "01 / 02").
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme, FONTS, COLORS, alpha } from "@/hooks/use-app-theme";

type Props = {
  /** Méta mono affichée à droite (déjà localisée si besoin). */
  meta?: string;
};

export function AuthMasthead({ meta }: Props) {
  const theme = useAppTheme();
  const dot = theme.isDark ? "#2BD183" : COLORS.greenBrand;
  return (
    <View style={s.row}>
      <Text style={[s.wordmark, { color: theme.text }]}>
        FIXED<Text style={{ color: dot }}>.</Text>
      </Text>
      {!!meta && (
        <Text style={[s.meta, { color: alpha(theme.text, 0.3) }]}>
          {meta.toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingTop: 18,
  },
  wordmark: {
    fontFamily: FONTS.bebas,
    fontSize: 21,
    letterSpacing: 5,
  },
  meta: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.5,
  },
});
