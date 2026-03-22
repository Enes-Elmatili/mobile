// app/onboarding/stripe.tsx — Stripe Connect (dark design)
import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../lib/api";
import { OnboardingLayout } from "../../components/onboarding/OnboardingLayout";
import { PROVIDER_FLOW } from "../../constants/onboardingFlows";
import { FONTS } from "@/hooks/use-app-theme";

const C = {
  white: "#FAFAFA",
  grey: "#888888",
  border: "rgba(255,255,255,0.08)",
  cardBg: "#141414",
  stripe: "#635BFF",
};

const BENEFITS = [
  { icon: "flash-outline" as const, title: "Virements rapides", desc: "Recevez vos paiements sous 2 jours ouvrés sur votre compte bancaire." },
  { icon: "shield-checkmark-outline" as const, title: "Protection Stripe", desc: "Transactions sécurisées, conformité PCI DSS et protection contre la fraude." },
  { icon: "bar-chart-outline" as const, title: "Suivi des paiements", desc: "Tableau de bord dédié pour gérer virements, factures et historique." },
  { icon: "globe-outline" as const, title: "Paiements partout", desc: "Carte bancaire, Apple Pay, Google Pay — tous les modes acceptés." },
];

export default function OnboardingStripe() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleConfigure = async () => {
    setLoading(true);
    try {
      const redirectUrl = Linking.createURL("onboarding/provider/stripe-return");
      const res: any = await api.connect.onboarding(redirectUrl);
      const url: string = res?.url;
      if (!url) throw new Error("URL Stripe introuvable. Réessayez.");
      await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: "done" });
      const status: any = await api.connect.status();
      if (status?.isStripeReady) {
        AsyncStorage.removeItem("onboarding_data").catch(() => {});
        router.replace("/onboarding/provider/pending");
        return;
      }
    } catch (e: any) {
      Alert.alert("Erreur Stripe", e?.message || "Réessayez dans quelques instants.", [
        { text: "Réessayer", onPress: handleConfigure },
      ]);
    } finally { setLoading(false); }
  };

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.STRIPE}
      totalSteps={PROVIDER_FLOW.totalSteps}
      showBack={false}
      title={"Compte de\npaiement."}
      subtitle="FIXED utilise Stripe pour virer vos gains directement sur votre compte bancaire, de façon sécurisée et transparente."
      cta={{ label: loading ? "Chargement..." : "Configurer mon compte Stripe", onPress: handleConfigure, disabled: loading, loading }}
    >
      {/* Hero icon */}
      <View style={s.heroWrap}>
        <View style={s.heroCircle}>
          <Ionicons name="card-outline" size={44} color={C.white} />
        </View>
        <View style={s.stripeBadge}>
          <Ionicons name="lock-closed" size={10} color={C.stripe} />
          <Text style={s.stripeBadgeText}>Stripe</Text>
        </View>
      </View>

      {/* Benefits */}
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

      {/* Trust note */}
      <View style={s.trustNote}>
        <Ionicons name="shield-checkmark-outline" size={14} color={C.grey} />
        <Text style={s.trustText}>Vos données bancaires sont gérées directement par Stripe et ne transitent jamais par FIXED.</Text>
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

  trustNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 12,
  },
  trustText: { flex: 1, fontFamily: FONTS.sansLight, fontSize: 11, lineHeight: 16, color: C.grey },
});
