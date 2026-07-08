// components/auth/AuthStepper.tsx
// Indicateur d'étapes du flux onboarding v2 — segments horizontaux centrés.
// Actif = theme.brandDot (fill de marque), inactif = trace neutre.
import React from "react";
import { View, StyleSheet } from "react-native";
import { useAppTheme, alpha } from "@/hooks/use-app-theme";

type Props = {
  /** Nombre total d'étapes. */
  total: number;
  /** Étape courante (1-based) — les segments < current+1 sont actifs. */
  current: number;
  /** Libellé lecteur d'écran (déjà localisé), ex. t('ext.role_step'). */
  accessibilityLabel?: string;
};

export function AuthStepper({ total, current, accessibilityLabel }: Props) {
  const theme = useAppTheme();
  return (
    <View
      style={s.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            s.segment,
            { backgroundColor: i < current ? theme.brandDot : alpha(theme.text, 0.15) },
          ]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  segment: {
    width: 24,
    height: 2,
    borderRadius: 1,
  },
});
