// app/onboarding/stripe.tsx — Paiements / Stripe Connect (dark design)
// Redesign onboarding : l'écran prépare au lieu de vanter — durée (≈ 5 min),
// pièces à réunir (identité + IBAN), et ce qui se passe après la redirection.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing, Platform, StatusBar } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../lib/api";
import { feedback } from "@/lib/feedback/feedback";
import { useTranslation } from "react-i18next";
import { OnboardingLayout } from "../../components/onboarding/OnboardingLayout";
import { PROVIDER_FLOW } from "../../constants/onboardingFlows";
import { FONTS, COLORS, darkTokens } from "@/hooks/use-app-theme";
import { alpha } from "@/components/auth";

WebBrowser.maybeCompleteAuthSession();

// Forced-dark local palette — sourced from theme tokens so charter updates propagate
const C = {
  bg:     darkTokens.bg,
  white:  darkTokens.text,
  grey:   darkTokens.textMuted,
  faint:  alpha(darkTokens.text, 0.3),
  border: alpha(darkTokens.text, 0.08),
  cardBg: darkTokens.cardBg,
  stripe: COLORS.stripe,
  green:  COLORS.greenBrand,
};

const PREPARE: { icon: keyof typeof Feather.glyphMap; titleKey: string; descKey: string }[] = [
  { icon: "user", titleKey: "onboarding.st_prep_id_title", descKey: "onboarding.st_prep_id_desc" },
  { icon: "credit-card", titleKey: "onboarding.st_prep_iban_title", descKey: "onboarding.st_prep_iban_desc" },
];

const HOW_IT_WORKS: { icon: keyof typeof Feather.glyphMap; titleKey: string; descKey: string }[] = [
  { icon: "zap", titleKey: "onboarding.st_how_1_title", descKey: "onboarding.st_how_1_desc" },
  { icon: "shield", titleKey: "onboarding.st_how_2_title", descKey: "onboarding.st_how_2_desc" },
  { icon: "file-text", titleKey: "onboarding.st_how_3_title", descKey: "onboarding.st_how_3_desc" },
];

const REDIRECT_STEP_KEYS = ["onboarding.st_step_1", "onboarding.st_step_2", "onboarding.st_step_3"];

// ── État plein écran pendant la redirection vers Stripe ─────────────────────
function StripeRedirectOverlay() {
  const { t } = useTranslation();
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
    );
    a.start();
    return () => a.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={r.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={r.center}>
        <View style={r.ringWrap}>
          <Animated.View style={[r.spinner, { transform: [{ rotate }] }]} />
          <View style={r.ringInner}>
            <Feather name="external-link" size={22} color={C.stripe} />
          </View>
        </View>
        <Text style={r.kicker}>{t('onboarding.st_redirect_kicker')}</Text>
        <Text style={r.title}>{t('onboarding.st_redirect_title')}</Text>
        <Text style={r.sub}>{t('onboarding.st_redirect_sub')}</Text>
      </View>

      <View style={r.stepsCard}>
        {REDIRECT_STEP_KEYS.map((key, i) => (
          <View key={key} style={[r.stepRow, i < REDIRECT_STEP_KEYS.length - 1 && r.stepRowBorder]}>
            <Text style={[r.stepNum, i === 0 && { color: C.white }]}>
              {String(i + 1).padStart(2, "0")}
            </Text>
            <Text style={[r.stepText, i === 0 && r.stepTextActive]}>{t(key)}</Text>
            {i === 0 && <View style={r.stepDot} />}
          </View>
        ))}
      </View>
      <View style={r.secureRow}>
        <Feather name="lock" size={10} color={C.stripe} />
        <Text style={r.secureStripe}>{t('onboarding.st_secure')}</Text>
        <Text style={r.secureMuted}>{t('onboarding.st_secure_domain')}</Text>
      </View>
    </View>
  );
}

