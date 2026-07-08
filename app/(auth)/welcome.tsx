// app/(auth)/welcome.tsx — FIXED welcome v2 (éditorial, flat theme-aware)
// Spec: maquette « welcome-editorial-v2 » validée 2026-07-07.
// Titre Bebas calé à gauche (contenu, plus de débordement), point vert signature,
// eyebrow mono avec tiret vert, steps sur hairline, CTA pill qui respire.
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
} from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAppTheme, FONTS, alpha } from "@/hooks/use-app-theme";
import { feedback } from "@/lib/feedback/feedback";
import {
  AuthScreen,
  AuthCTA,
  AuthLink,
  AuthMasthead,
  AuthEyebrow,
} from "@/components/auth";

export default function Welcome() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const dot = theme.brandDot;
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, slide]);

  const handlePrimary = async () => {
    feedback.haptic('medium');
    router.push("/(auth)/role-select");
  };

  const handleSignIn = async () => {
    feedback.haptic('selection');
    router.push("/(auth)/login");
  };

  // Lien « Vous êtes un pro ? » → role-select avec le rôle PROVIDER pré-sélectionné
  const handleProLink = async () => {
    feedback.haptic('medium');
    router.push({ pathname: "/(auth)/role-select", params: { role: "PROVIDER" } });
  };

  return (
    <AuthScreen variant="flat">
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        {/* « BE · IXELLES » : marque géographique, identique dans les 3 langues — volontairement hors i18n */}
        <AuthMasthead meta="BE · Ixelles" />

        <View style={s.airTop} />

        <AuthEyebrow label={t('auth.welcome_eyebrow')} />

        <Text style={[s.headline, { color: theme.text }]} maxFontSizeMultiplier={1.2}>
          {t('auth.welcome_l1')}{"\n"}
          {t('auth.welcome_l2_prefix')}{t('auth.welcome_l2_accent')}{"\n"}
          {t('auth.welcome_l3')}<Text style={{ color: dot }}>.</Text>
        </Text>

        <Text style={[s.subhead, { color: alpha(theme.text, 0.56) }]} maxFontSizeMultiplier={1.2}>
          {t('auth.welcome_sub')}
        </Text>

        <View style={s.airMid} />

        {/* 3 étapes — colonnes gauches sur hairline, numéros verts */}
        <View style={[s.steps, { borderTopColor: alpha(theme.text, 0.11) }]}>
          {[t('auth.welcome_step1'), t('auth.welcome_step2'), t('auth.welcome_step3')].map((label, i) => (
            <View key={label} style={s.step}>
              <Text style={[s.stepNum, { color: theme.greenText }]} maxFontSizeMultiplier={1.2}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={[s.stepLabel, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{label}</Text>
            </View>
          ))}
        </View>

        <AuthCTA
          label={t('auth.welcome_cta')}
          onPress={handlePrimary}
          variant={theme.isDark ? "standard" : "inverted"}
        />

        <View style={s.signinWrap}>
          <AuthLink
            prefix={t('auth.welcome_already')}
            action={t('auth.welcome_signin')}
            onPress={handleSignIn}
            onDark={theme.isDark}
          />
        </View>

        <Pressable
          onPress={handleProLink}
          style={s.proRow}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`${t('auth.welcome_pro_q')} ${t('auth.welcome_pro_link')}`}
        >
          <Text style={[s.proText, { color: alpha(theme.text, theme.isDark ? 0.26 : 0.4) }]} maxFontSizeMultiplier={1.2}>
            {t('auth.welcome_pro_q')}{" "}
            <Text style={[s.proLink, { color: alpha(theme.text, theme.isDark ? 0.5 : 0.68), textDecorationColor: alpha(theme.text, theme.isDark ? 0.26 : 0.4) }]}>
              {t('auth.welcome_pro_link')}
            </Text>
          </Text>
        </Pressable>
      </Animated.View>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  // Rythme vertical v2 : air généreux au-dessus du hero, base desserrée.
  airTop: { flex: 0.85, maxHeight: 170 },
  airMid: { flex: 1.15 },

  headline: {
    fontFamily: FONTS.bebas,
    fontSize: 52,
    lineHeight: 52,
    letterSpacing: 0.6,
    textAlign: "left",
  },
  subhead: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 20,
    maxWidth: 230,
    textAlign: "left",
  },

  steps: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 18,
    marginBottom: 30,
  },
  step: { flex: 1 },
  stepNum: {
    fontFamily: FONTS.monoMedium,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  stepLabel: {
    fontFamily: FONTS.bebas,
    fontSize: 16,
    letterSpacing: 1.2,
    marginTop: 5,
  },

  signinWrap: { marginTop: 10 },

  proRow: {
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 8,
  },
  proText: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1.5,
  },
  proLink: {
    textDecorationLine: "underline",
  },
});
