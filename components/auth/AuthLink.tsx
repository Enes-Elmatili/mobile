/**
 * AuthLink — secondary text link (e.g. "Déjà membre ? Se connecter").
 *
 * Sits in the LIGHT zone (bottom). Muted leading text + emphasized
 * actionable suffix. Variant `onDark` for use in the dark zone.
 */
import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { FONTS } from "@/hooks/use-app-theme";
import { authT, alpha } from "./tokens";

type Props = {
  prefix?: string;
  action: string;
  onPress: () => void;
  /** Use light text colors when rendered on a dark background. */
  onDark?: boolean;
};

export function AuthLink({ prefix, action, onPress, onDark }: Props) {
  const base = onDark ? authT.textOnDark : authT.textOnLight;
  return (
    <Pressable onPress={onPress} hitSlop={8} style={s.wrap}>
      <Text style={[s.text, { color: alpha(base, 0.55) }]}>
        {prefix ? `${prefix} ` : ""}
        <Text style={[s.strong, { color: base }]}>{action}</Text>
      </Text>
    </Pressable>
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
