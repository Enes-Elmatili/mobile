// components/auth/AuthMasthead.tsx
// Masthead éditorial du flux onboarding : wordmark FIXED. (point vert charte)
// à gauche, méta mono optionnelle à droite (ex. "BE · IXELLES", "01 / 02").
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useAppTheme, FONTS, alpha } from "@/hooks/use-app-theme";

type Props = {
  /** Méta mono affichée à droite (déjà localisée si besoin). */
  meta?: string;
};

export function AuthMasthead({ meta }: Props) {
  const theme = useAppTheme();
  return (
    <View style={s.row}>
      <Image
        source={
          theme.isDark
            ? require("@/assets/logo-variants/logo-transparent-white.png")
            : require("@/assets/logo-variants/logo-transparent-black.png")
        }
        style={s.logo}
        resizeMode="contain"
        accessibilityLabel="FIXED"
      />
      {!!meta && (
        <Text style={[s.meta, { color: alpha(theme.text, 0.3) }]} maxFontSizeMultiplier={1.3}>
          {meta.toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 18,
  },
  logo: {
    height: 22,
    width: 81,
  },
  meta: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.5,
  },
});
