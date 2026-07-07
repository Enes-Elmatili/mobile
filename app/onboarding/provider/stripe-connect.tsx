// app/onboarding/provider/stripe-connect.tsx — Stripe Connect depuis l'écran de
// validation (dark design). Même contenu « préparer » que /onboarding/stripe,
// sans le fallback d'enregistrement prestataire (le profil existe déjà ici).
import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useTranslation } from "react-i18next";
import { api } from "../../../lib/api";
import { feedback } from "@/lib/feedback/feedback";
import { OnboardingLayout } from "../../../components/onboarding/OnboardingLayout";
import { PROVIDER_FLOW } from "../../../constants/onboardingFlows";
import { FONTS, COLORS, darkTokens } from "@/hooks/use-app-theme";
import { alpha } from "@/components/auth";

WebBrowser.maybeCompleteAuthSession();

// Forced-dark local palette — sourced from theme tokens so charter updates propagate
const C = {
  white:  darkTokens.text,
  grey:   darkTokens.textMuted,
  faint:  alpha(darkTokens.text, 0.3),
  border: alpha(darkTokens.text, 0.08),
  cardBg: darkTokens.cardBg,
  stripe: COLORS.stripe,
};

const PREPARE: { icon: keyof typeof Feather.glyphMap; titleKey: string; descKey: string }[] = [
  { icon: "user", titleKey: "onboarding.st_prep_id_title", descKey: "onboarding.st_prep_id_desc" },
  { icon: "credit-card", titleKey: "onboarding.st_prep_iban_title", descKey: "onboarding.st_prep_iban_desc" },
];

export default function ProviderStripeConnect() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function handleConfigure() {
    setLoading(true);
    try {
      const returnUrl = Linking.createURL("onboarding/provider/stripe-return");
      const refreshUrl = Linking.createURL("onboarding/provider/stripe-refresh");
      const res: any = await api.connect.onboarding(returnUrl, refreshUrl);
      const url: string = res?.url;
      if (!url) throw new Error(t('onboarding.st_no_url'));

      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
      if (__DEV__) console.log("AUTH SESSION RESULT:", JSON.stringify(result));

      // Vérifier si Stripe est configuré après retour du browser
      const status: any = await api.connect.status();
      if (__DEV__) console.log("STRIPE STATUS AFTER RETURN:", JSON.stringify(status));
      if (status?.isStripeReady) {
        feedback.success(t('onboarding.st_success'));
        router.replace("/onboarding/provider/pending");
        return;
      }
      // Stripe pas configuré (annulé ou incomplet) → rester sur cet écran + informer
      feedback.info(t('onboarding.stripe_incomplete'));
    } catch (err: any) {
      feedback.error(err?.message || t('onboarding.st_error'));
    } finally { setLoading(false); }
  }

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
