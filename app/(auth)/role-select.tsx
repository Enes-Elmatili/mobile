// app/(auth)/role-select.tsx — role selection (flat theme-aware, v2)
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { feedback } from "@/lib/feedback/feedback";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/auth/AuthContext";
import { api } from "@/lib/api";
import { FONTS, useAppTheme, alpha } from "@/hooks/use-app-theme";
import {
  AuthScreen,
  AuthCTA,
  AuthBackButton,
  AuthLink,
  AuthMasthead,
  AuthEyebrow,
} from "@/components/auth";

const ROLE_INTENT_KEY = "@fixed:signup:role";

// ── Role card ───────────────────────────────────────────────────────────────
function RoleCard({
  icon,
  title,
  subtitle,
  meta,
  isSelected,
  onPress,
  theme,
  dot,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  meta?: string;
  isSelected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useAppTheme>;
  dot: string;
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
        style={[
          s.card,
          { backgroundColor: theme.cardBg, borderColor: theme.borderLight },
          isSelected && { borderColor: dot },
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={title}
        accessibilityHint={subtitle}
      >
        <View style={[s.cardIcon, { backgroundColor: alpha(theme.text, 0.07), borderColor: alpha(theme.text, 0.12) }]}>
          <Feather name={icon} size={20} color={theme.text} />
        </View>

        <View style={s.cardText}>
          <Text style={[s.cardTitle, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{title}</Text>
          <Text style={[s.cardSub, { color: alpha(theme.text, 0.55) }]} maxFontSizeMultiplier={1.2}>{subtitle}</Text>
          {!!meta && <Text style={[s.cardMeta, { color: theme.greenText }]} maxFontSizeMultiplier={1.2}>{meta.toUpperCase()}</Text>}
        </View>

        <View style={[s.radio, { borderColor: alpha(theme.text, 0.3) }, isSelected && { borderColor: dot }]}>
          <Animated.View style={[s.radioInner, { backgroundColor: dot, transform: [{ scale: radioDot }] }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────
export default function RoleSelect() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const dot = theme.brandDot;
  const { user, signIn } = useAuth();
  // Pré-sélection possible via param (ex. lien « Vous êtes un pro ? » du welcome)
  const params = useLocalSearchParams<{ role?: string }>();
  const initialRole: "CLIENT" | "PROVIDER" | null =
    params.role === "PROVIDER" || params.role === "CLIENT" ? params.role : null;
  const [selected, setSelected] = useState<"CLIENT" | "PROVIDER" | null>(initialRole);
  const [submitting, setSubmitting] = useState(false);
  const isAuthenticated = !!user;

  // ext.role_title porte un balisage hérité "{accent}...{/accent}" (pensé pour
  // l'ancien AuthHeadline, retiré de cet écran) — on le nettoie pour éviter
  // d'afficher les accolades brutes. Dans les 3 langues (fr/en/nl) le titre se
  // termine déjà par "?" → pas de point vert ajouté (cf. plan, cas "?").
  const roleTitle = t('ext.role_title').replace(/\{\/?accent\}/g, '');

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
    feedback.haptic('light');
  };

  const confirm = async () => {
    if (!selected || submitting) return;
    feedback.haptic('medium');

    if (isAuthenticated) {
      setSubmitting(true);
      try {
        const res = await api.auth.assignRole(selected);
        if (res?.token) await signIn(res.token);
        // Navigation explicite pour les DEUX rôles — on ne dépend plus de la
        // chaîne implicite refreshMe → redirect (spinner infini si res.token absent).
        if (selected === "PROVIDER") {
          router.replace("/onboarding/documents");
        } else {
          router.replace("/(tabs)/dashboard");
        }
      } catch (e: any) {
        feedback.error(e?.message || t('ext.role_assign_error'));
        setSubmitting(false);
      }
    } else {
      await AsyncStorage.setItem(ROLE_INTENT_KEY, selected);
      router.push("/(auth)/signup");
    }
  };

  const handleBack = () => {
    feedback.haptic('selection');
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/welcome");
  };

  return (
    <AuthScreen variant="flat" scrollable>
      <Animated.View style={[s.flex, { opacity: fade, transform: [{ translateY: slide }] }]}>
        <View style={s.topRow}>
          {!isAuthenticated ? <AuthBackButton onPress={handleBack} themed /> : <View style={{ width: 36 }} />}
          <View style={{ flex: 1 }} />
        </View>

        <AuthMasthead meta={t('ext.role_step')} />

        <View style={s.airTop} />

        <AuthEyebrow label={t('ext.role_signup')} />

        <Text style={[s.headline, { color: theme.text }]} maxFontSizeMultiplier={1.2}>
          {roleTitle}
        </Text>
        <Text style={[s.subhead, { color: alpha(theme.text, 0.56) }]} maxFontSizeMultiplier={1.2}>
          {t('ext.role_subtitle')}
        </Text>

        <View style={s.cards}>
          <RoleCard
            icon="user"
            title={t('ext.role_client')}
            subtitle={t('ext.role_client_sub')}
            isSelected={selected === "CLIENT"}
            onPress={() => select("CLIENT")}
            theme={theme}
            dot={dot}
          />
          <RoleCard
            icon="tool"
            title={t('ext.role_provider')}
            subtitle={t('ext.role_provider_sub')}
            meta={t('ext.role_provider_meta')}
            isSelected={selected === "PROVIDER"}
            onPress={() => select("PROVIDER")}
            theme={theme}
            dot={dot}
          />
        </View>

        <View style={s.switchNote}>
          <Feather name="refresh-cw" size={11} color={alpha(theme.text, theme.isDark ? 0.3 : 0.45)} />
          <Text style={[s.switchNoteText, { color: alpha(theme.text, theme.isDark ? 0.3 : 0.45) }]} maxFontSizeMultiplier={1.2}>{t('ext.role_switch_note').toUpperCase()}</Text>
        </View>

        <View style={s.spacer} />

        <AuthCTA
          label={submitting ? t('ext.role_loading') : t('ext.role_continue')}
          onPress={confirm}
          loading={submitting}
          disabled={!selected}
          variant={theme.isDark ? "standard" : "inverted"}
        />

        {!isAuthenticated && (
          <AuthLink
            prefix={t('ext.role_already_account')}
            action={t('ext.role_sign_in')}
            onPress={() => {
              feedback.haptic('selection');
              router.push("/(auth)/login");
            }}
            onDark={theme.isDark}
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
    marginTop: 4,
  },
  airTop: { flex: 0.55, minHeight: 12 },
  headline: {
    fontFamily: FONTS.bebas,
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: 0.6,
    textAlign: "left",
  },
  subhead: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 12,
    maxWidth: 240,
    textAlign: "left",
  },

  // Cards
  cards: { gap: 10, marginTop: 22 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: FONTS.bebas,
    fontSize: 26,
    letterSpacing: 2,
    lineHeight: 30,
    marginBottom: 3,
  },
  cardSub: {
    fontFamily: FONTS.sansLight,
    fontSize: 12,
    lineHeight: 17,
  },
  cardMeta: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 1.4,
    marginTop: 5,
  },
  switchNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  switchNoteText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 1.3,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  spacer: {
    flex: 1,
    minHeight: 20,
  },
});
