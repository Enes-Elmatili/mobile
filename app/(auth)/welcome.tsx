// app/(auth)/welcome.tsx — FIXED welcome (standard light → dark gradient)
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
import { FONTS } from "@/hooks/use-app-theme";
import { feedback } from "@/lib/feedback/feedback";
import { AuthScreen, AuthCTA, AuthLink, authT, alpha } from "@/components/auth";

export default function Welcome() {
  const { t } = useTranslation();
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
    <AuthScreen variant="standard">
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={{ flex: 1 }} />

        <Text style={s.headline}>
          {t('auth.welcome_l1')}{"\n"}
          {t('auth.welcome_l2_prefix')}
          <Text style={s.headlineAccent}>{t('auth.welcome_l2_accent')}</Text>{"\n"}
          {t('auth.welcome_l3')}
        </Text>

        <Text style={s.subhead}>{t('auth.welcome_sub')}</Text>

        <View style={{ flex: 1 }} />

        {/* 3-step editorial process */}
        <View style={s.steps}>
          {[t('auth.welcome_step1'), t('auth.welcome_step2'), t('auth.welcome_step3')].map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <View style={s.stepLine} />}
              <View style={s.step}>
                <Text style={s.stepNum}>{String(i + 1).padStart(2, "0")}</Text>
                <Text style={s.stepLabel}>{label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        <View style={s.hairline} />

        <AuthCTA label={t('auth.welcome_cta')} onPress={handlePrimary} variant="standard" />

        <AuthLink prefix={t('auth.welcome_already')} action={t('auth.welcome_signin')} onPress={handleSignIn} onDark />

        <Pressable
          onPress={handleProLink}
          style={s.proRow}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${t('auth.welcome_pro_q')} ${t('auth.welcome_pro_link')}`}
        >
          <Text style={s.proText}>
            {t('auth.welcome_pro_q')} <Text style={s.proLink}>{t('auth.welcome_pro_link')}</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  // Headline (sits in light zone — uses textOnLight)
  headline: {
    fontFamily: FONTS.bebas,
    fontSize: 64,
    lineHeight: 66,
    letterSpacing: 0.5,
    color: authT.textOnLight,
    textAlign: "center",
  },
  headlineAccent: {
    color: alpha(authT.textOnLight, 0.72),
  },

  // Subhead
  subhead: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    lineHeight: 22,
    color: alpha(authT.textOnDark, 0.6),
    marginTop: 20,
    maxWidth: 280,
    textAlign: "center",
    alignSelf: "center",
  },

  // 3-step (sits in dark zone — uses textOnDark)
  steps: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  step: {
    alignItems: "center",
    gap: 5,
  },
  stepNum: {
    fontFamily: FONTS.monoMedium,
    fontSize: 10,
    letterSpacing: 1,
    color: alpha(authT.textOnDark, 0.4),
  },
  stepLabel: {
    fontFamily: FONTS.bebas,
    fontSize: 15,
    letterSpacing: 1.5,
    color: authT.textOnDark,
  },
  stepLine: {
    flex: 1,
    height: 1,
    backgroundColor: alpha(authT.textOnDark, 0.14),
    marginHorizontal: 12,
  },

  // Editorial hairline (full bleed via negative margin matching AuthScreen padding)
  hairline: {
    height: 1,
    backgroundColor: alpha(authT.textOnDark, 0.12),
    marginHorizontal: -22,
    marginBottom: 20,
  },

  // Lien prestataire (zone sombre)
  proRow: {
    alignItems: "center",
    marginTop: 12,
  },
  proText: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: alpha(authT.textOnDark, 0.3),
  },
  proLink: {
    color: alpha(authT.textOnDark, 0.55),
    textDecorationLine: "underline",
    textDecorationColor: alpha(authT.textOnDark, 0.3),
  },
});
