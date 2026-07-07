// components/auth/AuthEyebrow.tsx
// Eyebrow mono uppercase précédé d'un tiret vert — signature v2 de l'onboarding.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme, FONTS, COLORS, alpha } from "@/hooks/use-app-theme";

type Props = {
  label: string;
};

export function AuthEyebrow({ label }: Props) {
  const theme = useAppTheme();
  const dot = theme.isDark ? "#2BD183" : COLORS.greenBrand;
  return (
    <View style={s.row}>
      <View style={[s.dash, { backgroundColor: dot }]} />
      <Text style={[s.label, { color: alpha(theme.text, 0.55) }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 16,
  },
  dash: {
    width: 20,
    height: 1,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 2.4,
  },
});
