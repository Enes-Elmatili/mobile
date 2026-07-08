/**
 * AuthHeadline — Bebas display headline for auth pages.
 *
 * Default (non-themed) mode — gradient screens, strictly unchanged:
 * sits on the DARK zone (top of inverted gradient) — uses textOnDark color.
 * Supports an optional kicker (uppercase mono eyebrow) and accent outline word
 * inside the title via the {accent} marker.
 *
 * Themed mode (`themed`) — flat v2 editorial screens:
 * left-aligned Bebas title in theme.text with the {accent} markers stripped,
 * plus the signature green dot (theme.brandDot) appended ONLY when the title
 * doesn't already end with terminal punctuation (`?`, `!` or `.` — AMENDEMENT 4).
 * `kicker` is deprecated/ignored in this mode: screens compose <AuthEyebrow />
 * separately. Subtitle: DM Sans 13.5/20, alpha(theme.text, 0.56), maxWidth 240.
 *
 * Examples:
 *   <AuthHeadline title="CONNEXION" subtitle="Heureux de vous revoir." />
 *   <AuthHeadline kicker="ÉTAPE 1 / 3" title="QUI ÊTES{accent}-VOUS{/accent} ?" subtitle="..." />
 *   <AuthHeadline themed title="CONNEXION" subtitle="Heureux de vous revoir." />
 */
import React from "react";
import { Text, StyleSheet, View } from "react-native";
import { FONTS, useAppTheme } from "@/hooks/use-app-theme";
import { authT, alpha } from "./tokens";

type Props = {
  title: string;
  subtitle?: string;
  /** Ignored (deprecated) when `themed` — use <AuthEyebrow /> instead. */
  kicker?: string;
  align?: "left" | "center";
  /**
   * Render the flat v2 editorial headline (theme-aware, left-aligned, green
   * terminal dot). Defaults to false — strictly unchanged behavior for the
   * existing gradient screens.
   */
  themed?: boolean;
};

/** Strips the {accent}/{/accent} markers from a title (v2 drops the outline effect). */
export function stripAccent(s: string): string {
  return s.replace(/\{\/?accent\}/g, "");
}

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

// Warn once (dev only) when a themed headline still receives a kicker.
let warnedThemedKicker = false;

export function AuthHeadline({ title, subtitle, kicker, align = "center", themed = false }: Props) {
  const theme = useAppTheme();

  if (themed) {
    if (__DEV__ && kicker && !warnedThemedKicker) {
      warnedThemedKicker = true;
      console.warn(
        "AuthHeadline: `kicker` est ignoré en mode `themed` — composer <AuthEyebrow /> séparément."
      );
    }
    // Trim de fin : un espace/saut de ligne résiduel après strip des marqueurs
    // décalerait le point vert — on rend la version trimmée.
    const clean = stripAccent(title).trimEnd();
    // AMENDEMENT 4 : point vert terminal SEULEMENT si le titre stripé ne se
    // termine pas déjà par une ponctuation finale (?, ! ou . — « … » inclus :
    // ellipse terminale, ex. rp_validating_title, sinon on rendrait « …. »).
    const needsDot = !/[?!.…]$/.test(clean);

    return (
      <View style={s.wrap}>
        <Text style={[s.titleV2, { color: theme.text }]} maxFontSizeMultiplier={1.2}>
          {clean}
          {needsDot && <Text style={{ color: theme.brandDot }}>.</Text>}
        </Text>
        {subtitle && (
          <Text
            style={[s.subtitleV2, { color: alpha(theme.text, 0.56) }]}
            maxFontSizeMultiplier={1.2}
          >
            {subtitle}
          </Text>
        )}
      </View>
    );
  }

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

  // ── v2 éditorial (themed) ─────────────────────────────────────────────────
  titleV2: {
    fontFamily: FONTS.bebas,
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: 0.6,
    textAlign: "left",
  },
  subtitleV2: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 12,
    maxWidth: 240,
    textAlign: "left",
  },
});
