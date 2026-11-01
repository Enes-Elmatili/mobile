/**
 * AuthLink — secondary text link (e.g. "Déjà membre ? Se connecter").
 *
 * Sits in the LIGHT zone (bottom). Muted leading text + emphasized
 * actionable suffix. Variant `onDark` for use in the dark zone.
 */
import React from "react";
import { Text, StyleSheet } from "react-native";
import { FONTS, useAppTheme } from "@/hooks/use-app-theme";
import { authT, alpha } from "./tokens";
import { PressScale } from '@/components/ui/PressScale';

type Props = {
  prefix?: string;
  action: string;
  onPress: () => void;
  /** Use light text colors when rendered on a dark background. */
  onDark?: boolean;
  /**
   * Theme-aware colors (flat v2 screens): prefix muted from theme.text,
   * action = theme.text. Takes precedence over `onDark`. Defaults to false —
   * strictly unchanged behavior for the existing gradient screens.
   */
  themed?: boolean;
  /** Repère des tests de bout en bout (Maestro, `.maestro/`). */
  testID?: string;
};

export function AuthLink({ prefix, action, onPress, onDark, themed = false, testID }: Props) {
  const theme = useAppTheme();
  const base = onDark ? authT.textOnDark : authT.textOnLight;
  const prefixColor = themed
    ? alpha(theme.text, theme.isDark ? 0.5 : 0.6)
    : alpha(base, 0.55);
  const actionColor = themed ? theme.text : base;
  return (
    <PressScale
      testID={testID}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={prefix ? `${prefix} ${action}` : action}
      style={s.wrap}
    >
      <Text style={[s.text, { color: prefixColor }]} maxFontSizeMultiplier={1.3}>
        {prefix ? `${prefix} ` : ""}
        <Text style={[s.strong, { color: actionColor }]}>{action}</Text>
      </Text>
    </PressScale>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 18,
  },
  text: {
    fontFamily: FONTS.sans,
    fontSize: 13,
  },
  strong: {
    fontFamily: FONTS.sansMedium,
  },
});
