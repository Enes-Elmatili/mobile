/**
 * AuthHeadline — Bebas display headline for auth pages.
 *
 * Sits on the DARK zone (top of inverted gradient) — uses textOnDark color.
 * Supports an optional kicker (uppercase mono eyebrow) and accent outline word
 * inside the title via the {accent} marker.
 *
 * Examples:
 *   <AuthHeadline title="CONNEXION" subtitle="Heureux de vous revoir." />
 *   <AuthHeadline kicker="ÉTAPE 1 / 3" title="QUI ÊTES{accent}-VOUS{/accent} ?" subtitle="..." />
 */
import React from "react";
import { Text, StyleSheet, View } from "react-native";
import { FONTS } from "@/hooks/use-app-theme";
import { authT, alpha } from "./tokens";

type Props = {
  title: string;
  subtitle?: string;
  kicker?: string;
  align?: "left" | "center";
};

// Splits title on the {accent}...{/accent} markers so we can render the inner
// portion in muted color (the "outline" effect from welcome).
function renderTitle(raw: string) {
  const parts: { text: string; accent: boolean }[] = [];
  const re = /\{accent\}(.*?)\{\/accent\}/g;
  let lastIdx = 0;
  let match;
  while ((match = re.exec(raw)) !== null) {
    if (match.index > lastIdx) parts.push({ text: raw.slice(lastIdx, match.index), accent: false });
    parts.push({ text: match[1], accent: true });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < raw.length) parts.push({ text: raw.slice(lastIdx), accent: false });
  return parts;
}

export function AuthHeadline({ title, subtitle, kicker, align = "center" }: Props) {
  const parts = renderTitle(title);
  const textAlign = align;

  return (
    <View style={[s.wrap, align === "center" && s.center]}>
      {kicker && <Text style={[s.kicker, { textAlign }]}>{kicker}</Text>}
      <Text style={[s.title, { textAlign }]}>
        {parts.map((p, i) =>
          p.accent ? (
            <Text key={i} style={s.titleAccent}>
              {p.text}
            </Text>
          ) : (
            <Text key={i}>{p.text}</Text>
          )
        )}
      </Text>
      {subtitle && <Text style={[s.subtitle, { textAlign }]}>{subtitle}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {},
  center: {
    alignItems: "center",
  },
  kicker: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: alpha(authT.textOnDark, 0.5),
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.bebas,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: 0.5,
    color: authT.textOnDark,
  },
  titleAccent: {
    color: alpha(authT.textOnDark, 0.4),
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 20,
    color: alpha(authT.textOnDark, 0.6),
    marginTop: 10,
    maxWidth: 320,
  },
});
