// components/quote/QuoteHero.tsx — Île héro sombre de la revue de devis :
// LE montant qui décide (Bebas 54, filigrane FIXED, compte à rebours).
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { type useAnimatedStyle } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { FONTS, COLORS, alpha, type AppTheme } from "@/hooks/use-app-theme";
import { formatEURCents as fmtEur } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { MonoLabel, SealCheck } from "./primitives";

type AnimatedStyle = ReturnType<typeof useAnimatedStyle>;

export function QuoteHero({
  theme, heroLabel, hero, accepted, refused, terminal, hasDeposit, totalAmount, calloutPaid,
  badgeLabel, validUntil, urgent, timeLeftLabel, foldStyle, heroBorderStyle,
}: {
  theme: AppTheme;
  heroLabel: string;
  hero: { value: string; cur: string };
  accepted: boolean;
  refused: boolean;
  terminal: boolean;
  hasDeposit: boolean;
  /** Centimes. */
  totalAmount: number;
  /** Centimes. */
  calloutPaid: number;
  badgeLabel: string;
  validUntil: string;
  urgent: boolean;
  timeLeftLabel: string;
  foldStyle: AnimatedStyle;
  heroBorderStyle: AnimatedStyle;
}) {
  const { t } = useTranslation();
  return (
    <Animated.View style={[s.hero, { backgroundColor: theme.heroBg }, foldStyle]}>
      <LinearGradient
        colors={[alpha('#FFFFFF', 0.07), 'transparent', alpha('#000000', 0.22)]}
        locations={[0, 0.5, 1]}
        start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.heroBorder, heroBorderStyle]} />

      <View style={s.heroTop}>
        <MonoLabel color={theme.heroSub} size={11}>{heroLabel}</MonoLabel>
        {accepted ? <SealCheck color={COLORS.green} /> : <Text style={[s.heroWatermark, { color: theme.heroSubFaint }]}>FIXED</Text>}
      </View>

      <View style={s.heroAmountRow}>
        <Text style={[s.heroAmount, { color: theme.heroText }]}>
          {hero.value}
          <Text style={[s.heroCurrency, { color: theme.heroSub }]}> {hero.cur}</Text>
        </Text>
      </View>

      {hasDeposit && !terminal ? (
        <View style={s.heroSubRow}>
          <Text style={[s.heroSubText, { color: theme.heroSubFaint }]}>
            {t('ext.invoice_total')} {fmtEur(totalAmount)}
          </Text>
          <View style={[s.heroPill, { backgroundColor: alpha(COLORS.greenBrand, 0.16), borderColor: alpha(COLORS.greenBrand, 0.4) }]}>
            <Feather name="tag" size={10} color={COLORS.green} />
            <Text style={[s.heroPillText, { color: COLORS.green }]}>− {fmtEur(calloutPaid)}</Text>
          </View>
        </View>
      ) : null}

      <View style={[s.heroFooter, { borderTopColor: alpha('#FFFFFF', 0.12) }]}>
        {terminal ? (
          <View style={s.heroFooterLeft}>
            <Feather
              name={accepted ? "check-circle" : refused ? "slash" : "clock"}
              size={13}
              color={accepted ? COLORS.green : theme.heroSubFaint}
            />
            <Text style={[s.heroFooterText, { color: accepted ? COLORS.green : theme.heroSub }]} numberOfLines={1}>
              {badgeLabel}
            </Text>
          </View>
        ) : (
          <>
            <View style={s.heroFooterLeft}>
              <Feather name="clock" size={13} color={theme.heroSubFaint} />
              <Text style={[s.heroFooterText, { color: theme.heroSub }]} numberOfLines={1}>
                {t('quote.valid_until', {
                  date: new Date(validUntil).toLocaleDateString(undefined, {
                    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                  }),
                })}
              </Text>
            </View>
            <View style={[
              s.countdown,
              { backgroundColor: alpha('#FFFFFF', 0.10) },
              urgent && { backgroundColor: alpha(COLORS.amber, 0.18) },
            ]}>
              <Text style={[s.countdownText, { color: urgent ? COLORS.amber : theme.heroText }]}>
                {timeLeftLabel}
              </Text>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  hero: {
    position: "relative", borderRadius: 26, overflow: "hidden", padding: 22, marginTop: 6,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 18 }, elevation: 10,
  },
  heroBorder: { borderRadius: 26, borderWidth: 1 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroWatermark: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 3 },
  heroAmountRow: { flexDirection: "row", alignItems: "baseline", marginTop: 10, flexWrap: "wrap" },
  heroAmount: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 54, letterSpacing: 0.5, lineHeight: 56 },
  heroCurrency: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 26 },
  heroSubRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  heroSubText: { fontFamily: FONTS.mono, fontSize: 12 },
  heroPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
  },
  heroPillText: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.3 },
  heroFooter: {
    marginTop: 16, paddingTop: 14, borderTopWidth: 1,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
  },
  heroFooterLeft: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  heroFooterText: { fontFamily: FONTS.sans, fontSize: 12.5, flexShrink: 1 },
  countdown: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, flexShrink: 0 },
  countdownText: { fontFamily: FONTS.monoMedium, fontSize: 11.5, letterSpacing: 0.3 },
});
