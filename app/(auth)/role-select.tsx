// app/(auth)/role-select.tsx — role selection (inverted gradient)
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../lib/auth/AuthContext";
import { api } from "@/lib/api";
import { FONTS } from "@/hooks/use-app-theme";
import {
  AuthScreen,
  AuthHeadline,
  AuthCTA,
  AuthBackButton,
  AuthLink,
  authT,
  alpha,
} from "@/components/auth";

const ROLE_INTENT_KEY = "@fixed:signup:role";

// ── Role card ───────────────────────────────────────────────────────────────
function RoleCard({
  icon,
  title,
  subtitle,
  isSelected,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const radioDot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(radioDot, {
      toValue: isSelected ? 1 : 0,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  }, [isSelected]);

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[s.card, isSelected && s.cardSelected]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <View style={[s.cardIcon, isSelected && s.cardIconSelected]}>
          <Feather
            name={icon}
            size={20}
            color={isSelected ? authT.textOnLight : authT.textOnDark}
          />
        </View>

        <View style={s.cardText}>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={s.cardSub}>{subtitle}</Text>
        </View>

        <View style={[s.radio, isSelected && s.radioSelected]}>
          <Animated.View style={[s.radioInner, { transform: [{ scale: radioDot }] }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────
export default function RoleSelect() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const [selected, setSelected] = useState<"CLIENT" | "PROVIDER" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isAuthenticated = !!user;

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

  const select = (role: "CLIENT" | "PROVIDER") => {
    setSelected(role);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const confirm = async () => {
    if (!selected || submitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isAuthenticated) {
      setSubmitting(true);
      try {
        const res = await api.auth.assignRole(selected);
        if (res?.token) await signIn(res.token);
        if (selected === "PROVIDER") {
          router.replace("/onboarding/documents");
          return;
        }
      } catch (e: any) {
        Alert.alert("Erreur", e?.message || "Impossible d'attribuer le rôle");
        setSubmitting(false);
      }
    } else {
      await AsyncStorage.setItem(ROLE_INTENT_KEY, selected);
      router.push("/(auth)/signup");
    }
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/welcome");
  };

  return (
    <AuthScreen variant="inverted">
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={s.topRow}>
          {!isAuthenticated ? <AuthBackButton onPress={handleBack} /> : <View style={{ width: 36 }} />}
          <Text style={s.eyebrow}>Inscription</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={s.header}>
          <AuthHeadline
            kicker="ÉTAPE 1 / 3"
            title={"JE SUIS\n{accent}QUI ?{/accent}"}
            subtitle="Choisissez votre profil pour personnaliser l'expérience."
            align="left"
          />
        </View>

        <View style={s.cards}>
          <RoleCard
            icon="user"
            title="CLIENT"
            subtitle={"Je cherche un prestataire\npour mon domicile"}
            isSelected={selected === "CLIENT"}
            onPress={() => select("CLIENT")}
          />
          <RoleCard
            icon="tool"
            title="PRESTATAIRE"
            subtitle={"Je propose mes services\net gère mes missions"}
            isSelected={selected === "PROVIDER"}
            onPress={() => select("PROVIDER")}
          />
        </View>

        <View style={s.spacer} />

        <AuthCTA
          label={submitting ? "CHARGEMENT…" : "CONTINUER"}
          onPress={confirm}
          loading={submitting}
          disabled={!selected}
        />

        {!isAuthenticated && (
          <AuthLink
            prefix="Déjà un compte ?"
            action="Se connecter"
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/(auth)/login");
            }}
          />
        )}
      </Animated.View>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 24,
  },
  eyebrow: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: alpha(authT.textOnDark, 0.5),
    textTransform: "uppercase",
  },
  header: {
    marginBottom: 24,
  },

  // Cards — stay dark always; selection is signaled by border + filled icon + radio.
  cards: {
    gap: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    backgroundColor: alpha(authT.dark, 0.85),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.14),
    borderRadius: 22,
    padding: 22,
  },
  cardSelected: {
    backgroundColor: alpha(authT.dark, 0.95),
    borderColor: authT.textOnDark,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: alpha(authT.textOnDark, 0.08),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconSelected: {
    backgroundColor: authT.textOnDark,
    borderColor: authT.textOnDark,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: FONTS.bebas,
    fontSize: 26,
    color: authT.textOnDark,
    letterSpacing: 2,
    lineHeight: 30,
    marginBottom: 3,
  },
  cardSub: {
    fontFamily: FONTS.sansLight,
    fontSize: 12,
    color: alpha(authT.textOnDark, 0.55),
    lineHeight: 17,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: alpha(authT.textOnDark, 0.3),
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: authT.textOnDark,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: authT.textOnDark,
  },

  spacer: {
    flex: 1,
    minHeight: 32,
  },
});
