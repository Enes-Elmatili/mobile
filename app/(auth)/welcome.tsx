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
import * as Haptics from "expo-haptics";
import { FONTS } from "@/hooks/use-app-theme";
import { AuthScreen, AuthCTA, AuthLink, authT, alpha } from "@/components/auth";

export default function Welcome() {
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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(auth)/role-select");
  };

  const handleSignIn = async () => {
    await Haptics.selectionAsync();
    router.push("/(auth)/login");
  };

  return (
    <AuthScreen variant="standard">
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={{ flex: 1 }} />

        <Text style={s.headline}>
          UN PRO{"\n"}
          CHEZ <Text style={s.headlineAccent}>VOUS</Text>{"\n"}
          MAINTENANT
        </Text>

        <Text style={s.subhead}>
          Réservé en quelques secondes. Payé en sécurité.
        </Text>

        <View style={{ flex: 1 }} />

        {/* 3-step editorial process */}
        <View style={s.steps}>
          <View style={s.step}>
            <Text style={s.stepNum}>01</Text>
            <Text style={s.stepLabel}>CHOISIR</Text>
          </View>
          <View style={s.stepLine} />
          <View style={s.step}>
            <Text style={s.stepNum}>02</Text>
            <Text style={s.stepLabel}>PAYER</Text>
          </View>
          <View style={s.stepLine} />
          <View style={s.step}>
            <Text style={s.stepNum}>03</Text>
            <Text style={s.stepLabel}>RÉGLER</Text>
          </View>
        </View>

        <View style={s.hairline} />

        <AuthCTA label="COMMENCER" onPress={handlePrimary} variant="standard" />

        <AuthLink prefix="Déjà membre ?" action="Se connecter" onPress={handleSignIn} onDark />
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
});