export default function OnboardingStripe() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleConfigure = async () => {
    setLoading(true);
    try {
      // 1. S'assurer que le profil prestataire existe (peut manquer si signup classique)
      const statusCheck: any = await api.connect.status().catch(() => null);
      if (!statusCheck?.isProvider) {
        const raw = await AsyncStorage.getItem("onboarding_data");
        const data = raw ? JSON.parse(raw) : {};
        // Fallback: fetch user profile if onboarding_data is empty
        let userName = data.name || data.displayName || '';
        if (!userName) {
          try {
            const me: any = await api.user.me();
            userName = me?.name || me?.data?.name || me?.email || 'Prestataire';
          } catch { userName = 'Prestataire'; }
        }
        try {
          await api.providers.register({
            name: userName,
            description: data.bio || data.description || undefined,
            phone: data.phone || undefined,
            city: data.city || undefined,
            lat: data.lat,
            lng: data.lng,
            categoryIds: (data.categories || []).map((c: any) => c.id).filter(Boolean),
          });
        } catch (regErr: any) {
          // 409 = déjà prestataire (conflit) → continuer
          if (regErr?.status !== 409 && regErr?.statusCode !== 409) throw regErr;
        }
      }

      // 2. Ouvrir Stripe Connect onboarding
      const returnUrl = Linking.createURL("onboarding/provider/stripe-return");
      const refreshUrl = Linking.createURL("onboarding/provider/stripe-refresh");
      const res: any = await api.connect.onboarding(returnUrl, refreshUrl);
      const url: string = res?.url;
      if (!url) throw new Error(t('onboarding.st_no_url'));

      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
      if (__DEV__) console.log("AUTH SESSION RESULT:", JSON.stringify(result));

      // 3. Vérifier le statut après retour
      const status: any = await api.connect.status();
      if (status?.isStripeReady) {
        feedback.success(t('onboarding.st_success'));
        AsyncStorage.removeItem("onboarding_data").catch(() => {});
        router.replace("/onboarding/provider/pending");
        return;
      }
      // Stripe pas encore configuré (annulé ou incomplet) → informer l'utilisateur
      feedback.info(t('onboarding.stripe_incomplete'));
    } catch (err: any) {
      feedback.error(err?.message || t('onboarding.st_error'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <StripeRedirectOverlay />;

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.STRIPE}
      totalSteps={PROVIDER_FLOW.totalSteps}
      stepLabel={t('onboarding.st_step_label')}
      showBack={false}
      title={t('onboarding.st_title')}
      subtitle={t('onboarding.st_sub')}
      cta={{
        label: t('onboarding.st_cta'),
        onPress: handleConfigure,
        disabled: loading,
        loading,
        sub: t('onboarding.st_cta_sub'),
      }}
    >
      {/* À préparer — la vraie info utile avant la redirection */}
      <View style={s.card}>
        <Text style={s.cardLabel}>{t('onboarding.st_prepare')}</Text>
        <View style={s.prepareList}>
          {PREPARE.map((row) => (
            <View key={row.titleKey} style={s.prepareRow}>
              <View style={s.prepareIcon}>
                <Feather name={row.icon} size={15} color={C.white} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowTitle}>{t(row.titleKey)}</Text>
                <Text style={s.rowDesc}>{t(row.descKey)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Comment ça marche */}
      <View style={[s.card, { paddingVertical: 4 }]}>
        {HOW_IT_WORKS.map((b, i) => (
          <View key={b.titleKey} style={[s.howRow, i < HOW_IT_WORKS.length - 1 && s.howRowBorder]}>
            <Feather name={b.icon} size={15} color={C.grey} />
            <View style={s.rowText}>
              <Text style={s.rowTitle}>{t(b.titleKey)}</Text>
              <Text style={s.rowDesc}>{t(b.descKey)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Powered by Stripe */}
      <View style={s.poweredRow}>
        <Feather name="lock" size={10} color={C.stripe} />
        <Text style={s.poweredStripe}>{t('onboarding.st_powered')}</Text>
        <Text style={s.poweredMuted}>{t('onboarding.st_pci')}</Text>
      </View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  cardLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    color: C.grey,
    marginBottom: 13,
  },
  prepareList: { gap: 12 },
  prepareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  prepareIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: alpha(darkTokens.text, 0.05),
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { fontFamily: FONTS.sansMedium, fontSize: 13, color: C.white },
  rowDesc: { fontFamily: FONTS.sansLight, fontSize: 11.5, lineHeight: 16, color: C.grey },

  howRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  howRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: alpha(darkTokens.text, 0.07),
  },

  poweredRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  poweredStripe: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: C.stripe,
  },
  poweredMuted: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: C.faint,
  },
});

const r = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 70 : 50,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ringWrap: {
    width: 88,
    height: 88,
    marginBottom: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: alpha(COLORS.stripe, 0.6),
    borderTopColor: "transparent",
  },
  ringInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: alpha(COLORS.stripe, 0.12),
    borderWidth: 1,
    borderColor: alpha(COLORS.stripe, 0.4),
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 2.6,
    color: C.grey,
  },
  title: {
    fontFamily: FONTS.bebas,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: 1,
    color: C.white,
    textAlign: "center",
    marginTop: 12,
  },
  sub: {
    fontFamily: FONTS.sansLight,
    fontSize: 13,
    lineHeight: 20,
    color: C.grey,
    textAlign: "center",
    marginTop: 14,
    maxWidth: 260,
  },
  stepsCard: {
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
  },
  stepRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: alpha(darkTokens.text, 0.07),
  },
  stepNum: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: C.faint,
  },
  stepText: {
    flex: 1,
    fontFamily: FONTS.sansLight,
    fontSize: 12.5,
    color: C.grey,
  },
  stepTextActive: {
    fontFamily: FONTS.sansMedium,
    color: C.white,
  },
  stepDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.stripe,
  },
  secureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secureStripe: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: C.stripe,
  },
  secureMuted: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: C.faint,
  },
});
