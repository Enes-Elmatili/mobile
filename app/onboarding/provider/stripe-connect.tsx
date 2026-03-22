// app/onboarding/provider/stripe-connect.tsx — Stripe Connect (dark design)
import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { api } from "../../../lib/api";
import { OnboardingLayout } from "../../../components/onboarding/OnboardingLayout";
import { PROVIDER_FLOW } from "../../../constants/onboardingFlows";
import { FONTS } from "@/hooks/use-app-theme";

WebBrowser.maybeCompleteAuthSession();

const C = {
  white: "#FAFAFA",
  grey: "#888888",
  border: "rgba(255,255,255,0.08)",
  cardBg: "#141414",
  stripe: "#635BFF",
};

const BENEFITS = [
  { icon: "flash-outline" as const, title: "Virements rapides", desc: "Recevez vos paiements sous 2 jours ouvrés." },
  { icon: "shield-checkmark-outline" as const, title: "Protection Stripe", desc: "Transactions sécurisées et conformité PCI DSS." },
  { icon: "bar-chart-outline" as const, title: "Suivi des paiements", desc: "Tableau de bord pour gérer virements et factures." },
];

export default function ProviderStripeConnect() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleConfigure() {
    setLoading(true);
    try {
      const returnUrl = Linking.createURL("onboarding/provider/stripe-return");
      const refreshUrl = Linking.createURL("onboarding/provider/stripe-refresh");
      const res: any = await api.connect.onboarding(returnUrl, refreshUrl);
      const url: string = res?.url;
      if (!url) throw new Error("URL Stripe manquante");

      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
      if (__DEV__) console.log("AUTH SESSION RESULT:", JSON.stringify(result));

      // Vérifier si Stripe est configuré après retour du browser
      const status: any = await api.connect.status();
      if (__DEV__) console.log("STRIPE STATUS AFTER RETURN:", JSON.stringify(status));
      if (status?.isStripeReady) {
        router.replace("/onboarding/provider/pending");
        return;
      }
      // Stripe pas configuré (annulé ou incomplet) → rester sur cet écran
    } catch (err: any) {
      Alert.alert("Erreur Stripe", "Impossible d'ouvrir la configuration. Vérifiez votre connexion.", [
        { text: "Réessayer", onPress: handleConfigure },
      ]);
    } finally { setLoading(false); }
  }

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.STRIPE}
      totalSteps={PROVIDER_FLOW.totalSteps}
      showBack={false}
      title="Compte de paiement."
      subtitle="FIXED utilise Stripe pour virer vos gains directement sur votre compte bancaire."
      cta={{ label: loading ? "Chargement..." : "Configurer mon compte Stripe", onPress: handleConfigure, disabled: loading, loading }}
    >
      <View style={s.heroWrap}>
        <View style={s.heroCircle}>
          <Ionicons name="card-outline" size={44} color={C.white} />
        </View>
        <View style={s.stripeBadge}>
          <Ionicons name="lock-closed" size={10} color={C.stripe} />
          <Text style={s.stripeBadgeText}>Stripe</Text>
        </View>
      </View>

      <View style={s.benefitList}>
        {BENEFITS.map((b, i) => (
          <View key={i} style={s.benefitRow}>
            <View style={s.benefitIcon}>
              <Ionicons name={b.icon} size={18} color={C.white} />
            </View>
            <View style={s.benefitText}>
              <Text style={s.benefitTitle}>{b.title}</Text>
              <Text style={s.benefitDesc}>{b.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  heroWrap: { alignItems: "center", marginBottom: 28 },
  heroCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  stripeBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(99,91,255,0.1)", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 12,
  },
  stripeBadgeText: { fontFamily: FONTS.sansMedium, fontSize: 12, color: C.stripe },

  benefitList: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 4, marginBottom: 20,
  },
  benefitRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  benefitIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center", justifyContent: "center",
  },
  benefitText: { flex: 1, gap: 2 },
  benefitTitle: { fontFamily: FONTS.sansMedium, fontSize: 14, color: C.white },
  benefitDesc: { fontFamily: FONTS.sansLight, fontSize: 12, lineHeight: 17, color: C.grey },
});
