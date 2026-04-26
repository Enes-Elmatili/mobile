// app/(auth)/auth-choice.tsx — FIXED auth choice (inverted gradient)
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { FONTS } from "@/hooks/use-app-theme";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  AuthBackButton,
  authT,
  alpha,
} from "@/components/auth";

export default function AuthChoice() {
  const router = useRouter();

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;

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

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(auth)/login");
  };

  const handleSignup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(auth)/role-select");
  };

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(auth)/role-select");
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/welcome");
  };

  return (
    <AuthScreen variant="inverted">
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={s.topRow}>
          <AuthBackButton onPress={handleBack} />
        </View>

        <View style={s.header}>
          <AuthHeadline
            kicker="BIENVENUE"
            title={"COMMENT\n{accent}CONTINUER ?{/accent}"}
            align="left"
          />
        </View>

        <View style={s.cards}>
          <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={handleLogin}>
            <View style={s.cardIcon}>
              <Feather name="log-in" size={20} color={authT.textOnDark} />
            </View>
            <View style={s.cardContent}>
              <Text style={s.cardTitle}>Se connecter</Text>
              <Text style={s.cardSub}>J'ai déjà un compte</Text>
            </View>
            <Feather name="chevron-right" size={16} color={alpha(authT.textOnDark, 0.4)} />
          </TouchableOpacity>

          <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={handleSignup}>
            <View style={s.cardIcon}>
              <Feather name="user-plus" size={20} color={authT.textOnDark} />
            </View>
            <View style={s.cardContent}>
              <Text style={s.cardTitle}>Créer un compte</Text>
              <Text style={s.cardSub}>Nouveau sur FIXED</Text>
            </View>
            <Feather name="chevron-right" size={16} color={alpha(authT.textOnDark, 0.4)} />
          </TouchableOpacity>
        </View>

        <View style={s.spacer} />

        <AuthCTA label="COMMENCER" onPress={handleStart} />
      </Animated.View>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 28,
  },
  header: {
    marginBottom: 32,
  },
  cards: {
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: alpha(authT.dark, 0.85),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.14),
    borderRadius: 18,
    padding: 16,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: alpha(authT.textOnDark, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 16,
    color: authT.textOnDark,
    marginBottom: 2,
  },
  cardSub: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: alpha(authT.textOnDark, 0.55),
  },
  spacer: {
    flex: 1,
    minHeight: 32,
  },
});
