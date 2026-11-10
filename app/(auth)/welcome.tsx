// app/(auth)/welcome.tsx — FIXED welcome v2 (éditorial, flat theme-aware)
// Spec: maquette « welcome-editorial-v2 » validée 2026-07-07.
// Titre Bebas calé à gauche (contenu, plus de débordement), point vert signature,
// eyebrow mono avec tiret vert, steps sur hairline, CTA pill qui respire.
import React from "react";
import {
  View,
  Text,
  StyleSheet,
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
import { WelcomeHeadline, WelcomeSteps } from "@/components/auth/AuthCover";
import { useSplitPane } from "@/lib/layout";
import Animated from 'react-native-reanimated';
import { useEntrance } from '@/lib/motion/useEntrance';
import { PressScale } from '@/components/ui/PressScale';

export default function Welcome() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  // Duo déplié : titre et étapes sont sur la couverture (page gauche) ; la page
  // droite ne garde que l'invitation — commencer, se connecter, être pro.
  const inBook = useSplitPane();
  // Entrée : fondu + glissé sur un ressort (lib/motion/useEntrance).
  const entrance = useEntrance(20);

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
      <Animated.View style={[s.flex, entrance.style]}>
        <AuthMasthead />

        {inBook ? (
          // Page droite : l'invitation, au centre optique de la page.
          <View style={s.bookInvite}>
            <AuthEyebrow label={t('auth.welcome_eyebrow')} />
          </View>
        ) : (
          <>
            <View style={s.airTop} />
            <WelcomeHeadline />
            <View style={s.airMid} />
            {/* 3 étapes — trois colonnes égales sur filet, numéros verts */}
            <View style={s.stepsWrap}>
              <WelcomeSteps />
            </View>
          </>
        )}

        <AuthCTA
          label={t('auth.welcome_cta')}
          onPress={handlePrimary}
          variant="flat"
        />

        <View style={s.signinWrap}>
          <AuthLink
            prefix={t('auth.welcome_already')}
            action={t('auth.welcome_signin')}
            onPress={handleSignIn}
            testID="welcome-sign-in"
            themed
          />
        </View>

        <PressScale
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
        </PressScale>
      </Animated.View>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  // Rythme vertical v2 : air généreux au-dessus du hero, base desserrée.
  airTop: { flex: 0.85, maxHeight: 170 },
  airMid: { flex: 1.15 },

  stepsWrap: { marginBottom: 30 },
  bookInvite: { flex: 1, justifyContent: "flex-end", paddingBottom: 18 },

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
