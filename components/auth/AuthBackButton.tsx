/**
 * AuthBackButton — 36×36 rounded back button.
 *
 * Sits in the DARK zone (top of inverted gradient) — uses textOnDark for
 * border/icon contrast. Pass `themed` to opt into theme-aware colors instead
 * (for flat screens where the fixed dark-zone tone would be invisible on a
 * light background) — default behavior for the 6 gradient screens is
 * unchanged.
 */
import React from "react";
import { StyleSheet, ViewStyle, StyleProp } from "react-native";
import { Feather } from "@expo/vector-icons";
import { authT, alpha } from "./tokens";
import { useAppTheme } from "@/hooks/use-app-theme";
import { PressScale } from '@/components/ui/PressScale';

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /**
   * Use theme-aware colors (derived from useAppTheme) instead of the fixed
   * gradient dark-zone tone. Defaults to false — strictly unchanged behavior
   * for existing gradient screens (login, signup, forgot/reset-password).
   */
  themed?: boolean;
};

export function AuthBackButton({ onPress, style, themed = false }: Props) {
  const theme = useAppTheme();
  const base = themed ? theme.text : authT.textOnDark;
  const iconColor = base;
  const borderColor = alpha(base, 0.18);
  const backgroundColor = alpha(base, 0.05);

  return (
    <PressScale
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      style={[
        s.btn,
        { borderColor, backgroundColor },
        style,
      ]}
    >
      <Feather name="chevron-left" size={20} color={iconColor} />
    </PressScale>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
